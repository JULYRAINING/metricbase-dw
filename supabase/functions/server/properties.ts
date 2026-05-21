import { Hono } from "npm:hono";
import * as kv from "./kv_store.ts";

const app = new Hono();

// Property 类型定义
interface Property {
  id: string;
  name: string;
  type: 'int' | 'string' | 'date' | 'datetime' | 'decimal' | 'boolean';
  component_id: string;
  dimension_id?: string | null;
  description?: string;
  is_join_key?: boolean;
  join_key_target?: string;
  created_at: string;
  updated_at: string;
}

// 生成唯一ID
const generateId = () => crypto.randomUUID();

// 获取当前时间戳
const now = () => new Date().toISOString();

// KV键名生成器
const KEYS = {
  property: (id: string) => `property:${id}`,
  componentProperties: (componentId: string) => `component:${componentId}:properties`,
  propertyList: () => "property:list",
};

// GET /properties - 获取字段列表
app.get("/", async (c) => {
  try {
    const componentId = c.req.query("component_id");

    if (componentId) {
      // 获取特定组件的字段列表
      const propertyIds: string[] = await kv.get(KEYS.componentProperties(componentId)) || [];
      const properties: (Property | null)[] = await Promise.all(
        propertyIds.map(async (id) => await kv.get(KEYS.property(id)))
      );
      return c.json({ data: properties.filter((p): p is Property => p !== null) });
    }

    // 获取所有字段
    const properties: Property[] = await kv.getByPrefix("property:") || [];
    const result = properties.filter((prop: Property) =>
      prop && prop.id && !prop.id.includes(":")
    );

    return c.json({ data: result });
  } catch (error) {
    console.error("获取字段列表失败:", error);
    return c.json({ error: "获取字段列表失败" }, 500);
  }
});

// GET /properties/:id - 获取单个字段详情
app.get("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const property: Property | null = await kv.get(KEYS.property(id));

    if (!property) {
      return c.json({ error: "字段不存在" }, 404);
    }

    return c.json({ data: property });
  } catch (error) {
    console.error("获取字段详情失败:", error);
    return c.json({ error: "获取字段详情失败" }, 500);
  }
});

// POST /properties - 创建字段
app.post("/", async (c) => {
  try {
    const body = await c.req.json();

    // 验证必填字段
    if (!body.name || !body.component_id) {
      return c.json({ error: "字段名称和所属组件为必填项" }, 400);
    }

    // 验证字段类型
    const validTypes = ['int', 'string', 'date', 'datetime', 'decimal', 'boolean'];
    if (body.type && !validTypes.includes(body.type)) {
      return c.json({ error: "无效的字段类型" }, 400);
    }

    const id = generateId();

    const property: Property = {
      id,
      name: body.name,
      type: body.type || 'string',
      component_id: body.component_id,
      dimension_id: body.dimension_id || null,
      description: body.description || undefined,
      is_join_key: body.is_join_key || false,
      join_key_target: body.join_key_target || undefined,
      created_at: now(),
      updated_at: now(),
    };

    // 保存字段数据
    await kv.set(KEYS.property(id), property);

    // 更新组件的字段列表
    const componentPropsKey = KEYS.componentProperties(body.component_id);
    const componentProps: string[] = await kv.get(componentPropsKey) || [];
    componentProps.push(id);
    await kv.set(componentPropsKey, componentProps);

    // 更新总列表
    const list: string[] = await kv.get(KEYS.propertyList()) || [];
    list.push(id);
    await kv.set(KEYS.propertyList(), list);

    return c.json({ data: property }, 201);
  } catch (error) {
    console.error("创建字段失败:", error);
    return c.json({ error: "创建字段失败" }, 500);
  }
});

// PUT /properties/:id - 更新字段
app.put("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();

    // 获取现有字段
    const existing: Property | null = await kv.get(KEYS.property(id));
    if (!existing) {
      return c.json({ error: "字段不存在" }, 404);
    }

    // 如果修改了所属组件，需要更新组件的字段列表
    const oldComponentId = existing.component_id;
    const newComponentId = body.component_id !== undefined
      ? body.component_id
      : oldComponentId;

    if (newComponentId !== oldComponentId) {
      // 从旧组件的字段列表中移除
      const oldPropsKey = KEYS.componentProperties(oldComponentId);
      const oldProps: string[] = await kv.get(oldPropsKey) || [];
      await kv.set(
        oldPropsKey,
        oldProps.filter((pid) => pid !== id)
      );

      // 添加到新组件的字段列表
      const newPropsKey = KEYS.componentProperties(newComponentId);
      const newProps: string[] = await kv.get(newPropsKey) || [];
      newProps.push(id);
      await kv.set(newPropsKey, newProps);
    }

    // 验证字段类型
    const validTypes = ['int', 'string', 'date', 'datetime', 'decimal', 'boolean'];
    if (body.type && !validTypes.includes(body.type)) {
      return c.json({ error: "无效的字段类型" }, 400);
    }

    const updated: Property = {
      ...existing,
      name: body.name !== undefined ? body.name : existing.name,
      type: body.type !== undefined ? body.type : existing.type,
      component_id: newComponentId,
      dimension_id: body.dimension_id !== undefined
        ? (body.dimension_id || null)
        : existing.dimension_id,
      description: body.description !== undefined
        ? body.description
        : existing.description,
      is_join_key: body.is_join_key !== undefined
        ? body.is_join_key
        : existing.is_join_key,
      join_key_target: body.join_key_target !== undefined
        ? body.join_key_target
        : existing.join_key_target,
      updated_at: now(),
    };

    await kv.set(KEYS.property(id), updated);

    return c.json({ data: updated });
  } catch (error) {
    console.error("更新字段失败:", error);
    return c.json({ error: "更新字段失败" }, 500);
  }
});

// DELETE /properties/:id - 删除字段
app.delete("/:id", async (c) => {
  try {
    const id = c.req.param("id");

    // 获取现有字段
    const existing: Property | null = await kv.get(KEYS.property(id));
    if (!existing) {
      return c.json({ error: "字段不存在" }, 404);
    }

    // 从组件的字段列表中移除
    const componentPropsKey = KEYS.componentProperties(existing.component_id);
    const componentProps: string[] = await kv.get(componentPropsKey) || [];
    await kv.set(
      componentPropsKey,
      componentProps.filter((pid) => pid !== id)
    );

    // 从总列表中移除
    const list: string[] = await kv.get(KEYS.propertyList()) || [];
    await kv.set(KEYS.propertyList(), list.filter((pid) => pid !== id));

    // 删除字段数据
    await kv.del(KEYS.property(id));

    return c.json({ message: "删除成功" });
  } catch (error) {
    console.error("删除字段失败:", error);
    return c.json({ error: "删除字段失败" }, 500);
  }
});

export default app;
