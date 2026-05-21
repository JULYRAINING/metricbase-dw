/**
 * Layer 2: JOIN 维度表 + WHERE 筛选
 *
 * 职责:
 * - JOIN 维度表（基于 Property 定义的关联）
 * - 应用用户筛选条件 (WHERE)
 * - 添加排序 (ORDER BY)
 * - 分页 (LIMIT/OFFSET)
 *
 * 输入: layer1
 * 输出: 最终查询结果
 */

import type { IndicatorNode } from "../utils/indicator-tree.ts";
import type {
  Dimension,
  DimensionProperty,
  FilterCondition,
} from "./types.ts";

interface BuildLayer2Options {
  indicators: IndicatorNode[];
  dimensions: Dimension[];
  dimensionProps: DimensionProperty[];
  filters: FilterCondition[];
  orderBy?: string;
  page?: number;
  pageSize?: number;
}

/**
 * 构建 Layer 2 SQL
 */
export function buildLayer2SQL(options: BuildLayer2Options): string {
  const {
    dimensions,
    dimensionProps,
    filters,
    orderBy,
    page = 1,
    pageSize = 100,
  } = options;

  // 构建 SELECT 字段（从 layer1 继承所有字段）
  const selectFields = ["layer1.*"];

  // 添加维度显示字段
  for (const dim of dimensions) {
    // 为每个维度添加名称字段
    selectFields.push(`dim_${dim.code}.name AS dim_${dim.id}_name`);
  }

  // 构建 FROM 和 JOIN
  let fromSql = "FROM layer1";

  // JOIN 维度表
  for (const dim of dimensions) {
    // 查找维度表关联
    const dimTable = `dim_${dim.code}`;
    fromSql += `\nLEFT JOIN ${dimTable} ON layer1.dim_${dim.id} = ${dimTable}.id`;
  }

  // WHERE 条件
  const whereConditions = buildWhereFilters(filters);
  const whereSql = whereConditions ? `WHERE ${whereConditions}` : "";

  // ORDER BY
  const orderSql = orderBy
    ? `ORDER BY ${orderBy}`
    : dimensions.length > 0
    ? `ORDER BY ${dimensions.map((d) => `dim_${d.id}`).join(", ")}`
    : "";

  // 分页
  const offset = (page - 1) * pageSize;
  const limitSql = `LIMIT ${pageSize} OFFSET ${offset}`;

  return `SELECT
    ${selectFields.join(",\n    ")}
${fromSql}
${whereSql}
${orderSql}
${limitSql}`;
}

/**
 * 构建筛选条件
 */
function buildWhereFilters(filters: FilterCondition[]): string {
  if (filters.length === 0) {
    return "";
  }

  const conditions: string[] = [];

  for (const filter of filters) {
    const condition = buildSingleFilter(filter);
    if (condition) {
      conditions.push(condition);
    }
  }

  return conditions.join(" AND ");
}

/**
 * 构建单个筛选条件
 */
function buildSingleFilter(filter: FilterCondition): string | null {
  const operator = mapSqlOperator(filter.operator);
  const value = formatValue(filter.value);

  if (filter.filter_type === "property") {
    return `${filter.field_name} ${operator} ${value}`;
  } else if (filter.filter_type === "dimension") {
    return `${filter.field_name} ${operator} ${value}`;
  } else if (filter.filter_type === "having") {
    // HAVING 条件在 layer1 处理
    return null;
  }

  return null;
}

/**
 * 映射 SQL 操作符
 */
function mapSqlOperator(operator: string): string {
  const mapping: Record<string, string> = {
    eq: "=",
    ne: "!=",
    gt: ">",
    gte: ">=",
    lt: "<",
    lte: "<=",
    in: "IN",
    nin: "NOT IN",
    like: "LIKE",
    ilike: "ILIKE",
    is_null: "IS NULL",
    is_not_null: "IS NOT NULL",
  };
  return mapping[operator] || operator;
}

/**
 * 格式化值
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "NULL";
  }
  if (typeof value === "string") {
    return `'${value.replace(/'/g, "''")}'`;
  }
  if (typeof value === "number") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return `(${value.map((v) => formatValue(v)).join(", ")})`;
  }
  if (typeof value === "boolean") {
    return value ? "TRUE" : "FALSE";
  }
  return String(value);
}
