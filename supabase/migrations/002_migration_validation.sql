-- 迁移验证脚本
-- 创建时间: 2026-05-21
-- 目的: 验证数据迁移完整性，提供回滚机制

-- ============================================
-- Part 1: 数据完整性校验
-- ============================================

-- 创建验证结果表
CREATE TABLE IF NOT EXISTS migration_validation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  check_name TEXT NOT NULL,
  source_count BIGINT,
  target_count BIGINT,
  status TEXT CHECK (status IN ('PASS', 'FAIL', 'WARNING')),
  details TEXT,
  checked_at TIMESTAMPTZ DEFAULT now()
);

-- 清空之前的验证结果
TRUNCATE migration_validation;

-- 检查 1: dimensions 迁移数量
INSERT INTO migration_validation (check_name, source_count, target_count, status, details)
SELECT
  'dimensions → physical_tables',
  (SELECT COUNT(*) FROM dimensions),
  (SELECT COUNT(*) FROM physical_tables WHERE table_type = 'dimension'),
  CASE
    WHEN (SELECT COUNT(*) FROM dimensions) = (SELECT COUNT(*) FROM physical_tables WHERE table_type = 'dimension') THEN 'PASS'
    ELSE 'FAIL'
  END,
  '维度表迁移数量对比';

-- 检查 2: fact_tables 迁移数量
INSERT INTO migration_validation (check_name, source_count, target_count, status, details)
SELECT
  'fact_tables → physical_tables',
  (SELECT COUNT(*) FROM fact_tables),
  (SELECT COUNT(*) FROM physical_tables WHERE table_type = 'fact'),
  CASE
    WHEN (SELECT COUNT(*) FROM fact_tables) = (SELECT COUNT(*) FROM physical_tables WHERE table_type = 'fact') THEN 'PASS'
    ELSE 'FAIL'
  END,
  '事实表迁移数量对比';

-- 检查 3: dims[] 数组总元素数与 fields.dimension_key 数量
INSERT INTO migration_validation (check_name, source_count, target_count, status, details)
SELECT
  'dims[] → fields (dimension_key)',
  (SELECT COALESCE(SUM(array_length(dims, 1)), 0) FROM fact_tables),
  (SELECT COUNT(*) FROM fields WHERE field_role = 'dimension_key'),
  CASE
    WHEN (SELECT COALESCE(SUM(array_length(dims, 1)), 0) FROM fact_tables) =
         (SELECT COUNT(*) FROM fields WHERE field_role = 'dimension_key') THEN 'PASS'
    ELSE 'WARNING'  -- 可能存在孤儿维度代码
  END,
  '维度键数量对比（如有差异请检查孤儿维度代码）';

-- 检查 4: measures[] 数组总元素数与 fields.measure 数量
INSERT INTO migration_validation (check_name, source_count, target_count, status, details)
SELECT
  'measures[] → fields (measure)',
  (SELECT COALESCE(SUM(array_length(measures, 1)), 0) FROM fact_tables),
  (SELECT COUNT(*) FROM fields WHERE field_role = 'measure'),
  CASE
    WHEN (SELECT COALESCE(SUM(array_length(measures, 1)), 0) FROM fact_tables) =
         (SELECT COUNT(*) FROM fields WHERE field_role = 'measure') THEN 'PASS'
    ELSE 'FAIL'
  END,
  '度量字段数量对比';

-- 检查 5: properties 迁移数量
INSERT INTO migration_validation (check_name, source_count, target_count, status, details)
SELECT
  'properties (KV) → fields (attribute)',
  (SELECT COUNT(*) FROM kv_store_7b7e4046 WHERE key LIKE 'property:%'),
  (SELECT COUNT(*) FROM fields WHERE field_role = 'attribute'),
  CASE
    WHEN (SELECT COUNT(*) FROM kv_store_7b7e4046 WHERE key LIKE 'property:%') =
         (SELECT COUNT(*) FROM fields WHERE field_role = 'attribute') THEN 'PASS'
    ELSE 'WARNING'  -- 可能存在无效的 component_id
  END,
  '属性字段迁移数量对比';

-- 检查 6: ID 保留验证（确保原 ID 存在于新表）
INSERT INTO migration_validation (check_name, source_count, target_count, status, details)
SELECT
  'ID 保留验证 - dimensions',
  (SELECT COUNT(*) FROM dimensions d WHERE EXISTS (SELECT 1 FROM physical_tables pt WHERE pt.id = d.id)),
  (SELECT COUNT(*) FROM dimensions),
  CASE
    WHEN (SELECT COUNT(*) FROM dimensions) =
         (SELECT COUNT(*) FROM dimensions d WHERE EXISTS (SELECT 1 FROM physical_tables pt WHERE pt.id = d.id)) THEN 'PASS'
    ELSE 'FAIL'
  END,
  '维度 ID 保留验证';

-- 检查 7: ID 保留验证 - fact_tables
INSERT INTO migration_validation (check_name, source_count, target_count, status, details)
SELECT
  'ID 保留验证 - fact_tables',
  (SELECT COUNT(*) FROM fact_tables ft WHERE EXISTS (SELECT 1 FROM physical_tables pt WHERE pt.id = ft.id)),
  (SELECT COUNT(*) FROM fact_tables),
  CASE
    WHEN (SELECT COUNT(*) FROM fact_tables) =
         (SELECT COUNT(*) FROM fact_tables ft WHERE EXISTS (SELECT 1 FROM physical_tables pt WHERE pt.id = ft.id)) THEN 'PASS'
    ELSE 'FAIL'
  END,
  '事实表 ID 保留验证';

-- 检查 8: 维度引用有效性
INSERT INTO migration_validation (check_name, source_count, target_count, status, details)
SELECT
  '维度引用有效性',
  (SELECT COUNT(*) FROM fields f WHERE f.dimension_ref_id IS NOT NULL),
  (SELECT COUNT(*) FROM fields f WHERE f.dimension_ref_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM physical_tables pt WHERE pt.id = f.dimension_ref_id
  )),
  CASE
    WHEN (SELECT COUNT(*) FROM fields f WHERE f.dimension_ref_id IS NOT NULL) =
         (SELECT COUNT(*) FROM fields f WHERE f.dimension_ref_id IS NOT NULL AND EXISTS (
           SELECT 1 FROM physical_tables pt WHERE pt.id = f.dimension_ref_id
         )) THEN 'PASS'
    ELSE 'FAIL'
  END,
  '所有维度引用必须指向有效的物理表';

-- ============================================
-- Part 2: 查看验证结果
-- ============================================

-- 返回所有验证结果
SELECT * FROM migration_validation ORDER BY checked_at;

-- 如果有任何 FAIL，阻止继续迁移
DO $$
DECLARE
  fail_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO fail_count FROM migration_validation WHERE status = 'FAIL';
  IF fail_count > 0 THEN
    RAISE EXCEPTION '迁移验证失败: % 项检查未通过。请检查 migration_validation 表详情。', fail_count;
  END IF;
END $$;

-- ============================================
-- Part 3: 回滚脚本（手动执行）
-- ============================================

-- 警告: 执行以下脚本将完全回滚迁移
-- 请在确认需要回滚后再执行

/*
-- 回滚步骤 1: 删除新表
DROP TABLE IF EXISTS fields CASCADE;
DROP TABLE IF EXISTS physical_tables CASCADE;
DROP TABLE IF EXISTS migration_validation CASCADE;

-- 回滚步骤 2: 恢复 metrics 约束
ALTER TABLE metrics DROP CONSTRAINT IF EXISTS metrics_type_check;
ALTER TABLE metrics ADD CONSTRAINT metrics_type_check
  CHECK (type IN ('atomic', 'derived', 'composite'));

-- 回滚完成提示
-- 原始 dimensions 和 fact_tables 表数据未受影响
-- 需要手动恢复 KV Store 中的 properties 数据（如需要）
*/
