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
 * 指标类型
 */
export type MetricType = 'atomic' | 'derived' | 'composite' | 'nested' | 'derived_from_composite';

/**
 * HAVING条件
 */
export interface HavingCondition {
  field?: string;
  operator: string;
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
