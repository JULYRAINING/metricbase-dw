/**
 * 指标收集工具函数
 * 共享的指标节点收集逻辑
 */

import type { IndicatorNode } from "../utils/indicator-tree.ts";

/**
 * 收集所有原子/嵌套指标
 */
export function collectAtomicAndNested(
  indicators: IndicatorNode[],
): IndicatorNode[] {
  const result: IndicatorNode[] = [];
  const seenCodes = new Set<string>();

  function collectSources(node: IndicatorNode) {
    for (const source of node.sources) {
      if (source.type === "atomic") {
        if (!seenCodes.has(source.code)) {
          seenCodes.add(source.code);
          result.push(source);
        }
      } else if (
        source.type === "composite" ||
        source.type === "derived_from_composite"
      ) {
        collectSources(source);
      }
    }
  }

  for (const node of indicators) {
    if (!node._is_user_selected) {
      continue;
    }

    if (
      node.type === "atomic" ||
      node.type === "nested" ||
      node.type === "derived"
    ) {
      if (!seenCodes.has(node.code)) {
        seenCodes.add(node.code);
        result.push(node);
      }
    } else if (node.type === "composite") {
      collectSources(node);
    }
  }

  return result;
}

/**
 * 收集所有 derived_from_composite 指标
 */
export function collectDerivedFromComposite(
  indicators: IndicatorNode[],
): IndicatorNode[] {
  return indicators.filter(
    (ind) => ind.type === "derived_from_composite" && ind._is_user_selected,
  );
}

/**
 * 递归收集来源原子指标
 */
export function collectAtomicSources(
  node: IndicatorNode,
  result: IndicatorNode[],
  seenCodes: Set<string>,
) {
  for (const source of node.sources) {
    if (source.type === "atomic") {
      if (!seenCodes.has(source.code)) {
        seenCodes.add(source.code);
        result.push(source);
      }
    } else if (
      source.type === "composite" ||
      source.type === "derived_from_composite"
    ) {
      collectAtomicSources(source, result, seenCodes);
    }
  }
}
