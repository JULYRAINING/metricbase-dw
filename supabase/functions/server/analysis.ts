/**
 * 多维分析 API
 * 提供完整的分析查询接口
 */

import { Hono } from "https://deno.land/x/hono@v3.12.0/mod.ts";
import { QueryEngine, getIndicatorCommonDimensions } from "../query-engine/index.ts";
import { executeQuery, previewSQL, validateSQL } from "../query-engine/executor.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const app = new Hono();

// 查询参数校验
const querySchema = z.object({
  indicator_ids: z.array(z.string()).min(1, "至少选择一个指标"),
  dimension_ids: z.array(z.string()).optional().default([]),
  filters: z.array(
    z.object({
      property_id: z.string(),
      operator: z.string(),
      value: z.unknown(),
    })
  ).optional().default([]),
  order_by: z.string().optional(),
  page: z.number().int().min(1).optional().default(1),
  page_size: z.number().int().min(1).max(1000).optional().default(100),
});

// 公共维度查询参数
const commonDimensionsSchema = z.object({
  indicator_ids: z.array(z.string()).min(1, "至少选择一个指标"),
});

/**
 * POST /analysis/query
 * 执行分析查询
 */
app.post("/query", async (c) => {
  try {
    const body = await c.req.json();
    const result = querySchema.safeParse(body);

    if (!result.success) {
      return c.json({
        success: false,
        error: "参数校验失败",
        details: result.error.format(),
      }, 400);
    }

    const config = result.data;

    // 生成 SQL
    const engine = new QueryEngine();
    const sql = await engine.generateSQL({
      indicatorIds: config.indicator_ids,
      dimensionIds: config.dimension_ids,
      filters: config.filters,
      orderBy: config.order_by,
      page: config.page,
      pageSize: config.page_size,
    });

    if (!sql) {
      return c.json({
        success: false,
        error: "无法生成查询 SQL",
      }, 400);
    }

    // 验证 SQL
    const validation = validateSQL(sql);
    if (!validation.valid) {
      return c.json({
        success: false,
        error: `SQL 验证失败: ${validation.error}`,
      }, 400);
    }

    // 执行查询
    const queryResult = await executeQuery({
      sql,
      page: config.page,
      pageSize: config.page_size,
    });

    return c.json({
      success: true,
      data: queryResult,
    });
  } catch (error) {
    console.error("Query error:", error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : "查询执行失败",
    }, 500);
  }
});

/**
 * POST /analysis/preview-sql
 * 仅预览 SQL，不执行
 */
app.post("/preview-sql", async (c) => {
  try {
    const body = await c.req.json();
    const result = querySchema.safeParse(body);

    if (!result.success) {
      return c.json({
        success: false,
        error: "参数校验失败",
        details: result.error.format(),
      }, 400);
    }

    const config = result.data;

    // 生成 SQL
    const engine = new QueryEngine();
    const sql = await engine.generateSQL({
      indicatorIds: config.indicator_ids,
      dimensionIds: config.dimension_ids,
      filters: config.filters,
      orderBy: config.order_by,
      page: config.page,
      pageSize: config.page_size,
    });

    if (!sql) {
      return c.json({
        success: false,
        error: "无法生成查询 SQL",
      }, 400);
    }

    return c.json({
      success: true,
      data: {
        sql,
      },
    });
  } catch (error) {
    console.error("Preview SQL error:", error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : "SQL 生成失败",
    }, 500);
  }
});

/**
 * POST /analysis/common-dimensions
 * 获取多个指标的公共维度
 */
app.post("/common-dimensions", async (c) => {
  try {
    const body = await c.req.json();
    const result = commonDimensionsSchema.safeParse(body);

    if (!result.success) {
      return c.json({
        success: false,
        error: "参数校验失败",
        details: result.error.format(),
      }, 400);
    }

    const { indicator_ids } = result.data;

    // 获取公共维度
    const dimensions = await getIndicatorCommonDimensions(indicator_ids);

    return c.json({
      success: true,
      data: dimensions,
    });
  } catch (error) {
    console.error("Common dimensions error:", error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : "获取公共维度失败",
    }, 500);
  }
});

export default app;
