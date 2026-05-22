-- 物理表统一迁移
-- 创建时间: 2026-05-21
-- 目的: 将 dimensions 和 fact_tables 合并为 physical_tables，创建统一的 fields 表

-- ============================================
-- Part 1: 创建新表结构
-- ============================================

-- 物理表（统一维度和事实表）
CREATE TABLE IF NOT EXISTS physical_tables (
  id UUID PRIMARY KEY,  -- 不使用 DEFAULT gen_random_uuid()，迁移时保留原 ID
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  table_type TEXT NOT NULL CHECK (table_type IN ('dimension', 'fact')),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 字段表（统一所有表的字段定义）
CREATE TABLE IF NOT EXISTS fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('int', 'string', 'date', 'datetime', 'decimal', 'boolean')),
  field_role TEXT NOT NULL CHECK (field_role IN ('dimension_key', 'measure', 'attribute')),
  table_id UUID NOT NULL REFERENCES physical_tables(id) ON DELETE CASCADE,
  dimension_ref_id UUID REFERENCES physical_tables(id) ON DELETE SET NULL,
  description TEXT,
  is_join_key BOOLEAN DEFAULT FALSE,
  join_key_target TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_field_name_per_table UNIQUE (table_id, name)
);

-- 创建索引策略
CREATE INDEX IF NOT EXISTS idx_fields_table_id_role ON fields(table_id, field_role);
CREATE INDEX IF NOT EXISTS idx_fields_dimension_ref ON fields(dimension_ref_id) WHERE field_role = 'dimension_key';
CREATE INDEX IF NOT EXISTS idx_physical_tables_type ON physical_tables(table_type);
CREATE INDEX IF NOT EXISTS idx_physical_tables_code ON physical_tables(code);

-- 添加表注释
COMMENT ON TABLE physical_tables IS '统一物理表定义（包含维度表和事实表）';
COMMENT ON TABLE fields IS '物理表字段定义（支持维度键、度量、属性三种角色）';
COMMENT ON COLUMN fields.field_role IS 'dimension_key: 维度关联键; measure: 度量字段; attribute: 普通属性';
COMMENT ON COLUMN fields.dimension_ref_id IS '维度引用，指向另一个物理表（支持雪花模型）';

-- ============================================
-- Part 2: 数据迁移
-- ============================================

-- 2.1 迁移 dimensions 数据到 physical_tables（保留原 ID）
INSERT INTO physical_tables (id, name, code, table_type, description, created_at, updated_at)
SELECT id, name, code, 'dimension', description, created_at, updated_at
FROM dimensions;

-- 2.2 迁移 fact_tables 数据到 physical_tables（保留原 ID）
INSERT INTO physical_tables (id, name, code, table_type, description, created_at, updated_at)
SELECT id, name, code, 'fact', description, created_at, updated_at
FROM fact_tables;

-- 2.3 将 fact_tables.dims[] 转换为 fields 记录
-- dims[] 存储的是维度代码（如 'time', 'province'），需转换为维度 ID
INSERT INTO fields (id, name, type, field_role, table_id, dimension_ref_id, created_at, updated_at)
SELECT
  gen_random_uuid(),
  dim_code,
  'string',
  'dimension_key',
  ft.id,
  d.id,
  ft.created_at,
  ft.updated_at
FROM fact_tables ft
CROSS JOIN LATERAL unnest(ft.dims) AS dim_code
LEFT JOIN dimensions d ON d.code = dim_code
WHERE array_length(ft.dims, 1) > 0;

-- 2.4 将 fact_tables.measures[] 转换为 fields 记录
INSERT INTO fields (id, name, type, field_role, table_id, created_at, updated_at)
SELECT
  gen_random_uuid(),
  measure_name,
  'decimal',
  'measure',
  ft.id,
  ft.created_at,
  ft.updated_at
FROM fact_tables ft
CROSS JOIN LATERAL unnest(ft.measures) AS measure_name
WHERE array_length(ft.measures, 1) > 0;

-- ============================================
-- Part 3: 迁移 KV Store 的 properties 数据
-- ============================================

-- 注意: properties 存储在 KV Store（kv_store_7b7e4046 表）中
-- 需要从 JSONB 中提取数据并迁移到 fields 表

INSERT INTO fields (id, name, type, field_role, table_id, dimension_ref_id, description, is_join_key, join_key_target, created_at, updated_at)
SELECT
  (kv.value->>'id')::UUID,
  kv.value->>'name',
  kv.value->>'type',
  'attribute',
  (kv.value->>'component_id')::UUID,
  CASE WHEN kv.value->>'dimension_id' IS NOT NULL THEN (kv.value->>'dimension_id')::UUID ELSE NULL END,
  kv.value->>'description',
  COALESCE((kv.value->>'is_join_key')::BOOLEAN, FALSE),
  kv.value->>'join_key_target',
  COALESCE((kv.value->>'created_at')::TIMESTAMPTZ, now()),
  COALESCE((kv.value->>'updated_at')::TIMESTAMPTZ, now())
FROM kv_store_7b7e4046 kv
WHERE kv.key LIKE 'property:%'
  AND kv.value->>'component_id' IS NOT NULL
  AND EXISTS (SELECT 1 FROM physical_tables pt WHERE pt.id = (kv.value->>'component_id')::UUID);

-- ============================================
-- Part 4: 更新 metrics 表约束
-- ============================================

-- 更新 metrics.type 约束，添加新的指标类型
ALTER TABLE metrics DROP CONSTRAINT IF EXISTS metrics_type_check;
ALTER TABLE metrics ADD CONSTRAINT metrics_type_check
  CHECK (type IN ('atomic', 'derived', 'composite', 'nested', 'derived_from_composite'));

-- ============================================
-- Part 5: 添加更新时间触发器
-- ============================================

-- physical_tables 更新时间触发器
DROP TRIGGER IF EXISTS update_physical_tables_updated_at ON physical_tables;
CREATE TRIGGER update_physical_tables_updated_at
  BEFORE UPDATE ON physical_tables
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- fields 更新时间触发器
DROP TRIGGER IF EXISTS update_fields_updated_at ON fields;
CREATE TRIGGER update_fields_updated_at
  BEFORE UPDATE ON fields
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
