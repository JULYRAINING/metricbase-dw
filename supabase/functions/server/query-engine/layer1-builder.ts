/**
 * Layer 1: CASE WHEN 行转列 + 公式计算
 *
 * 职责:
 * - 使用 CASE WHEN 从 layer0 提取原子/衍生指标
 * - 外层聚合 + HAVING 处理嵌套指标
 * - 计算复合指标公式 (包括 derived_from_composite)
 *
 * 输入: layer0
 * 输出列: dim_X, indicator columns (CASE WHEN 后的各指标值)
 */

import type { IndicatorNode } from "../utils/indicator-tree.ts";
import type { Dimension, DimensionProperty } from "./types.ts";
import { collectAtomicAndNested } from "./indicator-utils.ts";
import { validateFormula, validateMetricCode } from "./sql-utils.ts";

interface BuildLayer1Options {
  indicators: IndicatorNode[];
  dimensions: Dimension[];
  dimensionProps: DimensionProperty[];
}

/**
 * 构建 Layer 1 SQL
 */
export function buildLayer1SQL(options: BuildLayer1Options): string {
  const { indicators, dimensions } = options;

  // 收集所有原子/嵌套指标
  const atomicNested = collectAtomicAndNested(indicators);

  // 分离指标类型
  const atomicDerived: IndicatorNode[] = [];
  const nestedIndicators: IndicatorNode[] = [];

  for (const node of atomicNested) {
    if (node.type === "atomic" || node.type === "derived") {
      atomicDerived.push(node);
    } else if (node.type === "nested") {
      nestedIndicators.push(node);
    }
  }

  // 收集复合指标和衍生复合指标
  const compositeIndicators = indicators.filter(
    (ind) =>
      (ind.type === "composite" || ind.type === "derived_from_composite") &&
      ind._is_user_selected
  );

  // 构建 SELECT 字段
  const selectFields: string[] = [];

  // 1. 维度字段
  const dimFields = dimensions.map((dim) => `dim_${dim.id}`);
  selectFields.push(...dimFields);

  // 2. 原子/衍生指标的 CASE WHEN
  for (const node of atomicDerived) {
    const caseSql = buildAtomicCaseWhen(node.code);
    selectFields.push(caseSql);
  }

  // 3. 嵌套指标的 CASE WHEN (带外层聚合)
  for (const node of nestedIndicators) {
    const caseSql = buildNestedCaseWhen(node);
    selectFields.push(caseSql);
  }

  // 4. 复合指标公式
  for (const node of compositeIndicators) {
    const formulaSql = buildCompositeFormula(node);
    selectFields.push(formulaSql);
  }

  // 5. derived_from_composite 指标
  const derivedFromComposite = indicators.filter(
    (ind) => ind.type === "derived_from_composite" && ind._is_user_selected
  );
  for (const dfc of derivedFromComposite) {
    // derived_from_composite 在 layer0 已经生成带前缀的子查询
    // 这里需要为每个来源原子指标引用对应的 layer0 结果
    const formulaSql = buildDerivedFromCompositeFormula(dfc);
    selectFields.push(formulaSql);
  }

  // 构建 GROUP BY
  const groupByFields = dimensions.map((dim) => `dim_${dim.id}`);

  // 过滤掉空字段
  const validSelectFields = selectFields.filter((f) => f && f.trim() !== "");

  if (validSelectFields.length === 0) {
    return "SELECT 1 FROM layer0";
  }

  return `SELECT
    ${validSelectFields.join(",\n    ")}
FROM layer0
${groupByFields.length > 0 ? `GROUP BY ${groupByFields.join(", ")}` : ""}`;
}

/**
 * 构建原子指标的 CASE WHEN
 */
function buildAtomicCaseWhen(code: string): string {
  // 使用 MAX 处理可能的 NULL 值
  return `MAX(CASE WHEN metric_code = '${code}' THEN metric_value END) AS "${code}"`;
}

/**
 * 构建嵌套指标的 CASE WHEN (带外层聚合)
 */
function buildNestedCaseWhen(node: IndicatorNode): string {
  // 嵌套指标在 layer0 已经计算完成，这里用 MAX 提取
  return `MAX(CASE WHEN metric_code = '${node.code}' THEN metric_value END) AS "${node.code}"`;
}

/**
 * 构建复合指标公式
 */
function buildCompositeFormula(node: IndicatorNode): string {
  if (!node.formula) {
    return `NULL AS "${node.code}"`;
  }

  // 验证公式格式（防止 SQL 注入）
  let formula = validateFormula(node.formula);

  // 验证并收集所有来源指标编码
  const sourceCodes = node.sources.map((s) => {
    // 验证来源指标编码格式
    return validateMetricCode(s.code);
  });

  // 替换公式中的变量引用
  for (const code of sourceCodes) {
    // 替换公式中的变量引用
    // 支持 {code} 或直接引用
    formula = formula.replace(new RegExp(`\\{${code}\\}`, "g"), `"${code}"`);
  }

  // 验证所有变量是否已被替换（检查是否有剩余的 {xxx} 模式）
  const remainingVars = formula.match(/\{[^}]+\}/g);
  if (remainingVars) {
    throw new Error(
      `Formula contains undefined variables: ${remainingVars.join(", ")}`
    );
  }

  // 添加除零保护
  formula = addDivideByZeroProtection(formula);

  return `(${formula}) AS "${node.code}"`;
}

/**
 * 构建衍生复合指标公式
 */
function buildDerivedFromCompositeFormula(node: IndicatorNode): string {
  // derived_from_composite 的公式基于其来源原子指标
  // 引用 layer0 中带前缀的子查询结果
  const sourceCodes = node.sources
    .filter((s) => s.type === "atomic")
    .map((s) => `${node.code}_${s.code}`);

  if (sourceCodes.length === 0) {
    return `NULL AS "${node.code}"`;
  }

  // 简单求和或取第一个值
  if (sourceCodes.length === 1) {
    return `MAX(CASE WHEN metric_code = '${sourceCodes[0]}' THEN metric_value END) AS "${node.code}"`;
  }

  // 多个来源时，根据公式或简单相加
  const parts = sourceCodes.map((code) =>
    `MAX(CASE WHEN metric_code = '${code}' THEN metric_value END)`
  );

  return `(${parts.join(" + ")}) AS "${node.code}"`;
}

/**
 * 添加除零保护
 */
function addDivideByZeroProtection(formula: string): string {
  // 匹配 a / b 模式，替换为 a / NULLIF(b, 0)
  return formula.replace(
    /(\w+|"[^"]+")\s*\/\s*(\w+|"[^"]+")/g,
    "$1 / NULLIF($2, 0)",
  );
}
