import { Hono } from "npm:hono";
import * as kv from "./kv_store.ts";

const app = new Hono();

// Category 类型定义
interface Category {
  id: string;
  name: string;
  code: string;
  parent_id?: string | null;
  path: string;
  level: number;
  order: number;
  description?: string;
  created_at: string;
  updated_at: string;
}

// 生成唯一ID
const generateId = () => crypto.randomUUID();

// 获取当前时间戳
const now = () => new Date().toISOString();

// KV键名生成器
const KEYS = {
  category: (id: string) => `category:${id}`,
  categoryChildren: (parentId: string | null) =>
    parentId ? `category:children:${parentId}` : `category:children:root`,
  categoryCodeIndex: (code: string) => `category:code:${code}`,
  categoryList: () => "category:list",
};

// GET /categories - 获取分类列表
app.get("/", async (c) => {
  try {
    const search = c.req.query("search");
    const parentId = c.req.query("parent_id");

    // 获取所有分类
    const categories: Category[] = await kv.getByPrefix("category:") || [];
    let result = categories.filter((cat: Category) =>
      cat && cat.id && !cat.id.includes(":") // 过滤掉非实体数据
    );

    // 按父分类筛选
    if (parentId !== undefined) {
      const targetParentId = parentId || null;
      result = result.filter((cat: Category) =>
        (cat.parent_id || null) === targetParentId
      );
    }

    // 搜索过滤
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter((cat: Category) =>
        cat.name.toLowerCase().includes(searchLower) ||
        cat.code.toLowerCase().includes(searchLower)
      );
    }

    // 按path和order排序
    result.sort((a: Category, b: Category) => {
      if (a.path !== b.path) return a.path.localeCompare(b.path);
      return a.order - b.order;
    });

    return c.json({ data: result });
  } catch (error) {
    console.error("获取分类列表失败:", error);
    return c.json({ error: "获取分类列表失败" }, 500);
  }
});

// GET /categories/tree - 获取分类树形结构
app.get("/tree", async (c) => {
  try {
    // 获取所有分类
    const categories: Category[] = await kv.getByPrefix("category:") || [];
    const validCategories = categories.filter((cat: Category) =>
      cat && cat.id && !cat.id.includes(":")
    );

    // 构建树形结构
    const buildTree = (parentId: string | null = null): any[] => {
      return validCategories
        .filter((cat: Category) => (cat.parent_id || null) === parentId)
        .sort((a: Category, b: Category) => a.order - b.order)
        .map((cat: Category) => ({
          ...cat,
          children: buildTree(cat.id),
        }));
    };

    const tree = buildTree();
    return c.json({ data: tree });
  } catch (error) {
    console.error("获取分类树失败:", error);
    return c.json({ error: "获取分类树失败" }, 500);
  }
});

// GET /categories/:id - 获取单个分类详情
app.get("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const category: Category | null = await kv.get(KEYS.category(id));

    if (!category) {
      return c.json({ error: "分类不存在" }, 404);
    }

    return c.json({ data: category });
  } catch (error) {
    console.error("获取分类详情失败:", error);
    return c.json({ error: "获取分类详情失败" }, 500);
  }
});

// POST /categories - 创建分类
app.post("/", async (c) => {
  try {
    const body = await c.req.json();

    // 验证必填字段
    if (!body.name || !body.code) {
      return c.json({ error: "分类名称和编码为必填项" }, 400);
    }

    // 检查编码是否已存在
    const existingId = await kv.get(KEYS.categoryCodeIndex(body.code));
    if (existingId) {
      return c.json({ error: "分类编码已存在" }, 409);
    }

    const id = generateId();
    const parentId = body.parent_id || null;

    // 计算path和level
    let path = `/${id}/`;
    let level = 0;

    if (parentId) {
      const parent: Category | null = await kv.get(KEYS.category(parentId));
      if (!parent) {
        return c.json({ error: "父分类不存在" }, 400);
      }
      path = `${parent.path}${id}/`;
      level = parent.level + 1;
    }

    const category: Category = {
      id,
      name: body.name,
      code: body.code,
      parent_id: parentId,
      path,
      level,
      order: body.order || 0,
      description: body.description || undefined,
      created_at: now(),
      updated_at: now(),
    };

    // 保存分类数据
    await kv.set(KEYS.category(id), category);

    // 更新编码索引
    await kv.set(KEYS.categoryCodeIndex(body.code), id);

    // 更新父分类的子分类列表
    if (parentId) {
      const childrenKey = KEYS.categoryChildren(parentId);
      const children: string[] = await kv.get(childrenKey) || [];
      children.push(id);
      await kv.set(childrenKey, children);
    } else {
      const rootChildrenKey = KEYS.categoryChildren(null);
      const children: string[] = await kv.get(rootChildrenKey) || [];
      children.push(id);
      await kv.set(rootChildrenKey, children);
    }

    // 更新总列表
    const list: string[] = await kv.get(KEYS.categoryList()) || [];
    list.push(id);
    await kv.set(KEYS.categoryList(), list);

    return c.json({ data: category }, 201);
  } catch (error) {
    console.error("创建分类失败:", error);
    return c.json({ error: "创建分类失败" }, 500);
  }
});

// PUT /categories/:id - 更新分类
app.put("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();

    // 获取现有分类
    const existing: Category | null = await kv.get(KEYS.category(id));
    if (!existing) {
      return c.json({ error: "分类不存在" }, 404);
    }

    // 如果修改编码，检查新编码是否已存在
    if (body.code && body.code !== existing.code) {
      const existingId = await kv.get(KEYS.categoryCodeIndex(body.code));
      if (existingId && existingId !== id) {
        return c.json({ error: "分类编码已存在" }, 409);
      }
      // 更新编码索引
      await kv.del(KEYS.categoryCodeIndex(existing.code));
      await kv.set(KEYS.categoryCodeIndex(body.code), id);
    }

    // 如果修改父分类，需要更新path和level
    let path = existing.path;
    let level = existing.level;
    const oldParentId = existing.parent_id;
    const newParentId = body.parent_id !== undefined
      ? (body.parent_id || null)
      : oldParentId;

    if (newParentId !== oldParentId) {
      // 检查是否移动到自己或其子分类下
      if (newParentId === id) {
        return c.json({ error: "不能将分类移动到自己下方" }, 400);
      }

      // 检查是否移动到自己的子分类下
      if (newParentId && existing.path.split("/").includes(newParentId)) {
        return c.json({ error: "不能将分类移动到自己的子分类下方" }, 400);
      }

      if (newParentId) {
        const parent: Category | null = await kv.get(KEYS.category(newParentId));
        if (!parent) {
          return c.json({ error: "父分类不存在" }, 400);
        }
        path = `${parent.path}${id}/`;
        level = parent.level + 1;
      } else {
        path = `/${id}/`;
        level = 0;
      }

      // 更新旧父分类的子列表
      if (oldParentId) {
        const oldChildrenKey = KEYS.categoryChildren(oldParentId);
        const oldChildren: string[] = await kv.get(oldChildrenKey) || [];
        await kv.set(
          oldChildrenKey,
          oldChildren.filter((cid) => cid !== id),
        );
      } else {
        const rootChildrenKey = KEYS.categoryChildren(null);
        const rootChildren: string[] = await kv.get(rootChildrenKey) || [];
        await kv.set(
          rootChildrenKey,
          rootChildren.filter((cid) => cid !== id),
        );
      }

      // 更新新父分类的子列表
      if (newParentId) {
        const newChildrenKey = KEYS.categoryChildren(newParentId);
        const newChildren: string[] = await kv.get(newChildrenKey) || [];
        newChildren.push(id);
        await kv.set(newChildrenKey, newChildren);
      } else {
        const rootChildrenKey = KEYS.categoryChildren(null);
        const rootChildren: string[] = await kv.get(rootChildrenKey) || [];
        rootChildren.push(id);
        await kv.set(rootChildrenKey, rootChildren);
      }

      // 更新所有子分类的path和level
      await updateDescendantsPath(id, path, level);
    }

    const updated: Category = {
      ...existing,
      name: body.name !== undefined ? body.name : existing.name,
      code: body.code !== undefined ? body.code : existing.code,
      parent_id: newParentId,
      path,
      level,
      order: body.order !== undefined ? body.order : existing.order,
      description: body.description !== undefined
        ? body.description
        : existing.description,
      updated_at: now(),
    };

    await kv.set(KEYS.category(id), updated);

    return c.json({ data: updated });
  } catch (error) {
    console.error("更新分类失败:", error);
    return c.json({ error: "更新分类失败" }, 500);
  }
});

// DELETE /categories/:id - 删除分类
app.delete("/:id", async (c) => {
  try {
    const id = c.req.param("id");

    // 获取现有分类
    const existing: Category | null = await kv.get(KEYS.category(id));
    if (!existing) {
      return c.json({ error: "分类不存在" }, 404);
    }

    // 检查是否有子分类
    const childrenKey = KEYS.categoryChildren(id);
    const children: string[] = await kv.get(childrenKey) || [];
    if (children.length > 0) {
      return c.json({ error: "请先删除该分类下的所有子分类" }, 409);
    }

    // 从父分类的子列表中移除
    if (existing.parent_id) {
      const parentChildrenKey = KEYS.categoryChildren(existing.parent_id);
      const parentChildren: string[] = await kv.get(parentChildrenKey) || [];
      await kv.set(
        parentChildrenKey,
        parentChildren.filter((cid) => cid !== id),
      );
    } else {
      const rootChildrenKey = KEYS.categoryChildren(null);
      const rootChildren: string[] = await kv.get(rootChildrenKey) || [];
      await kv.set(
        rootChildrenKey,
        rootChildren.filter((cid) => cid !== id),
      );
    }

    // 删除编码索引
    await kv.del(KEYS.categoryCodeIndex(existing.code));

    // 删除子分类列表键
    await kv.del(childrenKey);

    // 从总列表中移除
    const list: string[] = await kv.get(KEYS.categoryList()) || [];
    await kv.set(KEYS.categoryList(), list.filter((cid) => cid !== id));

    // 删除分类数据
    await kv.del(KEYS.category(id));

    return c.json({ message: "删除成功" });
  } catch (error) {
    console.error("删除分类失败:", error);
    return c.json({ error: "删除分类失败" }, 500);
  }
});

// POST /categories/:id/move - 移动分类（快捷方式）
app.post("/:id/move", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const newParentId = body.new_parent_id;

    // 获取现有分类
    const existing: Category | null = await kv.get(KEYS.category(id));
    if (!existing) {
      return c.json({ error: "分类不存在" }, 404);
    }

    // 参数与 PUT /:id 保持一致进行处理
    return c.json({
      message: "请使用 PUT /categories/:id 端点并设置 parent_id 字段来移动分类",
    }, 400);
  } catch (error) {
    console.error("移动分类失败:", error);
    return c.json({ error: "移动分类失败" }, 500);
  }
});

// 辅助函数：递归更新子分类的path和level
async function updateDescendantsPath(
  parentId: string,
  parentPath: string,
  parentLevel: number,
) {
  const childrenKey = KEYS.categoryChildren(parentId);
  const children: string[] = await kv.get(childrenKey) || [];

  for (const childId of children) {
    const child: Category | null = await kv.get(KEYS.category(childId));
    if (child) {
      const newPath = `${parentPath}${childId}/`;
      const newLevel = parentLevel + 1;

      await kv.set(KEYS.category(childId), {
        ...child,
        path: newPath,
        level: newLevel,
        updated_at: now(),
      });

      // 递归更新子分类的子分类
      await updateDescendantsPath(childId, newPath, newLevel);
    }
  }
}

export default app;
