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
  type IndicatorNode,
} from "../utils/indicator-tree.ts";
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
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

// 获取Supabase客户端
const getSupabase = () => createClient(
  Deno.env.get("SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
);

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
   * 加载数据（从 PostgreSQL）
   */
  private async loadData(config: QueryConfig): Promise<void> {
    // 1. 加载并构建指标依赖树
    this.indicators = await buildIndicatorTree(config.indicatorIds);

    // 2. 加载维度（从 physical_tables）
    this.dimensions = await this.loadDimensions(config.dimensionIds);

    // 3. 加载维度属性（从 fields）
    this.dimensionProps = await this.loadDimensionProperties();

    // 4. 解析筛选条件
    this.filters = await this.parseFilters(config.filters || []);

    // 5. 设置排序和分页
    this.orderBy = config.orderBy;
    this.page = config.page || 1;
    this.pageSize = config.pageSize || 100;
  }

  /**
   * 加载维度（从 physical_tables 表）
   */
  private async loadDimensions(ids: string[]): Promise<Dimension[]> {
    if (ids.length === 0) {
      return [];
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("physical_tables")
      .select("id, code, name, description")
      .eq("table_type", "dimension")
      .in("id", ids);

    if (error || !data) {
      return [];
    }

    return data.map((d) => ({
      id: String(d.id),
      code: String(d.code),
      name: String(d.name),
      description: d.description ? String(d.description) : undefined,
    }));
  }

  /**
   * 加载维度属性（从 fields 表）
   * 包含 dimension_key 类型的字段，并关联物理表的 code
   */
  private async loadDimensionProperties(): Promise<DimensionProperty[]> {
    const supabase = getSupabase();

    // 查询所有维度键字段，并关联物理表获取表 code
    const { data: fields, error } = await supabase
      .from("fields")
      .select(`
        id,
        name,
        table_id,
        dimension_ref_id,
        field_role
      `)
      .eq("field_role", "dimension_key");

    if (error || !fields) {
      return [];
    }

    // 获取所有涉及的物理表 ID
    const tableIds = [...new Set(fields.map(f => f.table_id))];

    // 查询物理表获取 code
    const { data: tables } = await supabase
      .from("physical_tables")
      .select("id, code")
      .in("id", tableIds);

    const tableCodeMap = new Map((tables || []).map(t => [t.id, t.code]));

    return fields
      .filter((f) => f.dimension_ref_id)
      .map((f) => ({
        id: String(f.id),
        name: String(f.name),
        component_name: tableCodeMap.get(f.table_id) || '',  // 表 code
        dimension_id: String(f.dimension_ref_id),  // 引用的维度物理表 ID
      }));
  }

  /**
   * 解析筛选条件
   */
  private async parseFilters(
    filters: Array<{ property_id: string; operator: string; value: unknown }>
  ): Promise<FilterCondition[]> {
    const supabase = getSupabase();
    const result: FilterCondition[] = [];

    for (const filter of filters) {
      // 从 fields 表查询字段信息
      const { data: field } = await supabase
        .from("fields")
        .select("name, table_id")
        .eq("id", filter.property_id)
        .single();

      if (!field) {
        continue;
      }

      // 获取物理表 code
      const { data: table } = await supabase
        .from("physical_tables")
        .select("code")
        .eq("id", field.table_id)
        .single();

      if (!table) {
        continue;
      }

      const fieldName = `${table.code}.${field.name}`;
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