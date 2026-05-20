import { Hono } from "npm:hono";
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";

const app = new Hono();

// 获取Supabase客户端
const getSupabase = () => createClient(
  Deno.env.get("SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
);

// GET /fact-tables - 获取事实表列表（支持搜索）
app.get("/", async (c) => {
  const supabase = getSupabase();
  const search = c.req.query("search");

  let query = supabase
    .from("fact_tables")
    .select("*")
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

// POST /fact-tables - 创建事实表
app.post("/", async (c) => {
  const supabase = getSupabase();
  const body = await c.req.json();

  // 验证必填字段
  if (!body.name || !body.code) {
    return c.json({ error: "名称和编码为必填项" }, 400);
  }

  const { data, error } = await supabase
    .from("fact_tables")
    .insert({
      name: body.name,
      code: body.code,
      description: body.description || null,
      dims: body.dims || [],
      measures: body.measures || [],
    })
    .select()
    .single();

  if (error) {
    if (error.message.includes("unique constraint")) {
      return c.json({ error: "事实表编码已存在" }, 409);
    }
    return c.json({ error: error.message }, 500);
  }

  return c.json({ data }, 201);
});

// PUT /fact-tables/:id - 更新事实表
app.put("/:id", async (c) => {
  const supabase = getSupabase();
  const id = c.req.param("id");
  const body = await c.req.json();

  const updateData: Record<string, unknown> = {};
  if (body.name !== undefined) updateData.name = body.name;
  if (body.code !== undefined) updateData.code = body.code;
  if (body.description !== undefined) updateData.description = body.description;
  if (body.dims !== undefined) updateData.dims = body.dims;
  if (body.measures !== undefined) updateData.measures = body.measures;

  const { data, error } = await supabase
    .from("fact_tables")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    if (error.message.includes("unique constraint")) {
      return c.json({ error: "事实表编码已存在" }, 409);
    }
    return c.json({ error: error.message }, 500);
  }

  if (!data) {
    return c.json({ error: "事实表不存在" }, 404);
  }

  return c.json({ data });
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

  const { error } = await supabase
    .from("fact_tables")
    .delete()
    .eq("id", id);

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  return c.json({ message: "删除成功" });
});

export default app;
