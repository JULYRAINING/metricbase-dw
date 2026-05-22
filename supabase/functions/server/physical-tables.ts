import { Hono } from "npm:hono";
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";

const app = new Hono();

// 获取Supabase客户端
const getSupabase = () => createClient(
  Deno.env.get("SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
);

// 有效的表类型
const VALID_TABLE_TYPES = ['dimension', 'fact'] as const;
type TableType = typeof VALID_TABLE_TYPES[number];

// 有效的字段类型
const VALID_FIELD_TYPES = ['int', 'string', 'date', 'datetime', 'decimal', 'boolean'] as const;
type FieldType = typeof VALID_FIELD_TYPES[number];

// 有效的字段角色
const VALID_FIELD_ROLES = ['dimension_key', 'measure', 'attribute'] as const;
type FieldRole = typeof VALID_FIELD_ROLES[number];

// GET /physical-tables - 获取物理表列表（支持 table_type 筛选和搜索）
app.get("/", async (c) => {
  const supabase = getSupabase();
  const search = c.req.query("search");
  const tableType = c.req.query("table_type");

  let query = supabase
    .from("physical_tables")
    .select(`
      id,
      name,
      code,
      table_type,
      description,
      created_at,
      updated_at
    `)
    .order("created_at", { ascending: false });

  // 按 table_type 筛选
  if (tableType && VALID_TABLE_TYPES.includes(tableType as TableType)) {
    query = query.eq("table_type", tableType);
  }

  // 按名称或编码搜索
  if (search) {
    query = query.or(`name.ilike.%${search}%,code.ilike.%${search}%`);
  }

  const { data, error } = await query;

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  return c.json({ data: data || [] });
});

// GET /physical-tables/:id - 获取物理表详情（含字段列表）
app.get("/:id", async (c) => {
  const supabase = getSupabase();
  const id = c.req.param("id");

  // 获取物理表基本信息
  const { data: table, error: tableError } = await supabase
    .from("physical_tables")
    .select(`
      id,
      name,
      code,
      table_type,
      description,
      created_at,
      updated_at
    `)
    .eq("id", id)
    .single();

  if (tableError) {
    if (tableError.code === "PGRST116") {
      return c.json({ error: "物理表不存在" }, 404);
    }
    return c.json({ error: tableError.message }, 500);
  }

  // 获取关联的字段列表
  const { data: fields, error: fieldsError } = await supabase
    .from("fields")
    .select(`
      id,
      name,
      type,
      field_role,
      table_id,
      dimension_ref_id,
      description,
      is_join_key,
      join_key_target,
      created_at,
      updated_at
    `)
    .eq("table_id", id)
    .order("created_at", { ascending: true });

  if (fieldsError) {
    return c.json({ error: fieldsError.message }, 500);
  }

  return c.json({
    data: {
      ...table,
      fields: fields || []
    }
  });
});

// POST /physical-tables - 创建物理表
app.post("/", async (c) => {
  const supabase = getSupabase();
  const body = await c.req.json();

  // 验证必填字段
  if (!body.name || !body.code) {
    return c.json({ error: "名称和编码为必填项" }, 400);
  }

  // 验证 table_type
  if (!body.table_type || !VALID_TABLE_TYPES.includes(body.table_type)) {
    return c.json({ error: `table_type 必须是 ${VALID_TABLE_TYPES.join(' 或 ')}` }, 400);
  }

  // 创建物理表
  const { data, error } = await supabase
    .from("physical_tables")
    .insert({
      name: body.name,
      code: body.code,
      table_type: body.table_type,
      description: body.description || null,
    })
    .select()
    .single();

  if (error) {
    if (error.message.includes("unique constraint") || error.code === "23505") {
      return c.json({ error: "物理表编码已存在" }, 409);
    }
    return c.json({ error: error.message }, 500);
  }

  // 如果提供了字段列表，一并创建
  if (body.fields && Array.isArray(body.fields) && body.fields.length > 0) {
    const fieldsToInsert = body.fields.map((field: Record<string, unknown>) => ({
      name: field.name,
      type: field.type || 'string',
      field_role: field.field_role || 'attribute',
      table_id: data.id,
      dimension_ref_id: field.dimension_ref_id || null,
      description: field.description || null,
      is_join_key: field.is_join_key || false,
      join_key_target: field.join_key_target || null,
    }));

    // 验证字段
    for (const field of fieldsToInsert) {
      if (!field.name) {
        return c.json({ error: "字段名称为必填项" }, 400);
      }
      if (!VALID_FIELD_TYPES.includes(field.type as FieldType)) {
        return c.json({ error: `字段类型必须是 ${VALID_FIELD_TYPES.join(', ')}` }, 400);
      }
      if (!VALID_FIELD_ROLES.includes(field.field_role as FieldRole)) {
        return c.json({ error: `字段角色必须是 ${VALID_FIELD_ROLES.join(', ')}` }, 400);
      }
    }

    const { data: insertedFields, error: fieldsError } = await supabase
      .from("fields")
      .insert(fieldsToInsert)
      .select();

    if (fieldsError) {
      // 字段插入失败，删除已创建的表（回滚）
      await supabase.from("physical_tables").delete().eq("id", data.id);
      return c.json({ error: `字段创建失败: ${fieldsError.message}` }, 500);
    }

    return c.json({ data: { ...data, fields: insertedFields } }, 201);
  }

  return c.json({ data: { ...data, fields: [] } }, 201);
});

// PUT /physical-tables/:id - 更新物理表基本信息
app.put("/:id", async (c) => {
  const supabase = getSupabase();
  const id = c.req.param("id");
  const body = await c.req.json();

  const updateData: Record<string, unknown> = {};
  if (body.name !== undefined) updateData.name = body.name;
  if (body.code !== undefined) updateData.code = body.code;
  if (body.description !== undefined) updateData.description = body.description;
  if (body.table_type !== undefined) {
    if (!VALID_TABLE_TYPES.includes(body.table_type)) {
      return c.json({ error: `table_type 必须是 ${VALID_TABLE_TYPES.join(' 或 ')}` }, 400);
    }
    updateData.table_type = body.table_type;
  }

  const { data, error } = await supabase
    .from("physical_tables")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    if (error.message.includes("unique constraint") || error.code === "23505") {
      return c.json({ error: "物理表编码已存在" }, 409);
    }
    return c.json({ error: error.message }, 500);
  }

  if (!data) {
    return c.json({ error: "物理表不存在" }, 404);
  }

  return c.json({ data });
});

// DELETE /physical-tables/:id - 删除物理表（需检查引用）
app.delete("/:id", async (c) => {
  const supabase = getSupabase();
  const id = c.req.param("id");

  // 检查物理表是否存在
  const { data: table, error: tableError } = await supabase
    .from("physical_tables")
    .select("id, name, code, table_type")
    .eq("id", id)
    .single();

  if (tableError || !table) {
    return c.json({ error: "物理表不存在" }, 404);
  }

  // 检查是否被 fields 表引用（作为 dimension_ref_id）
  const { data: referencingFields, error: refError } = await supabase
    .from("fields")
    .select("id, name, table_id")
    .eq("dimension_ref_id", id);

  if (refError) {
    return c.json({ error: refError.message }, 500);
  }

  if (referencingFields && referencingFields.length > 0) {
    // 获取引用此表的其他表名称
    const referencingTableIds = [...new Set(referencingFields.map(f => f.table_id))];
    const { data: referencingTables } = await supabase
      .from("physical_tables")
      .select("id, name, code")
      .in("id", referencingTableIds);

    return c.json({
      error: `该物理表正在被 ${referencingFields.length} 个字段引用，无法删除`,
      references: referencingTables || []
    }, 409);
  }

  // 检查是否被 metrics 表引用（作为 source）
  const { data: metrics, error: metricsError } = await supabase
    .from("metrics")
    .select("id, name")
    .eq("source", id);

  if (metricsError) {
    return c.json({ error: metricsError.message }, 500);
  }

  if (metrics && metrics.length > 0) {
    return c.json({
      error: `该物理表正在被 ${metrics.length} 个指标引用，无法删除`,
      references: metrics
    }, 409);
  }

  // 检查是否被其他表的 dims 数组引用（针对事实表，检查 dims 列）
  if (table.table_type === 'dimension') {
    // 获取所有事实表
    const { data: factTables, error: factError } = await supabase
      .from("fact_tables")
      .select("id, name, dims");

    if (factError) {
      return c.json({ error: factError.message }, 500);
    }

    // 检查 dims 数组中是否包含此维度的 code
    const referencingFactTables = factTables?.filter(ft =>
      ft.dims && ft.dims.includes(table.code)
    ) || [];

    if (referencingFactTables.length > 0) {
      return c.json({
        error: `该维度表正在被 ${referencingFactTables.length} 个事实表引用，无法删除`,
        references: referencingFactTables
      }, 409);
    }
  }

  // 执行删除（fields 会通过 ON DELETE CASCADE 自动删除）
  const { error: deleteError } = await supabase
    .from("physical_tables")
    .delete()
    .eq("id", id);

  if (deleteError) {
    return c.json({ error: deleteError.message }, 500);
  }

  return c.json({ message: "删除成功" });
});

export default app;