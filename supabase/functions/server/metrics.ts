import { Hono } from "npm:hono";
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";

const app = new Hono();

// 获取Supabase客户端
const getSupabase = () => createClient(
  Deno.env.get("SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
);

// 支持的指标类型
const VALID_METRIC_TYPES = ['atomic', 'derived', 'composite'];

// 支持的聚合方式
const VALID_AGG_TYPES = ['SUM', 'COUNT', 'COUNT_DISTINCT', 'MAX', 'MIN'];

// 验证指标数据
function validateMetric(body: Record<string, unknown>): string | null {
  if (!body.name) {
    return "指标名称为必填项";
  }

  if (!body.type || !VALID_METRIC_TYPES.includes(body.type as string)) {
    return "指标类型必须为 atomic、derived 或 composite";
  }

  const type = body.type as string;

  // 根据类型验证必填字段
  switch (type) {
    case 'atomic':
      if (!body.source) return "原子指标必须指定来源事实表";
      if (!body.measure) return "原子指标必须指定度量字段";
      if (!body.agg || !VALID_AGG_TYPES.includes(body.agg as string)) {
        return "原子指标必须指定有效的聚合方式(SUM/COUNT/COUNT_DISTINCT/MAX/MIN)";
      }
      break;

    case 'derived':
      if (!body.source) return "衍生指标必须指定来源原子指标";
      if (!body.condition) return "衍生指标必须指定业务限定条件";
      break;

    case 'composite':
      if (!body.formula) return "复合指标必须指定计算公式";
      if (!body.base_metrics || !Array.isArray(body.base_metrics) || body.base_metrics.length < 1) {
        return "复合指标必须指定至少一个依赖的基础指标";
      }
      break;
  }

  return null;
}

// GET /metrics - 获取指标列表（支持类型过滤和搜索）
app.get("/", async (c) => {
  const supabase = getSupabase();
  const type = c.req.query("type");
  const search = c.req.query("search");

  let query = supabase
    .from("metrics")
    .select("*")
    .order("created_at", { ascending: false });

  if (type && VALID_METRIC_TYPES.includes(type)) {
    query = query.eq("type", type);
  }

  if (search) {
    query = query.or(`name.ilike.%${search}%`);
  }

  const { data, error } = await query;

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  return c.json({ data: data || [] });
});

// POST /metrics - 创建指标
app.post("/", async (c) => {
  const supabase = getSupabase();
  const body = await c.req.json();

  // 验证数据
  const validationError = validateMetric(body);
  if (validationError) {
    return c.json({ error: validationError }, 400);
  }

  const insertData: Record<string, unknown> = {
    name: body.name,
    type: body.type,
    dims: body.dims || [],
  };

  // 根据类型添加特定字段
  switch (body.type) {
    case 'atomic':
      insertData.source = body.source;
      insertData.measure = body.measure;
      insertData.agg = body.agg;
      break;

    case 'derived':
      insertData.source = body.source;
      insertData.condition = body.condition;
      break;

    case 'composite':
      insertData.formula = body.formula;
      insertData.base_metrics = body.base_metrics || [];
      break;
  }

  const { data, error } = await supabase
    .from("metrics")
    .insert(insertData)
    .select()
    .single();

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  return c.json({ data }, 201);
});

// PUT /metrics/:id - 更新指标
app.put("/:id", async (c) => {
  const supabase = getSupabase();
  const id = c.req.param("id");
  const body = await c.req.json();

  const updateData: Record<string, unknown> = {};

  if (body.name !== undefined) updateData.name = body.name;
  if (body.dims !== undefined) updateData.dims = body.dims;

  // 如果更新类型，需要重新验证
  if (body.type !== undefined) {
    const validationError = validateMetric({ ...body, name: body.name || 'temp' });
    if (validationError) {
      return c.json({ error: validationError }, 400);
    }
    updateData.type = body.type;
  }

  // 根据类型更新特定字段
  if (body.type === 'atomic' || (!body.type)) {
    if (body.source !== undefined) updateData.source = body.source;
    if (body.measure !== undefined) updateData.measure = body.measure;
    if (body.agg !== undefined) updateData.agg = body.agg;
    // 清除其他类型字段
    if (body.type === 'atomic') {
      updateData.condition = null;
      updateData.formula = null;
      updateData.base_metrics = [];
    }
  }

  if (body.type === 'derived' || (!body.type)) {
    if (body.source !== undefined) updateData.source = body.source;
    if (body.condition !== undefined) updateData.condition = body.condition;
    if (body.type === 'derived') {
      updateData.measure = null;
      updateData.agg = null;
      updateData.formula = null;
      updateData.base_metrics = [];
    }
  }

  if (body.type === 'composite' || (!body.type)) {
    if (body.formula !== undefined) updateData.formula = body.formula;
    if (body.base_metrics !== undefined) updateData.base_metrics = body.base_metrics;
    if (body.type === 'composite') {
      updateData.source = null;
      updateData.measure = null;
      updateData.agg = null;
      updateData.condition = null;
    }
  }

  const { data, error } = await supabase
    .from("metrics")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  if (!data) {
    return c.json({ error: "指标不存在" }, 404);
  }

  return c.json({ data });
});

// DELETE /metrics/:id - 删除指标
app.delete("/:id", async (c) => {
  const supabase = getSupabase();
  const id = c.req.param("id");

  // 检查是否被衍生指标引用
  const { data: derivedMetrics, error: derivedCheckError } = await supabase
    .from("metrics")
    .select("id, name")
    .eq("type", "derived")
    .eq("source", id);

  if (derivedCheckError) {
    return c.json({ error: derivedCheckError.message }, 500);
  }

  if (derivedMetrics && derivedMetrics.length > 0) {
    return c.json({
      error: `该指标正在被 ${derivedMetrics.length} 个衍生指标引用，无法删除`,
      references: derivedMetrics
    }, 409);
  }

  // 检查是否被复合指标引用
  const { data: compositeMetrics, error: compositeCheckError } = await supabase
    .from("metrics")
    .select("id, name")
    .eq("type", "composite")
    .contains("base_metrics", [id]);

  if (compositeCheckError) {
    return c.json({ error: compositeCheckError.message }, 500);
  }

  if (compositeMetrics && compositeMetrics.length > 0) {
    return c.json({
      error: `该指标正在被 ${compositeMetrics.length} 个复合指标引用，无法删除`,
      references: compositeMetrics
    }, 409);
  }

  const { error } = await supabase
    .from("metrics")
    .delete()
    .eq("id", id);

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  return c.json({ message: "删除成功" });
});

export default app;
