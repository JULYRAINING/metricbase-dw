/**
 * Layer 0: UNION ALL 子查询构建器
 *
 * 职责:
 * - 原子指标: 直接按维度聚合
 * - 嵌套指标: 内层聚合 (按 nested_key)
 * - 衍生复合指标: 带筛选条件的原子指标
 *
 * 输出列: dim_X, metric_code, metric_value
 * 当存在 nested_from_composite 时额外输出: nested_dim
 */

import type { IndicatorNode } from "../utils/indicator-tree.ts";
import type { Dimension, DimensionProperty, Layer0Subquery } from "./types.ts";
import { mapSqlOperator, formatValue, validateCondition, validateIdentifier } from "./sql-utils.ts";
import {
  collectAtomicAndNested,
  collectDerivedFromComposite,
  collectAtomicSources,
} from "./indicator-utils.ts";

const NULL_KEY_PLACEHOLDER = "__NULL_KEY__";

interface BuildLayer0Options {
  indicators: IndicatorNode[];
  dimensions: Dimension[];
  dimensionProps: DimensionProperty[];
}

/**
 * 构建 Layer 0 SQL
 */
export function buildLayer0SQL(options: BuildLayer0Options): string {
  const { indicators, dimensions, dimensionProps } = options;

  // 收集所有原子/嵌套指标
  const atomicNested = collectAtomicAndNested(indicators);

  const subqueries: string[] = [];

  // 检查是否存在 nested_from_composite
  const hasNestedFromComposite = indicators.some(
    (ind) => ind.type === "nested" && ind.is_nested &&
      ind.sources.some((s) => s.type === "composite")
  );

  // 获取嵌套维度字段
  let nestedDimField: string | null = null;
  if (hasNestedFromComposite) {
    for (const ind of indicators) {
      if (
        ind.type === "nested" && ind.is_nested && ind.aggregate_on
      ) {
        // 从属性中查找维度字段
        const prop = dimensionProps.find((p) => p.name === ind.aggregate_on);
        if (prop) {
          nestedDimField = `${prop.component_name}.${prop.name} AS nested_dim`;
          break;
        }
      }
    }
  }

  // 1. 处理原子/衍生/嵌套指标
  for (const node of atomicNested) {
    if (node.type === "atomic" || node.type === "derived") {
      const subquery = buildAtomicSubquery(node, dimensions, dimensionProps, nestedDimField);
      if (subquery) {
        subqueries.push(subquery);
      }
    } else if (node.type === "nested") {
      const subquery = buildNestedSubquery(node, dimensions, dimensionProps, nestedDimField);
      if (subquery) {
        subqueries.push(subquery);
      }
    }
  }

  // 2. 处理 derived_from_composite 指标
  const derivedFromComposite = collectDerivedFromComposite(indicators);
  for (const dfc of derivedFromComposite) {
    const sourceAtomics: IndicatorNode[] = [];
    for (const source of dfc.sources) {
      if (source.type === "atomic") {
        // 检查是否已存在
        if (!sourceAtomics.some((s) => s.code === source.code)) {
          // 创建带筛选条件的副本
          const sourceCopy: IndicatorNode = {
            ...source,
            code: `${dfc.code}_${source.code}`,
            condition: dfc.condition,
          };
          sourceAtomics.push(sourceCopy);
        }
      }
    }

    for (const source of sourceAtomics) {
      const subquery = buildAtomicSubquery(
        source,
        dimensions,
        dimensionProps,
        nestedDimField,
      );
      if (subquery) {
        subqueries.push(subquery);
      }
    }
  }

  if (subqueries.length === 0) {
    return "SELECT NULL AS dim_0, NULL AS metric_code, NULL AS metric_value FROM (SELECT 1) t WHERE 1=0";
  }

  return subqueries.join("\nUNION ALL\n");
}

/**
 * 构建原子指标子查询
 */
function buildAtomicSubquery(
  node: IndicatorNode,
  dimensions: Dimension[],
  dimensionProps: DimensionProperty[],
  nestedDimField: string | null,
): string | null {
  // 获取维度字段
  const dimFields: string[] = [];
  for (const dim of dimensions) {
    const fieldName = findDimensionField(node.source || "", dim, dimensionProps);
    if (fieldName) {
      dimFields.push(`${node.source}.${fieldName} AS dim_${dim.id}`);
    }
  }

  let dimSql = dimFields.join(",\n    ");
  if (dimSql) {
    dimSql = dimSql + ",\n    ";
  }

  // 如果存在 nested_dim_field，添加到 SELECT 和 GROUP BY
  let groupSuffix = "";
  if (nestedDimField) {
    dimSql = dimSql + nestedDimField + ",\n    ";
    const nestedCol = nestedDimField.split(" AS ")[0];
    groupSuffix = `, ${nestedCol}`;
  }

  // WHERE 条件
  // 验证 condition 防止 SQL 注入
  const validatedCondition = validateCondition(node.condition || "");
  const whereSql = buildWhereConditions(validatedCondition);

  // GROUP BY 字段
  const groupFields: string[] = [];
  for (const dim of dimensions) {
    const fieldName = findDimensionField(node.source || "", dim, dimensionProps);
    if (fieldName) {
      groupFields.push(`dim_${dim.id}`);
    }
  }

  let groupSql = groupFields.join(", ");
  if (groupSql && groupSuffix) {
    groupSql = groupSql + groupSuffix;
  } else if (groupSuffix) {
    groupSql = groupSuffix.replace(", ", "");
  }

  // 验证表名和字段名防止 SQL 注入
  const validatedSource = validateIdentifier(node.source || "", "Source table");
  const aggFunc = node.agg || "SUM";
  // measure 为 * 时不需要验证，否则验证字段名
  const measureField = node.measure === "*" ? "*" : validateIdentifier(node.measure || "*", "Measure field");

  return `SELECT ${dimSql}'${node.code}' AS metric_code,
    ${aggFunc}(${validatedSource}.${measureField}) AS metric_value
FROM ${validatedSource}
${whereSql}
${groupSql ? `GROUP BY ${groupSql}` : ""}`;
}

/**
 * 构建嵌套指标子查询
 */
function buildNestedSubquery(
  node: IndicatorNode,
  dimensions: Dimension[],
  dimensionProps: DimensionProperty[],
  nestedDimField: string | null,
): string | null {
  // 收集来源原子指标
  const sourceAtomics: IndicatorNode[] = [];
  collectAtomicSources(node, sourceAtomics, new Set());

  if (sourceAtomics.length === 0) {
    return `SELECT NULL AS dim_0, '${node.code}' AS metric_code, NULL AS metric_value FROM (SELECT 1) t`;
  }

  const firstSource = sourceAtomics[0];

  // 验证来源表名防止 SQL 注入
  const validatedSource = validateIdentifier(
    firstSource.source || "",
    "Nested source table"
  );

  // 内层 SELECT 字段
  const innerDimFields: string[] = [];
  const outerDimFields: string[] = [];
  const innerGroupFields: string[] = [];
  const outerGroupFields: string[] = [];

  for (const dim of dimensions) {
    const fieldName = findDimensionField(
      firstSource.source || "",
      dim,
      dimensionProps,
    );
    if (fieldName) {
      // 验证字段名
      const validatedField = validateIdentifier(fieldName, "Dimension field");
      innerDimFields.push(`${validatedSource}.${validatedField} AS dim_${dim.id}`);
      outerDimFields.push(`inner_data.dim_${dim.id} AS dim_${dim.id}`);
      innerGroupFields.push(`${validatedSource}.${validatedField}`);
      outerGroupFields.push(`dim_${dim.id}`);
    }
  }

  // 如果存在 nested_dim_field
  if (nestedDimField) {
    const nestedRaw = nestedDimField.split(" AS ")[0];
    innerDimFields.push(`${nestedRaw} AS nested_dim`);
    outerDimFields.push("inner_data.nested_dim AS nested_dim");
    innerGroupFields.push(nestedRaw);
    outerGroupFields.push("nested_dim");
  }

  // nested_key 字段（聚合键）
  let nestedKeyField: string;
  if (node.aggregate_on) {
    // 验证 aggregate_on 字段名防止 SQL 注入
    const validatedAggregateOn = validateIdentifier(node.aggregate_on, "Aggregate on field");
    nestedKeyField = `COALESCE(${validatedSource}.${validatedAggregateOn}, '${NULL_KEY_PLACEHOLDER}') AS nested_key`;
  } else {
    nestedKeyField = "1 AS nested_key";
  }

  // 内层聚合字段
  const innerDimSql = [...innerDimFields, nestedKeyField].join(",\n    ");

  // 构建 HAVING 子句
  const havingParts: string[] = [];
  if (node.having_conditions) {
    for (const cond of node.having_conditions) {
      const operator = mapSqlOperator(cond.operator);
      const value = formatValue(cond.value);
      havingParts.push(`inner_metric ${operator} ${value}`);
    }
  }
  const havingSql = havingParts.length > 0
    ? `\nHAVING ${havingParts.join(" AND ")}`
    : "";

  // 外层 SELECT
  const outerDimSql = outerDimFields.join(",\n    ");

  // 外层聚合
  const nestedAgg = node.nested_aggregator || "SUM";
  let outerAgg: string;
  if (nestedAgg === "COUNT_DISTINCT") {
    outerAgg = "COUNT(DISTINCT nested_key)";
  } else {
    outerAgg = "SUM(inner_metric)";
  }

  // GROUP BY
  const innerGroupSql = innerGroupFields.length > 0
    ? `GROUP BY ${innerGroupFields.join(", ")}`
    : "";
  const outerGroupSql = outerGroupFields.length > 0
    ? `GROUP BY ${outerGroupFields.join(", ")}`
    : "";

  // 构建 WHERE 条件（验证防止 SQL 注入）
  const validatedNestedCondition = validateCondition(node.condition || "");
  const whereSql = buildWhereConditions(validatedNestedCondition);

  if (outerDimSql) {
    return `SELECT ${outerDimSql},
    '${node.code}' AS metric_code,
    ${outerAgg} AS metric_value
FROM (
    SELECT ${innerDimSql},
        COUNT(*) AS inner_metric
    FROM ${validatedSource}
    ${whereSql}
    ${innerGroupSql}
    ${havingSql}
) AS inner_data
${outerGroupSql}`;
  } else {
    return `SELECT '${node.code}' AS metric_code,
    ${outerAgg} AS metric_value
FROM (
    SELECT ${innerDimSql},
        COUNT(*) AS inner_metric
    FROM ${validatedSource}
    ${whereSql}
    ${innerGroupSql}
    ${havingSql}
) AS inner_data`;
  }
}

/**
 * 查找维度字段
 */
function findDimensionField(
  componentName: string,
  dim: Dimension,
  dimensionProps: DimensionProperty[],
): string | null {
  // 在属性中查找关联该维度的字段
  const prop = dimensionProps.find(
    (p) => p.component_name === componentName && p.dimension_id === dim.id,
  );
  return prop?.name || null;
}

/**
 * 构建 WHERE 条件
 */
function buildWhereConditions(condition?: string): string {
  if (!condition) {
    return "";
  }
  return `WHERE ${condition}`;
}
