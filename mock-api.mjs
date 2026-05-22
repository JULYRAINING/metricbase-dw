/**
 * Mock API Server for testing
 * Simulates Supabase Edge Functions endpoints
 */

import http from 'http';
import url from 'url';

const PORT = 54322; // Use different port to avoid conflicts

// Mock data store
const dataStore = {
  categories: [],
  properties: [],
  dimensions: [],
  factTables: [],
  metrics: [
    { id: 'metric_001', code: 'gmv', name: 'GMV', type: 'atomic', dims: ['time', 'province', 'city'] },
    { id: 'metric_002', code: 'order_count', name: '订单数', type: 'atomic', dims: ['time', 'province', 'channel'] },
    { id: 'metric_003', code: 'user_count', name: '用户数', type: 'compound', base_metrics: ['order_count'] },
    { id: 'metric_maoli', code: 'maoli_rate', name: '毛利率', type: 'composite', base_metrics: ['profit', 'revenue'] }
  ],
};

// Helper to generate IDs
const generateId = () => Math.random().toString(36).substr(2, 9);

// Parse request body
const parseBody = (req) => {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        resolve({});
      }
    });
  });
};

// Send response
const sendResponse = (res, statusCode, data) => {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });
  res.end(JSON.stringify(data));
};

// Request handler
const handler = async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname;
  const method = req.method;

  console.log(`${method} ${path}`);

  // CORS preflight
  if (method === 'OPTIONS') {
    sendResponse(res, 200, {});
    return;
  }

  try {
    // Health check
    if (path === '/health' && method === 'GET') {
      sendResponse(res, 200, { status: 'ok', timestamp: new Date().toISOString() });
      return;
    }

    // Categories API
    if (path === '/categories') {
      if (method === 'GET') {
        const { search, parent_id } = parsedUrl.query;
        let result = dataStore.categories;
        if (search) {
          result = result.filter(c =>
            c.name.toLowerCase().includes(search.toLowerCase()) ||
            c.code.toLowerCase().includes(search.toLowerCase())
          );
        }
        if (parent_id !== undefined) {
          result = result.filter(c => c.parent_id === parent_id || (!c.parent_id && !parent_id));
        }
        sendResponse(res, 200, { success: true, data: result });
        return;
      }

      if (method === 'POST') {
        const body = await parseBody(req);
        const newCategory = {
          id: generateId(),
          ...body,
          path: body.parent_id ? `${body.parent_id}.${generateId()}` : '',
          level: body.parent_id ? 1 : 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        dataStore.categories.push(newCategory);
        sendResponse(res, 201, { success: true, data: newCategory });
        return;
      }
    }

    // Category tree
    if (path === '/categories/tree' && method === 'GET') {
      const buildTree = (parentId = null) => {
        return dataStore.categories
          .filter(c => c.parent_id === parentId || (!c.parent_id && !parentId))
          .map(c => ({
            ...c,
            children: buildTree(c.id),
          }));
      };
      sendResponse(res, 200, { success: true, data: buildTree() });
      return;
    }

    // Single category
    const categoryMatch = path.match(/^\/categories\/([^\/]+)$/);
    if (categoryMatch && method === 'PUT') {
      const id = categoryMatch[1];
      const body = await parseBody(req);
      const index = dataStore.categories.findIndex(c => c.id === id);
      if (index === -1) {
        sendResponse(res, 404, { success: false, error: 'Category not found' });
        return;
      }
      dataStore.categories[index] = { ...dataStore.categories[index], ...body, updated_at: new Date().toISOString() };
      sendResponse(res, 200, { success: true, data: dataStore.categories[index] });
      return;
    }

    if (categoryMatch && method === 'DELETE') {
      const id = categoryMatch[1];
      const index = dataStore.categories.findIndex(c => c.id === id);
      if (index === -1) {
        sendResponse(res, 404, { success: false, error: 'Category not found' });
        return;
      }
      const hasChildren = dataStore.categories.some(c => c.parent_id === id);
      if (hasChildren) {
        sendResponse(res, 409, { success: false, error: 'Category has children' });
        return;
      }
      dataStore.categories.splice(index, 1);
      sendResponse(res, 200, { success: true });
      return;
    }

    // Properties API
    if (path === '/properties') {
      if (method === 'GET') {
        const { component_id } = parsedUrl.query;
        let result = dataStore.properties;
        if (component_id) {
          result = result.filter(p => p.component_id === component_id);
        }
        sendResponse(res, 200, { success: true, data: result });
        return;
      }

      if (method === 'POST') {
        const body = await parseBody(req);
        const newProperty = {
          id: generateId(),
          ...body,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        dataStore.properties.push(newProperty);
        sendResponse(res, 201, { success: true, data: newProperty });
        return;
      }
    }

    // Single property
    const propertyMatch = path.match(/^\/properties\/([^\/]+)$/);
    if (propertyMatch && method === 'PUT') {
      const id = propertyMatch[1];
      const body = await parseBody(req);
      const index = dataStore.properties.findIndex(p => p.id === id);
      if (index === -1) {
        sendResponse(res, 404, { success: false, error: 'Property not found' });
        return;
      }
      dataStore.properties[index] = { ...dataStore.properties[index], ...body, updated_at: new Date().toISOString() };
      sendResponse(res, 200, { success: true, data: dataStore.properties[index] });
      return;
    }

    if (propertyMatch && method === 'DELETE') {
      const id = propertyMatch[1];
      const index = dataStore.properties.findIndex(p => p.id === id);
      if (index === -1) {
        sendResponse(res, 404, { success: false, error: 'Property not found' });
        return;
      }
      dataStore.properties.splice(index, 1);
      sendResponse(res, 200, { success: true });
      return;
    }

    // Analysis API - Mock SQL execution
    if (path === '/analysis/query' && method === 'POST') {
      const body = await parseBody(req);
      const { indicator_ids, dimension_ids, filters } = body;

      // Generate columns based on request
      const dimIds = dimension_ids || [];
      const metricIds = indicator_ids || [];

      let columns = dimIds.map((id, idx) => `dimension_${idx + 1}`);
      columns = columns.concat(metricIds.map((id, idx) => `metric_${idx + 1}`));
      if (columns.length === 0) {
        columns = ['time', 'region', 'value'];
      }

      // Generate sample rows
      const rows = [
        ['2024-01-01', '北京', 12345],
        ['2024-01-01', '上海', 23456],
        ['2024-01-02', '北京', 13579],
        ['2024-01-02', '上海', 24680],
      ];

      // Generate SQL similar to preview
      const dimNames = dimIds.map((id, i) => `dim_${i + 1}`);
      const metricNames = metricIds.map((id, i) => dataStore.metrics.find(m => m.id === id)?.code || `metric_${i + 1}`);

      let sql = `WITH layer0 AS (SELECT ${dimNames.join(', ')}, SUM(value) as val FROM source GROUP BY ${dimNames.join(', ')})\n`;
      sql += `SELECT ${dimNames.join(', ')}, ${metricNames.join(', ')} FROM layer0 ORDER BY 1 DESC;`;

      sendResponse(res, 200, {
        success: true,
        data: {
          columns,
          rows,
          total: rows.length,
          sql,
        }
      });
      return;
    }

    if (path === '/analysis/preview-sql' && method === 'POST') {
      const body = await parseBody(req);
      const { indicator_ids, dimension_ids, filters } = body;

      // Generate realistic CTE three-layer SQL based on request params
      const metricIds = indicator_ids || [];
      const dimIds = dimension_ids || [];

      // Get metric codes from mock data
      const metricNames = metricIds.map(id => {
        const metric = dataStore.metrics?.find(m => m.id === id);
        return metric ? metric.code : `metric_${id.substring(0, 6)}`;
      });

      // Get dimension codes
      const dimNames = dimIds.map(id => {
        const dim = dataStore.dimensions?.find(d => d.id === id);
        return dim ? dim.code : `dim_${id.substring(0, 6)}`;
      });

      // Build CTE SQL
      let sql = `-- CTE Three-Layer SQL Query\n`;
      sql += `-- Metrics: ${metricNames.join(', ') || 'none'}\n`;
      sql += `-- Dimensions: ${dimNames.join(', ') || 'none'}\n\n`;

      // Layer 0: Atomic subqueries
      if (metricNames.length > 0) {
        sql += `WITH layer0_metrics AS (\n`;
        sql += `  SELECT\n`;
        sql += dimNames.map(d => `    ${d}`).join(',\n');
        if (dimNames.length > 0) sql += ',\n';
        sql += `    SUM(value) as ${metricNames[0]}\n`;
        sql += `  FROM source_table\n`;
        sql += `  GROUP BY ${dimNames.join(', ') || '1'}\n`;
        sql += `),\n\n`;
      }

      // Layer 1: Derived metrics
      sql += `layer1_derived AS (\n`;
      sql += `  SELECT\n`;
      sql += dimNames.map(d => `    ${d}`).join(',\n');
      if (dimNames.length > 0) sql += ',\n';
      if (metricNames.length > 0) {
        sql += `    ${metricNames[0]} as calculated_value\n`;
      } else {
        sql += `    1 as placeholder\n`;
      }
      sql += `  FROM layer0_metrics\n`;
      sql += `),\n\n`;

      // Layer 2: Final aggregation
      sql += `layer2_final AS (\n`;
      sql += `  SELECT\n`;
      sql += dimNames.map(d => `    ${d}`).join(',\n');
      if (dimNames.length > 0) sql += ',\n';
      sql += `    calculated_value as metric_value\n`;
      sql += `  FROM layer1_derived\n`;

      // Add filters
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

    if (path === '/analysis/common-dimensions' && method === 'POST') {
      sendResponse(res, 200, {
        success: true,
        data: [
          { id: 'dim1', name: '时间', code: 'time' },
          { id: 'dim2', name: '地区', code: 'region' },
        ]
      });
      return;
    }

    // 404 for unknown routes
    sendResponse(res, 404, { success: false, error: 'Not found' });

  } catch (error) {
    console.error('Error:', error);
    sendResponse(res, 500, { success: false, error: 'Internal server error' });
  }
};

const server = http.createServer(handler);
server.listen(PORT, () => {
  console.log(`Mock API server running on http://127.0.0.1:${PORT}`);
  console.log(`Endpoints:`);
  console.log(`  - GET    /health`);
  console.log(`  - GET    /categories`);
  console.log(`  - POST   /categories`);
  console.log(`  - GET    /categories/tree`);
  console.log(`  - PUT    /categories/:id`);
  console.log(`  - DELETE /categories/:id`);
  console.log(`  - GET    /properties`);
  console.log(`  - POST   /properties`);
  console.log(`  - PUT    /properties/:id`);
  console.log(`  - DELETE /properties/:id`);
  console.log(`  - POST   /analysis/query`);
  console.log(`  - POST   /analysis/preview-sql`);
  console.log(`  - POST   /analysis/common-dimensions`);
});
