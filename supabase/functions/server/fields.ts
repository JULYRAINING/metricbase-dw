import { Hono } from "npm:hono";
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";

const app = new Hono();

// 获取Supabase客户端
const getSupabase = () => createClient(
  Deno.env.get("SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
);

// 有效的字段类型
const VALID_FIELD_TYPES = ['int', 'string', 'date', 'datetime', 'decimal', 'boolean'] as const;
type FieldType = typeof VALID_FIELD_TYPES[number];

// 有效的字段角色
const VALID_FIELD_ROLES = ['dimension_key', 'measure', 'attribute'] as const;
type FieldRole = typeof VALID_FIELD_ROLES[number];

// Field 类型定义
interface Field {
  id: string;
  name: string;
  type: FieldType;
  field_role: FieldRole;
  table_id: string;
  dimension_ref_id?: string | null;
  description?: string | null;
  is_join_key: boolean;
  join_key_target?: string | null;
  created_at: string;
  updated_at: string;
}

// 创建字段请求体
interface CreateFieldRequest {
  name: string;
  type?: FieldType;
  field_role?: FieldRole;
  table_id: string;
  dimension_ref_id?: string | null;
  description?: string | null;
  is_join_key?: boolean;
  join_key_target?: string | null;
}

// 批量创建字段请求体
interface BatchCreateFieldsRequest {
  table_id: string;
  fields: Omit<CreateFieldRequest, 'table_id'>[];
}

// 更新字段请求体
interface UpdateFieldRequest {
  name?: string;
  type?: FieldType;
  field_role?: FieldRole;
  table_id?: string;
  dimension_ref_id?: string | null;
  description?: string | null;
  is_join_key?: boolean;
  join_key_target?: string | null;
}

// 验证字段数据
const validateField = (field: Partial<CreateFieldRequest>): { valid: boolean; error?: string } => {
  if (!field.name || typeof field.name !== 'string' || field.name.trim() === '') {
    return { valid: false, error: "字段名称为必填项" };
  }

  if (field.type && !VALID_FIELD_TYPES.includes(field.type)) {
    return { valid: false, error: `字段类型必须是 ${VALID_FIELD_TYPES.join(', ')}` };
  }

  if (field.field_role && !VALID_FIELD_ROLES.includes(field.field_role)) {
    return { valid: false, error: `字段角色必须是 ${VALID_FIELD_ROLES.join(', ')}` };
  }

  // 维度引用验证
  if (field.dimension_ref_id && typeof field.dimension_ref_id !== 'string') {
    return { valid: false, error: "dimension_ref_id 必须是有效的字符串" };
  }

  // join_key 和 join_key_target 的关联验证
  if (field.is_join_key === true && !field.join_key_target) {
    return { valid: false, error: "当 is_join_key 为 true 时，join_key_target 为必填项" };
  }

  return { valid: true };
};

// 验证维度引用是否存在
const validateDimensionRef = async (supabase: ReturnType<typeof getSupabase>, dimensionRefId: string): Promise<{ valid: boolean; error?: string }> => {
  const { data: refTable, error: refError } = await supabase
    .from("physical_tables")
    .select("id, table_type")
    .eq("id", dimensionRefId)
    .single();

  if (refError || !refTable) {
    return { valid: false, error: "引用的维度表不存在" };
  }

  if (refTable.table_type !== 'dimension') {
    return { valid: false, error: "dimension_ref_id 必须引用维度表" };
  }

  return { valid: true };
};

// 验证表是否存在
const validateTableExists = async (supabase: ReturnType<typeof getSupabase>, tableId: string): Promise<{ valid: boolean; error?: string }> => {
  const { data: table, error: tableError } = await supabase
    .from("physical_tables")
    .select("id")
    .eq("id", tableId)
    .single();

  if (tableError || !table) {
    return { valid: false, error: "指定的物理表不存在" };
  }

  return { valid: true };
};

// 检查同名字段冲突
const checkDuplicateFieldName = async (
  supabase: ReturnType<typeof getSupabase>,
  tableId: string,
  fieldName: string,
  excludeFieldId?: string
): Promise<boolean> => {
  let query = supabase
    .from("fields")
    .select("id")
    .eq("table_id", tableId)
    .eq("name", fieldName);

  if (excludeFieldId) {
    query = query.neq("id", excludeFieldId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.error("检查字段名重复失败:", error);
    return false;
  }

  return data !== null;
};

// GET /fields - 获取字段列表（支持 table_id 筛选）
app.get("/", async (c) => {
  const supabase = getSupabase();
  const tableId = c.req.query("table_id");
  const fieldRole = c.req.query("field_role");
  const search = c.req.query("search");

  let query = supabase
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
    .order("created_at", { ascending: true });

  // 按表ID筛选
  if (tableId) {
    query = query.eq("table_id", tableId);
  }

  // 按字段角色筛选
  if (fieldRole && VALID_FIELD_ROLES.includes(fieldRole as FieldRole)) {
    query = query.eq("field_role", fieldRole);
  }

  // 按名称搜索
  if (search) {
    query = query.ilike("name", `%${search}%`);
  }

  const { data, error } = await query;

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  return c.json({ data: data || [] });
});

// GET /fields/:id - 获取单个字段详情
app.get("/:id", async (c) => {
  const supabase = getSupabase();
  const id = c.req.param("id");

  const { data: field, error } = await supabase
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
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return c.json({ error: "字段不存在" }, 404);
    }
    return c.json({ error: error.message }, 500);
  }

  return c.json({ data: field });
});

// POST /fields - 创建字段
app.post("/", async (c) => {
  const supabase = getSupabase();
  const body: CreateFieldRequest = await c.req.json();

  // 验证必填字段
  if (!body.table_id) {
    return c.json({ error: "table_id 为必填项" }, 400);
  }

  // 验证字段数据
  const validation = validateField(body);
  if (!validation.valid) {
    return c.json({ error: validation.error }, 400);
  }

  // 验证表是否存在
  const tableValidation = await validateTableExists(supabase, body.table_id);
  if (!tableValidation.valid) {
    return c.json({ error: tableValidation.error }, 400);
  }

  // 验证维度引用（如果提供）
  if (body.dimension_ref_id) {
    const refValidation = await validateDimensionRef(supabase, body.dimension_ref_id);
    if (!refValidation.valid) {
      return c.json({ error: refValidation.error }, 400);
    }
  }

  // 检查同名字段冲突
  const isDuplicate = await checkDuplicateFieldName(supabase, body.table_id, body.name);
  if (isDuplicate) {
    return c.json({ error: "该表中已存在同名字段" }, 409);
  }

  // 创建字段
  const { data, error } = await supabase
    .from("fields")
    .insert({
      name: body.name,
      type: body.type || 'string',
      field_role: body.field_role || 'attribute',
      table_id: body.table_id,
      dimension_ref_id: body.dimension_ref_id || null,
      description: body.description || null,
      is_join_key: body.is_join_key || false,
      join_key_target: body.join_key_target || null,
    })
    .select()
    .single();

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  return c.json({ data }, 201);
});

// POST /fields/batch - 批量创建字段
app.post("/batch", async (c) => {
  const supabase = getSupabase();
  const body: BatchCreateFieldsRequest = await c.req.json();

  // 验证必填字段
  if (!body.table_id) {
    return c.json({ error: "table_id 为必填项" }, 400);
  }

  if (!body.fields || !Array.isArray(body.fields) || body.fields.length === 0) {
    return c.json({ error: "fields 数组不能为空" }, 400);
  }

  // 验证表是否存在
  const tableValidation = await validateTableExists(supabase, body.table_id);
  if (!tableValidation.valid) {
    return c.json({ error: tableValidation.error }, 400);
  }

  // 收集所有维度引用ID用于批量验证
  const dimensionRefIds = body.fields
    .map(f => f.dimension_ref_id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);

  // 批量验证维度引用（去重后）
  if (dimensionRefIds.length > 0) {
    const uniqueRefIds = [...new Set(dimensionRefIds)];
    const { data: refTables, error: refError } = await supabase
      .from("physical_tables")
      .select("id, table_type")
      .in("id", uniqueRefIds);

    if (refError) {
      return c.json({ error: refError.message }, 500);
    }

    // 检查所有引用是否有效
    const validRefs = new Set(refTables?.filter(t => t.table_type === 'dimension').map(t => t.id));
    for (const refId of uniqueRefIds) {
      if (!validRefs.has(refId)) {
        return c.json({ error: `维度引用 ${refId} 无效或不是维度表` }, 400);
      }
    }
  }

  // 验证每个字段
  const fieldsToInsert: Array<{
    name: string;
    type: FieldType;
    field_role: FieldRole;
    table_id: string;
    dimension_ref_id: string | null;
    description: string | null;
    is_join_key: boolean;
    join_key_target: string | null;
  }> = [];

  for (let i = 0; i < body.fields.length; i++) {
    const field = body.fields[i];

    // 添加 table_id 到字段数据中
    const fieldWithTableId = { ...field, table_id: body.table_id };

    const validation = validateField(fieldWithTableId);
    if (!validation.valid) {
      return c.json({ error: `字段 ${i + 1}: ${validation.error}` }, 400);
    }

    fieldsToInsert.push({
      name: field.name,
      type: field.type || 'string',
      field_role: field.field_role || 'attribute',
      table_id: body.table_id,
      dimension_ref_id: field.dimension_ref_id || null,
      description: field.description || null,
      is_join_key: field.is_join_key || false,
      join_key_target: field.join_key_target || null,
    });
  }

  // 检查批量字段内的名称重复
  const fieldNames = fieldsToInsert.map(f => f.name);
  const duplicateNames = fieldNames.filter((name, index) => fieldNames.indexOf(name) !== index);
  if (duplicateNames.length > 0) {
    return c.json({ error: `批量字段中存在重复名称: ${[...new Set(duplicateNames)].join(', ')}` }, 409);
  }

  // 检查与现有字段的名称冲突
  const { data: existingFields, error: existingError } = await supabase
    .from("fields")
    .select("name")
    .eq("table_id", body.table_id)
    .in("name", fieldNames);

  if (existingError) {
    return c.json({ error: existingError.message }, 500);
  }

  if (existingFields && existingFields.length > 0) {
    const conflictNames = existingFields.map(f => f.name).join(', ');
    return c.json({ error: `表中已存在同名字段: ${conflictNames}` }, 409);
  }

  // 批量插入字段
  const { data, error } = await supabase
    .from("fields")
    .insert(fieldsToInsert)
    .select();

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  return c.json({ data, count: data?.length || 0 }, 201);
});

// PUT /fields/:id - 更新字段
app.put("/:id", async (c) => {
  const supabase = getSupabase();
  const id = c.req.param("id");
  const body: UpdateFieldRequest = await c.req.json();

  // 获取现有字段
  const { data: existingField, error: fetchError } = await supabase
    .from("fields")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError) {
    if (fetchError.code === "PGRST116") {
      return c.json({ error: "字段不存在" }, 404);
    }
    return c.json({ error: fetchError.message }, 500);
  }

  // 验证更新数据
  if (body.name !== undefined || body.type !== undefined || body.field_role !== undefined) {
    const validation = validateField({
      name: body.name ?? existingField.name,
      type: body.type ?? existingField.type,
      field_role: body.field_role ?? existingField.field_role,
    });
    if (!validation.valid) {
      return c.json({ error: validation.error }, 400);
    }
  }

  // 如果更新 table_id，验证新表是否存在
  const newTableId = body.table_id ?? existingField.table_id;
  if (body.table_id && body.table_id !== existingField.table_id) {
    const tableValidation = await validateTableExists(supabase, body.table_id);
    if (!tableValidation.valid) {
      return c.json({ error: tableValidation.error }, 400);
    }
  }

  // 如果更新维度引用，验证新引用
  if (body.dimension_ref_id !== undefined && body.dimension_ref_id !== null) {
    const refValidation = await validateDimensionRef(supabase, body.dimension_ref_id);
    if (!refValidation.valid) {
      return c.json({ error: refValidation.error }, 400);
    }
  }

  // 检查名称冲突（如果更新名称或表）
  if (body.name || body.table_id) {
    const newName = body.name ?? existingField.name;
    const checkTableId = body.table_id ?? existingField.table_id;
    const isDuplicate = await checkDuplicateFieldName(supabase, checkTableId, newName, id);
    if (isDuplicate) {
      return c.json({ error: "目标表中已存在同名字段" }, 409);
    }
  }

  // 构建更新数据
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (body.name !== undefined) updateData.name = body.name;
  if (body.type !== undefined) updateData.type = body.type;
  if (body.field_role !== undefined) updateData.field_role = body.field_role;
  if (body.table_id !== undefined) updateData.table_id = body.table_id;
  updateData.dimension_ref_id = body.dimension_ref_id !== undefined
    ? body.dimension_ref_id
    : existingField.dimension_ref_id;
  if (body.description !== undefined) updateData.description = body.description;
  if (body.is_join_key !== undefined) updateData.is_join_key = body.is_join_key;
  updateData.join_key_target = body.join_key_target !== undefined
    ? body.join_key_target
    : existingField.join_key_target;

  // 执行更新
  const { data, error } = await supabase
    .from("fields")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  return c.json({ data });
});

// DELETE /fields/:id - 删除字段
app.delete("/:id", async (c) => {
  const supabase = getSupabase();
  const id = c.req.param("id");

  // 获取现有字段
  const { data: existingField, error: fetchError } = await supabase
    .from("fields")
    .select("id, name, table_id, field_role")
    .eq("id", id)
    .single();

  if (fetchError) {
    if (fetchError.code === "PGRST116") {
      return c.json({ error: "字段不存在" }, 404);
    }
    return c.json({ error: fetchError.message }, 500);
  }

  // 检查字段是否被引用（作为 join_key_target）
  const { data: referencingFields, error: refError } = await supabase
    .from("fields")
    .select("id, name, table_id")
    .eq("join_key_target", id);

  if (refError) {
    return c.json({ error: refError.message }, 500);
  }

  if (referencingFields && referencingFields.length > 0) {
    return c.json({
      error: `该字段正在被 ${referencingFields.length} 个字段作为 join_key_target 引用，无法删除`,
      references: referencingFields
    }, 409);
  }

  // 执行删除
  const { error: deleteError } = await supabase
    .from("fields")
    .delete()
    .eq("id", id);

  if (deleteError) {
    return c.json({ error: deleteError.message }, 500);
  }

  return c.json({ message: "删除成功" });
});

// DELETE /fields/batch - 批量删除字段
app.delete("/batch", async (c) => {
  const supabase = getSupabase();
  const body = await c.req.json();

  if (!body.ids || !Array.isArray(body.ids) || body.ids.length === 0) {
    return c.json({ error: "ids 数组不能为空" }, 400);
  }

  // 检查字段是否被引用
  const { data: referencingFields, error: refError } = await supabase
    .from("fields")
    .select("id, name, table_id")
    .in("join_key_target", body.ids);

  if (refError) {
    return c.json({ error: refError.message }, 500);
  }

  if (referencingFields && referencingFields.length > 0) {
    return c.json({
      error: "部分字段正在被其他字段引用，无法删除",
      references: referencingFields
    }, 409);
  }

  // 批量删除
  const { error: deleteError } = await supabase
    .from("fields")
    .delete()
    .in("id", body.ids);

  if (deleteError) {
    return c.json({ error: deleteError.message }, 500);
  }

  return c.json({ message: "批量删除成功", count: body.ids.length });
});

export default app;
