import type { Metric, Dimension } from '../types';

export interface DDLResult {
  tableName: string;
  sql: string;
  columns: {
    name: string;
    type: string;
    comment: string;
  }[];
}

export function generateDDL(
  selectedMetrics: Metric[],
  selectedDims: Dimension[],
  tableName: string = 'ads_logical_model'
): DDLResult {
  const columns: DDLResult['columns'] = [];

  // 添加维度列
  selectedDims.forEach(dim => {
    columns.push({
      name: dim.code,
      type: 'STRING',
      comment: dim.name,
    });
  });

  // 添加指标列
  selectedMetrics.forEach(metric => {
    let sqlExpr = '';
    let colType = 'BIGINT';

    switch (metric.type) {
      case 'atomic':
        sqlExpr = `${metric.agg}(${metric.measure})`;
        colType = metric.agg === 'COUNT' || metric.agg === 'COUNT_DISTINCT' ? 'BIGINT' : 'DECIMAL(18,2)';
        break;
      case 'derived':
        sqlExpr = `SUM(CASE WHEN ${metric.condition} THEN 1 ELSE 0 END)`;
        colType = 'BIGINT';
        break;
      case 'composite':
        sqlExpr = metric.formula || '';
        colType = 'DECIMAL(18,4)';
        break;
    }

    columns.push({
      name: `metric_${metric.id}`,
      type: colType,
      comment: `${metric.name} (${sqlExpr})`,
    });
  });

  // 生成SQL
  const selectColumns = columns.map(col => `  ${col.name}`).join(',\n');
  const groupByDims = selectedDims.map(dim => dim.code).join(', ');

  const sql = `CREATE TABLE ${tableName} AS
SELECT
${selectColumns}
FROM dwd_source_table
${groupByDims ? `GROUP BY ${groupByDims}` : ''};`;

  return {
    tableName,
    sql,
    columns,
  };
}

export function previewLogicalTable(
  selectedMetrics: Metric[],
  selectedDims: Dimension[]
): { dims: string[]; metrics: string[] } {
  return {
    dims: selectedDims.map(d => d.name),
    metrics: selectedMetrics.map(m => m.name),
  };
}
