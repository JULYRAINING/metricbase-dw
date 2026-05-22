// 指标管理平台类型定义

/**
 * 分类定义
 */
export interface Category {
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

/**
 * 字段定义
 */
export interface Property {
  id: string;
  name: string;
  type: 'int' | 'string' | 'date' | 'datetime' | 'decimal' | 'boolean';
  component_id: string;
  dimension_id?: string;
  description?: string;
  is_join_key?: boolean;
  join_key_target?: string;
  created_at: string;
  updated_at: string;
}

/**
 * 维度定义
 */
export interface Dimension {
  id: string;
  name: string;
  code: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

/**
 * 事实表定义
 */
export interface FactTable {
  id: string;
  name: string;
  code: string;
  description?: string;
  dims: string[];
  measures: string[];
  created_at: string;
  updated_at: string;
}

/**
 * 表类型枚举
 */
export type TableType = 'dimension' | 'fact';

/**
 * 字段角色枚举
 */
export type FieldRole = 'dimension_key' | 'measure' | 'attribute';

/**
 * 物理表定义（统一维度和事实表）
 */
export interface PhysicalTable {
  id: string;
  name: string;
  code: string;
  table_type: TableType;
  description?: string;
  fields?: Field[];
  created_at: string;
  updated_at: string;
}

/**
 * 字段定义（统一所有表的字段）
 */
export interface Field {
  id: string;
  name: string;
  type: 'int' | 'string' | 'date' | 'datetime' | 'decimal' | 'boolean';
  field_role: FieldRole;
  table_id: string;
  dimension_ref_id?: string;
  description?: string;
  is_join_key: boolean;
  join_key_target?: string;
  created_at: string;
  updated_at: string;
}

/**
 * 创建物理表请求
 */
export interface CreatePhysicalTableRequest {
  name: string;
  code: string;
  table_type: TableType;
  description?: string;
  fields?: CreateFieldRequest[];
}

/**
 * 创建字段请求
 */
export interface CreateFieldRequest {
  name: string;
  type: Field['type'];
  field_role: FieldRole;
  table_id?: string;
  dimension_ref_id?: string;
  description?: string;
  is_join_key?: boolean;
}

/**
 * 更新物理表请求
 */
export interface UpdatePhysicalTableRequest {
  name?: string;
  code?: string;
  table_type?: TableType;
  description?: string;
}

/**
 * 更新字段请求
 */
export interface UpdateFieldRequest {
  name?: string;
  type?: Field['type'];
  field_role?: FieldRole;
  dimension_ref_id?: string;
  description?: string;
  is_join_key?: boolean;
  join_key_target?: string;
}

/**
 * 指标类型
 */
export type MetricType = 'atomic' | 'derived' | 'composite' | 'nested' | 'derived_from_composite';

/**
 * 比较操作符
 */
export type ComparisonOperator = 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin' | 'like' | 'ilike' | 'is_null' | 'is_not_null';

/**
 * HAVING条件
 */
export interface HavingCondition {
  field?: string;
  operator: ComparisonOperator;
  value: number | string;
}

/**
 * 指标定义
 */
export interface Metric {
  id: string;
  name: string;
  type: MetricType;
  source?: string; // 来源事实表编码(原子)或来源指标ID(衍生)
  measure?: string; // 度量字段(原子)
  agg?: string; // 聚合方式(原子): SUM, COUNT, COUNT_DISTINCT, MAX, MIN
  condition?: string; // 业务限定条件(衍生)
  formula?: string; // 计算公式(复合)
  base_metrics?: string[]; // 依赖的基础指标编码数组(复合)
  dims?: string[]; // 继承的可分析维度编码数组

  // 嵌套指标字段
  is_nested?: boolean;
  nested_aggregator?: string;
  aggregate_on?: string;
  having_conditions?: HavingCondition[];

  // 衍生复合指标字段
  is_derived_from_composite?: boolean;

  created_at: string;
  updated_at: string;
}

/**
 * API响应通用格式
 */
export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

/**
 * 创建维度请求
 */
export interface CreateDimensionRequest {
  name: string;
  code: string;
  description?: string;
}

/**
 * 更新维度请求
 */
export interface UpdateDimensionRequest {
  name?: string;
  code?: string;
  description?: string;
}

/**
 * 创建事实表请求
 */
export interface CreateFactTableRequest {
  name: string;
  code: string;
  description?: string;
  dims?: string[];
  measures?: string[];
}

/**
 * 更新事实表请求
 */
export interface UpdateFactTableRequest {
  name?: string;
  code?: string;
  description?: string;
  dims?: string[];
  measures?: string[];
}

/**
 * 创建指标请求
 */
export interface CreateMetricRequest {
  name: string;
  type: MetricType;
  source?: string;
  measure?: string;
  agg?: string;
  condition?: string;
  formula?: string;
  base_metrics?: string[];
  dims?: string[];
}

/**
 * 更新指标请求
 */
export interface UpdateMetricRequest {
  name?: string;
  type?: MetricType;
  source?: string;
  measure?: string;
  agg?: string;
  condition?: string;
  formula?: string;
  base_metrics?: string[];
  dims?: string[];
}

/**
 * 模型构建器使用的指标（简化版）
 */
export interface ModelMetric {
  id: string;
  name: string;
  type: MetricType;
  dims: string[];
}

/**
 * 维度字典项
 */
export interface DimensionDictItem {
  name: string;
  desc: string;
}

/**
 * 分析筛选条件
 */
export interface AnalysisFilters {
  property_id: string;
  operator: ComparisonOperator;
  value: string | number | boolean | null;
}

/**
 * 分析查询结果
 */
export interface AnalysisResult {
  columns: string[];
  rows: unknown[][];
  total: number;
  sql: string;
}
