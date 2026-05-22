import { Hono } from "npm:hono";
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";

const app = new Hono();

// 获取Supabase客户端
const getSupabase = () => createClient(
  Deno.env.get("SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
);

// 添加废弃警告 header 的中间件
app.use("*", async (c, next) => {
  await next();
  c.res.headers.set("X-Deprecated", "true");
  c.res.headers.set("X-Deprecated-Message", "This endpoint is deprecated. Use /physical-tables?table_type=fact instead.");
});

// GET /fact-tables - 获取事实表列表（支持搜索）
// 向后兼容：查询 physical_tables 表，table_type='fact'
app.get("/", async (c) => {
  const supabase = getSupabase();
  const search = c.req.query("search");

  // 查询事实表基本信息
  let query = supabase
    .from("physical_tables")
    .select("id, name, code, description, created_at, updated_at")
    .eq("table_type", "fact")
    .order("created_at", { ascending: false });

  if (search) {
    query = query.or(`name.ilike.%${search}%,code.ilike.%${search}%`);
  }

  const { data: tables, error } = await query;

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  // 为每个表获取其字段（dims 和 measures）
  if (tables && tables.length > 0) {
    const tableIds = tables.map(t => t.id);
    const { data: fields } = await supabase
      .from("fields")
      .select("table_id, name, field_role, dimension_ref_id")
      .in("table_id", tableIds);

    // 将字段映射回表的 dims 和 measures 数组（兼容旧格式）
    const result = tables.map(table => {
      const tableFields = (fields || []).filter(f => f.table_id === table.id);
      const dims = tableFields
        .filter(f => f.field_role === 'dimension_key')
        .map(f => f.name);  // 使用字段名作为维度代码（兼容旧格式）
      const measures = tableFields
        .filter(f => f.field_role === 'measure')
        .map(f => f.name);

      return {
        ...table,
        dims,
        measures
      };
    });

    return c.json({ data: result });
  }

  return c.json({ data: [] });
});

// POST /fact-tables - 创建事实表
// 向后兼容：插入到 physical_tables 并创建字段
app.post("/", async (c) => {
  const supabase = getSupabase();
  const body = await c.req.json();

  // 验证必填字段
  if (!body.name || !body.code) {
    return c.json({ error: "名称和编码为必填项" }, 400);
  }

  // 创建物理表
  const { data: table, error: tableError } = await supabase
    .from("physical_tables")
    .insert({
      name: body.name,
      code: body.code,
      table_type: "fact",
      description: body.description || null,
    })
    .select()
    .single();

  if (tableError) {
    if (tableError.message.includes("unique constraint")) {
      return c.json({ error: "事实表编码已存在" }, 409);
    }
    return c.json({ error: tableError.message }, 500);
  }

  // 创建维度键字段（从 dims 数组）
  const dims = body.dims || [];
  if (dims.length > 0) {
    // 获取维度物理表的 ID（通过 code）
    const { data: dimensionTables } = await supabase
      .from("physical_tables")
      .select("id, code")
      .eq("table_type", "dimension")
      .in("code", dims);

    const dimensionMap = new Map((dimensionTables || []).map(d => [d.code, d.id]));

    const dimensionFields = dims.map(dimCode => ({
      name: dimCode,
      type: 'string',
      field_role: 'dimension_key',
      table_id: table.id,
      dimension_ref_id: dimensionMap.get(dimCode) || null
    }));

    if (dimensionFields.length > 0) {
      await supabase.from("fields").insert(dimensionFields);
    }
  }

  // 创建度量字段（从 measures 数组）
  const measures = body.measures || [];
  if (measures.length > 0) {
    const measureFields = measures.map(m => ({
      name: m,
      type: 'decimal',
      field_role: 'measure',
      table_id: table.id
    }));

    await supabase.from("fields").insert(measureFields);
  }

  // 返回兼容格式
  return c.json({
    data: {
      ...table,
      dims: dims,
      measures: measures
    }
  }, 201);
});

// PUT /fact-tables/:id - 更新事实表
app.put("/:id", async (c) => {
  const supabase = getSupabase();
  const id = c.req.param("id");
  const body = await c.req.json();

  // 更新基本信息
  const updateData: Record<string, unknown> = {};
  if (body.name !== undefined) updateData.name = body.name;
  if (body.code !== undefined) updateData.code = body.code;
  if (body.description !== undefined) updateData.description = body.description;

  if (Object.keys(updateData).length > 0) {
    const { error } = await supabase
      .from("physical_tables")
      .update(updateData)
      .eq("id", id)
      .eq("table_type", "fact");

    if (error) {
      if (error.message.includes("unique constraint")) {
        return c.json({ error: "事实表编码已存在" }, 409);
      }
      return c.json({ error: error.message }, 500);
    }
  }

  // 获取更新后的表信息
  const { data: table } = await supabase
    .from("physical_tables")
    .select("*")
    .eq("id", id)
    .single();

  // 获取字段信息
  const { data: fields } = await supabase
    .from("fields")
    .select("name, field_role")
    .eq("table_id", id);

  const dims = (fields || []).filter(f => f.field_role === 'dimension_key').map(f => f.name);
  const measures = (fields || []).filter(f => f.field_role === 'measure').map(f => f.name);

  return c.json({
    data: {
      ...table,
      dims,
      measures
    }
  });
});

// DELETE /fact-tables/:id - 删除事实表
app.delete("/:id", async (c) => {
  const supabase = getSupabase();
  const id = c.req.param("id");

  // 检查是否被原子指标引用
  const { data: metrics, error: checkError } = await supabase
    .from("metrics")
    .select("id, name")
    .eq("type", "atomic")
    .eq("source", id);

  if (checkError) {
    return c.json({ error: checkError.message }, 500);
  }

  if (metrics && metrics.length > 0) {
    return c.json({
      error: `该事实表正在被 ${metrics.length} 个原子指标引用，无法删除`,
      references: metrics
    }, 409);
  }

  // 删除物理表（字段会级联删除）
  const { error } = await supabase
    .from("physical_tables")
    .delete()
    .eq("id", id)
    .eq("table_type", "fact");

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  return c.json({ message: "删除成功" });
});

export default app;