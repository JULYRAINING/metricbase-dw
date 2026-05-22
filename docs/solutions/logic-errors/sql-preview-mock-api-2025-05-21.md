---
title: SQL Preview Mock API Returning Static Instead of Dynamic CTE SQL
date: 2025-05-21
category: logic-errors
module: sql-engine
problem_type: logic_error
component: development_workflow
symptoms:
  - SQL preview modal showed generic placeholder SQL regardless of user selections
  - No correlation between selected metrics/dimensions and generated SQL
  - Preview SQL did not reflect the actual query structure
root_cause: logic_error
resolution_type: code_fix
severity: medium
tags: [sql-engine, mock-api, cte, model-builder, analysis-api]
---

# SQL Preview Mock API Returning Static Instead of Dynamic CTE SQL

## Problem
The `/analysis/preview-sql` endpoint in the mock API was returning a fixed mock SQL string (`SELECT * FROM table WHERE condition`) instead of generating proper CTE three-layer SQL based on the actual selected metrics and dimensions passed in the request body. This prevented users from verifying their analysis configuration through the SQL preview.

## Symptoms
- SQL preview modal showed generic placeholder SQL: `SELECT * FROM table WHERE condition`
- Selected metrics and dimensions had no effect on the generated SQL
- Users could not verify their analysis configuration before executing queries
- The preview did not reflect the actual CTE three-layer structure that would execute

## What Didn't Work
- Initial mock implementation used static placeholder SQL regardless of request parameters
- No parsing of `indicator_ids`, `dimension_ids`, or `filters` from the request body

## Solution

Updated the `/analysis/preview-sql` endpoint in `mock-api.mjs` to generate dynamic CTE SQL:

```javascript
if (path === '/analysis/preview-sql' && method === 'POST') {
  const body = await parseBody(req);
  const { indicator_ids, dimension_ids, filters } = body;

  // Get metric codes from mock data
  const metricIds = indicator_ids || [];
  const dimIds = dimension_ids || [];

  // Lookup names from dataStore
  const metricNames = metricIds.map(id => {
    const metric = dataStore.metrics?.find(m => m.id === id);
    return metric ? metric.code : `metric_${id.substring(0, 6)}`;
  });

  const dimNames = dimIds.map(id => {
    const dim = dataStore.dimensions?.find(d => d.id === id);
    return dim ? dim.code : `dim_${id.substring(0, 6)}`;
  });

  // Build CTE SQL with three layers
  let sql = `-- CTE Three-Layer SQL Query\n`;
  sql += `-- Metrics: ${metricNames.join(', ') || 'none'}\n`;
  sql += `-- Dimensions: ${dimNames.join(', ') || 'none'}\n\n`;

  // Layer 0: Atomic subqueries
  sql += `WITH layer0_metrics AS (\n`;
  sql += `  SELECT\n`;
  sql += dimNames.map(d => `    ${d}`).join(',\n');
  if (dimNames.length > 0) sql += ',\n';
  sql += `    SUM(value) as ${metricNames[0]}\n`;
  sql += `  FROM source_table\n`;
  sql += `  GROUP BY ${dimNames.join(', ') || '1'}\n`;
  sql += `),\n\n`;

  // Layer 1: Derived metrics
  sql += `layer1_derived AS (\n`;
  sql += `  SELECT\n`;
  sql += dimNames.map(d => `    ${d}`).join(',\n');
  if (dimNames.length > 0) sql += ',\n';
  sql += `    ${metricNames[0]} as calculated_value\n`;
  sql += `  FROM layer0_metrics\n`;
  sql += `),\n\n`;

  // Layer 2: Final aggregation
  sql += `layer2_final AS (\n`;
  sql += `  SELECT\n`;
  sql += dimNames.map(d => `    ${d}`).join(',\n');
  if (dimNames.length > 0) sql += ',\n';
  sql += `    calculated_value as metric_value\n`;
  sql += `  FROM layer1_derived\n`;

  // Add filters if present
  if (filters && filters.length > 0) {
    sql += `  WHERE\n`;
    const filterConditions = filters.map(f => {
      return `    ${f.property_id} ${f.operator} '${f.value}'`;
    });
    sql += filterConditions.join(' AND\n');
    sql += '\n';
  }

  sql += `)\n\n`;

  // Final SELECT
  sql += `SELECT\n`;
  sql += dimNames.map(d => `  ${d}`).join(',\n');
  if (dimNames.length > 0) sql += ',\n';
  sql += `  metric_value\n`;
  sql += `FROM layer2_final\n`;
  sql += `ORDER BY ${dimNames[0] || 'metric_value'} DESC;`;

  sendResponse(res, 200, {
    success: true,
    data: { sql }
  });
  return;
}
```

## Why This Works
- **Dynamic SQL generation**: Parses request parameters (`indicator_ids`, `dimension_ids`, `filters`) to generate SQL that matches user selections
- **Three-layer CTE structure**: Mirrors the actual production SQL engine architecture (Layer 0 atomic → Layer 1 derived → Layer 2 final)
- **Human-readable codes**: Resolves metric and dimension IDs to their actual codes for readable SQL output
- **Filter support**: Dynamically injects filter conditions into Layer 2's WHERE clause

## Prevention
- Always parse request parameters in mock APIs instead of returning static mocks
- Structure mock responses to match production data contracts
- Include clear comments in mock SQL output to aid debugging
- Test preview endpoints with various combinations of metrics and dimensions

## Related
- Related Components: model-builder, analysis-api
- Implementation Plan: docs/plans/2026-05-20-001-feat-align-with-dp-project-plan.md
