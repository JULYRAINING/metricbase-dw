/**
 * 指标依赖树工具
 * 用于构建指标依赖关系和检测循环依赖
 */

import { createClient } from "jsr:@supabase/supabase-js@2.49.8";

// 获取Supabase客户端
const getSupabase = () => createClient(
  Deno.env.get("SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
);

// 指标节点类型
export interface IndicatorNode {
  id: string;
  code: string;
  name: string;
  type: 'atomic' | 'derived' | 'composite' | 'nested' | 'derived_from_composite';
  // 类型特定字段
  source?: string;
  measure?: string;
  agg?: string;
  condition?: string;
  formula?: string;
  base_metrics?: string[];
  is_nested?: boolean;
  nested_aggregator?: string;
  aggregate_on?: string;
  having_conditions?: Array<{ operator: string; value: number | string }>;
  is_derived_from_composite?: boolean;
  // 依赖关系
  sources: IndicatorNode[];
  // 元数据
  _is_user_selected?: boolean;
}

/**
 * 构建指标依赖树
 * @param ids 指标ID列表
 * @returns 指标节点列表
 */
export async function buildIndicatorTree(ids: string[]): Promise<IndicatorNode[]> {
  const supabase = getSupabase();
  const selectedIds = new Set(ids);
  const nodeMap = new Map<string, IndicatorNode>();
  const visited = new Set<string>();

  // 递归加载指标及其依赖
  async function loadIndicator(id: string): Promise<IndicatorNode | null> {
    if (nodeMap.has(id)) {
      return nodeMap.get(id)!;
    }

    if (visited.has(id)) {
      // 检测到循环依赖，抛出错误
      throw new Error(
        `Circular dependency detected: metric ID "${id}" has already been visited in the dependency chain.`
      );
    }

    visited.add(id);

    const { data: metric, error } = await supabase
      .from("metrics")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !metric) {
      return null;
    }

    const node: IndicatorNode = {
      id: metric.id,
      code: metric.code || metric.name,
      name: metric.name,
      type: metric.type,
      source: metric.source,
      measure: metric.measure,
      agg: metric.agg,
      condition: metric.condition,
      formula: metric.formula,
      base_metrics: metric.base_metrics,
      is_nested: metric.is_nested,
      nested_aggregator: metric.nested_aggregator,
      aggregate_on: metric.aggregate_on,
      having_conditions: metric.having_conditions,
      is_derived_from_composite: metric.is_derived_from_composite,
      sources: [],
      _is_user_selected: selectedIds.has(id),
    };

    // 递归加载依赖
    if (metric.type === 'composite' && metric.base_metrics?.length > 0) {
      // 复合指标：加载所有基础指标（通过 code 查找）
      for (const baseCode of metric.base_metrics) {
        const { data: baseMetric } = await supabase
          .from("metrics")
          .select("id")
          .eq("code", baseCode)
          .single();

        if (baseMetric) {
          const baseNode = await loadIndicator(baseMetric.id);
          if (baseNode) {
            node.sources.push(baseNode);
          }
        }
      }
    } else if ((metric.type === 'derived' || metric.type === 'nested' ||
                metric.type === 'derived_from_composite') && metric.source) {
      // 衍生/嵌套指标：加载源指标（通过 code 查找）
      const { data: sourceMetric } = await supabase
        .from("metrics")
        .select("id")
        .eq("code", metric.source)
        .single();

      if (sourceMetric) {
        const sourceNode = await loadIndicator(sourceMetric.id);
        if (sourceNode) {
          node.sources.push(sourceNode);
          // 对于衍生复合指标，还需要加载源复合指标的基础指标
          if (metric.is_derived_from_composite && sourceNode.base_metrics) {
            for (const baseCode of sourceNode.base_metrics) {
              const { data: baseMetric } = await supabase
                .from("metrics")
                .select("id")
                .eq("code", baseCode)
                .single();

              if (baseMetric && baseMetric.id !== sourceMetric.id) {
                const baseNode = await loadIndicator(baseMetric.id);
                if (baseNode) {
                  node.sources.push(baseNode);
                }
              }
            }
          }
        }
      }
    }

    nodeMap.set(id, node);
    return node;
  }

  // 加载所有选中的指标
  for (const id of ids) {
    await loadIndicator(id);
  }

  return Array.from(nodeMap.values());
}

/**
 * 检测循环依赖
 * @param node 起始节点
 * @param visited 已访问节点集合（用于检测循环）
 * @param path 当前路径（用于错误信息）
 * @returns 是否检测到循环
 */
export function detectCircularDependency(
  node: IndicatorNode,
  visited: Set<string> = new Set(),
  path: string[] = []
): { hasCycle: boolean; cycle: string[] } {
  if (visited.has(node.id)) {
    // 找到循环
    const cycleStart = path.indexOf(node.name);
    const cycle = path.slice(cycleStart);
    cycle.push(node.name);
    return { hasCycle: true, cycle };
  }

  visited.add(node.id);
  path.push(node.name);

  for (const source of node.sources) {
    const result = detectCircularDependency(source, new Set(visited), [...path]);
    if (result.hasCycle) {
      return result;
    }
  }

  return { hasCycle: false, cycle: [] };
}

/**
 * 获取所有依赖的指标ID（包括嵌套依赖）
 * @param id 起始指标ID
 * @returns 所有依赖的指标ID列表
 */
export async function getAllDependencies(id: string): Promise<string[]> {
  const supabase = getSupabase();
  const dependencies = new Set<string>();
  const visited = new Set<string>();

  async function collectDependencies(currentId: string) {
    if (visited.has(currentId)) {
      return;
    }
    visited.add(currentId);

    const { data: metric } = await supabase
      .from("metrics")
      .select("*")
      .eq("id", currentId)
      .single();

    if (!metric) {
      return;
    }

    if (metric.type === 'composite' && metric.base_metrics?.length > 0) {
      for (const baseCode of metric.base_metrics) {
        const { data: baseMetric } = await supabase
          .from("metrics")
          .select("id")
          .eq("code", baseCode)
          .single();

        if (baseMetric) {
          dependencies.add(baseMetric.id);
          await collectDependencies(baseMetric.id);
        }
      }
    } else if ((metric.type === 'derived' || metric.type === 'nested') && metric.source) {
      const { data: sourceMetric } = await supabase
        .from("metrics")
        .select("id")
        .eq("code", metric.source)
        .single();

      if (sourceMetric) {
        dependencies.add(sourceMetric.id);
        await collectDependencies(sourceMetric.id);
      }
    }
  }

  await collectDependencies(id);
  return Array.from(dependencies);
}

/**
 * 计算公共维度
 * 获取多个指标共同支持的维度列表（从 physical_tables 表）
 */
export async function calculateCommonDimensions(metricIds: string[]): Promise<Array<{
  id: string;
  name: string;
  code: string;
}>> {
  if (metricIds.length === 0) {
    return [];
  }

  const supabase = getSupabase();

  // 加载所有指标
  const { data: metrics } = await supabase
    .from("metrics")
    .select("id, dims")
    .in("id", metricIds);

  if (!metrics || metrics.length === 0) {
    return [];
  }

  // 收集每个指标支持的维度
  const dimensionSets: Set<string>[] = [];

  for (const metric of metrics) {
    const dims = new Set<string>();

    if (metric.dims) {
      metric.dims.forEach((d: string) => dims.add(d));
    }

    // 复合指标：获取所有来源指标的维度交集
    if (metric.type === 'composite' && metric.base_metrics?.length > 0) {
      const { data: baseMetrics } = await supabase
        .from("metrics")
        .select("dims")
        .in("code", metric.base_metrics);

      if (baseMetrics) {
        const baseDims: Set<string>[] = baseMetrics
          .filter(m => m.dims)
          .map(m => new Set(m.dims));

        if (baseDims.length > 0) {
          const intersection = new Set(
            [...baseDims[0]].filter(d => baseDims.every(set => set.has(d)))
          );
          intersection.forEach(d => dims.add(d));
        }
      }
    }

    dimensionSets.push(dims);
  }

  if (dimensionSets.length === 0) {
    return [];
  }

  // 计算所有指标的维度交集
  const commonDimCodes = [...dimensionSets[0]].filter(code =>
    dimensionSets.every(set => set.has(code))
  );

  // 从 physical_tables 获取维度详情
  const { data: dimensions } = await supabase
    .from("physical_tables")
    .select("id, code, name")
    .eq("table_type", "dimension")
    .in("code", commonDimCodes);

  return (dimensions || []).map((d) => ({
    id: String(d.id),
    name: String(d.name),
    code: String(d.code),
  }));
}

/**
 * 根据指标ID获取指标详情
 */
export async function getIndicatorById(id: string): Promise<IndicatorNode | null> {
  const supabase = getSupabase();

  const { data: metric } = await supabase
    .from("metrics")
    .select("*")
    .eq("id", id)
    .single();

  if (!metric) {
    return null;
  }

  return {
    id: metric.id,
    code: metric.code || metric.name,
    name: metric.name,
    type: metric.type,
    source: metric.source,
    measure: metric.measure,
    agg: metric.agg,
    condition: metric.condition,
    formula: metric.formula,
    base_metrics: metric.base_metrics,
    is_nested: metric.is_nested,
    nested_aggregator: metric.nested_aggregator,
    aggregate_on: metric.aggregate_on,
    having_conditions: metric.having_conditions,
    is_derived_from_composite: metric.is_derived_from_composite,
    sources: [],
  };
}

/**
 * 根据指标编码获取指标详情
 */
export async function getIndicatorByCode(code: string): Promise<IndicatorNode | null> {
  const supabase = getSupabase();

  const { data: metric } = await supabase
    .from("metrics")
    .select("*")
    .eq("code", code)
    .single();

  if (!metric) {
    return null;
  }
  return getIndicatorById(metric.id);
}