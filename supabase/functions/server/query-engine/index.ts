/**
 * QueryEngine - 多维分析查询引擎
 *
 * CTE 三层架构:
 * - Layer 0: UNION ALL 子查询（原子/嵌套指标的底层聚合）
 * - Layer 1: CASE WHEN 行转列 + 公式计算
 * - Layer 2: JOIN 维度表 + WHERE 筛选
 */

import {
  buildIndicatorTree,
  calculateCommonDimensions,
  getIndicatorById,
  type IndicatorNode,
} from "../utils/indicator-tree.ts";
import * as kv from "../kv_store.ts";
import { buildLayer0SQL } from "./layer0-builder.ts";
import { buildLayer1SQL } from "./layer1-builder.ts";
import { buildLayer2SQL } from "./layer2-builder.ts";
import type {
  QueryConfig,
  QueryResult,
  Dimension,
  DimensionProperty,
  FilterCondition,
} from "./types.ts";

// KV键名生成器
const KEYS = {
  dimension: (id: string) => `dimension:${id}`,
  property: (id: string) => `property:${id}`,
  componentProperties: (componentId: string) =>
    `component:${componentId}:properties`,
};

export class QueryEngine {
  private indicators: IndicatorNode[] = [];
  private dimensions: Dimension[] = [];
  private dimensionProps: DimensionProperty[] = [];
  private filters: FilterCondition[] = [];
  private orderBy?: string;
  private page: number = 1;
  private pageSize: number = 100;

  /**
   * 生成 SQL 查询（不执行）
   */
  async generateSQL(config: QueryConfig): Promise<string> {
    await this.loadData(config);

    if (this.indicators.length === 0) {
      return "";
    }

    return this.buildSQL();
  }

  /**
   * 构建完整 SQL（CTE 三层结构）
   */
  private buildSQL(): string {
    // Layer 0: UNION ALL 子查询
    const layer0SQL = buildLayer0SQL({
      indicators: this.indicators,
      dimensions: this.dimensions,
      dimensionProps: this.dimensionProps,
    });

    // Layer 1: 中间层（CASE WHEN + 公式）
    const layer1SQL = buildLayer1SQL({
      indicators: this.indicators,
      dimensions: this.dimensions,
      dimensionProps: this.dimensionProps,
    });

    // Layer 2: 最外层（JOIN + 筛选）
    const layer2SQL = buildLayer2SQL({
      indicators: this.indicators,
      dimensions: this.dimensions,
      dimensionProps: this.dimensionProps,
      filters: this.filters,
      orderBy: this.orderBy,
      page: this.page,
      pageSize: this.pageSize,
    });

    // 拼接 CTE
    const cteParts: string[] = [];
    if (layer0SQL) {
      cteParts.push(`layer0 AS (${layer0SQL})`);
    }
    if (layer1SQL) {
      cteParts.push(`layer1 AS (${layer1SQL})`);
    }
    cteParts.push(`layer2 AS (${layer2SQL})`);

    const cteSQL = cteParts.join(",\n");

    return `WITH
${cteSQL}
SELECT * FROM layer2`;
  }

  /**
   * 加载数据
   */
  private async loadData(config: QueryConfig): Promise<void> {
    // 1. 加载并构建指标依赖树
    this.indicators = await buildIndicatorTree(config.indicatorIds);

    // 2. 加载维度
    this.dimensions = await this.loadDimensions(config.dimensionIds);

    // 3. 加载维度属性
    this.dimensionProps = await this.loadDimensionProperties();

    // 4. 解析筛选条件
    this.filters = await this.parseFilters(config.filters || []);

    // 5. 设置排序和分页
    this.orderBy = config.orderBy;
    this.page = config.page || 1;
    this.pageSize = config.pageSize || 100;
  }

  /**
   * 加载维度
   */
  private async loadDimensions(ids: string[]): Promise<Dimension[]> {
    if (ids.length === 0) {
      return [];
    }

    const dimensions = await Promise.all(
      ids.map((id) => kv.get(KEYS.dimension(id)))
    );

    return dimensions.filter(Boolean).map((d) => ({
      id: d.id,
      code: d.code,
      name: d.name,
      description: d.description,
    }));
  }

  /**
   * 加载维度属性
   */
  private async loadDimensionProperties(): Promise<DimensionProperty[]> {
    // 获取所有属性
    const allProperties = await kv.getByPrefix("property:") || [];

    return allProperties
      .filter((p: any) => p.dimension_id)
      .map((p: any) => ({
        id: p.id,
        name: p.name,
        component_name: p.component_id, // 使用 component_id 作为表名
        dimension_id: p.dimension_id,
      }));
  }

  /**
   * 解析筛选条件
   */
  private async parseFilters(
    filters: Array<{ property_id: string; operator: string; value: unknown }>
  ): Promise<FilterCondition[]> {
    const result: FilterCondition[] = [];

    for (const filter of filters) {
      const prop = await kv.get(KEYS.property(filter.property_id));
      if (!prop) {
        continue;
      }

      const fieldName = `${prop.component_id}.${prop.name}`;
      result.push({
        filter_type: "property",
        field_name: fieldName,
        operator: filter.operator,
        value: filter.value,
      });
    }

    return result;
  }

  /**
   * 获取公共维度
   */
  async getCommonDimensions(indicatorIds: string[]): Promise<Dimension[]> {
    const dims = await calculateCommonDimensions(indicatorIds);
    return dims.map((d) => ({
      id: d.id,
      code: d.code,
      name: d.name,
    }));
  }
}

/**
 * 使用默认引擎生成 SQL
 */
export async function generateQuerySQL(config: QueryConfig): Promise<string> {
  const engine = new QueryEngine();
  return engine.generateSQL(config);
}

/**
 * 获取指标的公共维度
 */
export async function getIndicatorCommonDimensions(
  indicatorIds: string[]
): Promise<Dimension[]> {
  const engine = new QueryEngine();
  return engine.getCommonDimensions(indicatorIds);
}
