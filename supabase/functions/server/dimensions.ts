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
  c.res.headers.set("X-Deprecated-Message", "This endpoint is deprecated. Use /physical-tables?table_type=dimension instead.");
});

// GET /dimensions - 获取维度列表（支持搜索）
// 向后兼容：查询 physical_tables 表，table_type='dimension'
app.get("/", async (c) => {
  const supabase = getSupabase();
  const search = c.req.query("search");

  let query = supabase
    .from("physical_tables")
    .select("id, name, code, description, created_at, updated_at")
    .eq("table_type", "dimension")
    .order("created_at", { ascending: false });

  if (search) {
    query = query.or(`name.ilike.%${search}%,code.ilike.%${search}%`);
  }

  const { data, error } = await query;

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  return c.json({ data: data || [] });
});

// POST /dimensions - 创建维度
// 向后兼容：插入到 physical_tables 表
app.post("/", async (c) => {
  const supabase = getSupabase();
  const body = await c.req.json();

  // 验证必填字段
  if (!body.name || !body.code) {
    return c.json({ error: "名称和编码为必填项" }, 400);
  }

  const { data, error } = await supabase
    .from("physical_tables")
    .insert({
      name: body.name,
      code: body.code,
      table_type: "dimension",
      description: body.description || null,
    })
    .select()
    .single();

  if (error) {
    if (error.message.includes("unique constraint")) {
      return c.json({ error: "维度编码已存在" }, 409);
    }
    return c.json({ error: error.message }, 500);
  }

  return c.json({ data }, 201);
});

// PUT /dimensions/:id - 更新维度
app.put("/:id", async (c) => {
  const supabase = getSupabase();
  const id = c.req.param("id");
  const body = await c.req.json();

  const updateData: Record<string, unknown> = {};
  if (body.name !== undefined) updateData.name = body.name;
  if (body.code !== undefined) updateData.code = body.code;
  if (body.description !== undefined) updateData.description = body.description;

  const { data, error } = await supabase
    .from("physical_tables")
    .update(updateData)
    .eq("id", id)
    .eq("table_type", "dimension")
    .select()
    .single();

  if (error) {
    if (error.message.includes("unique constraint")) {
      return c.json({ error: "维度编码已存在" }, 409);
    }
    return c.json({ error: error.message }, 500);
  }

  if (!data) {
    return c.json({ error: "维度不存在" }, 404);
  }

  return c.json({ data });
});

// DELETE /dimensions/:id - 删除维度
app.delete("/:id", async (c) => {
  const supabase = getSupabase();
  const id = c.req.param("id");

  // 检查是否被字段引用（雪花模型）
  const { data: fieldRefs, error: checkError } = await supabase
    .from("fields")
    .select("id, name, table_id")
    .eq("dimension_ref_id", id);

  if (checkError) {
    return c.json({ error: checkError.message }, 500);
  }

  if (fieldRefs && fieldRefs.length > 0) {
    return c.json({
      error: `该维度正在被 ${fieldRefs.length} 个字段引用，无法删除`,
      references: fieldRefs
    }, 409);
  }

  const { error } = await supabase
    .from("physical_tables")
    .delete()
    .eq("id", id)
    .eq("table_type", "dimension");

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  return c.json({ message: "删除成功" });
});

export default app;
