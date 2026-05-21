/**
 * 查询引擎类型定义
 * CTE 三层架构 SQL 生成器
 */

import type { IndicatorNode } from "../utils/indicator-tree.ts";

// 筛选条件类型
export interface FilterCondition {
  filter_type: "property" | "dimension" | "having";
  field_name: string;
  operator: string;
  value: unknown;
}

// 维度定义
export interface Dimension {
  id: string;
  code: string;
  name: string;
  description?: string;
}

// 属性定义（用于维度关联）
export interface DimensionProperty {
  id: string;
  name: string;
  component_name: string;
  dimension_id?: string;
}

// 查询配置
export interface QueryConfig {
  indicatorIds: string[];
  dimensionIds: string[];
  filters?: FilterConfig[];
  orderBy?: string;
  page?: number;
  pageSize?: number;
}

// 筛选配置（用户输入）
export interface FilterConfig {
  property_id: string;
  operator: string;
  value: unknown;
}

// 查询结果
export interface QueryResult {
  columns: string[];
  rows: unknown[][];
  total: number;
  sql: string;
}

// Layer0 子查询配置
export interface Layer0Subquery {
  code: string;
  sql: string;
}

// Layer1 CASE WHEN 配置
export interface Layer1Case {
  code: string;
  caseSql: string;
}
