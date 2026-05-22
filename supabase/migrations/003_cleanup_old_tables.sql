-- 清理旧表和 KV Store 数据
-- 创建时间: 2026-05-21
-- 警告: 此脚本会永久删除旧数据，请确认新系统稳定后再执行！

-- ============================================
-- 执行前检查清单
-- ============================================
-- [ ] physical-tables 和 fields API 连续 7 天零 5xx 错误
-- [ ] 查询延迟 < 迁移前基准的 110%
-- [ ] 零用户报告的数据差异
-- [ ] 已备份所有原始数据

-- ============================================
-- Part 1: 备份原始数据（可选但推荐）
-- ============================================

-- 创建备份表
CREATE TABLE IF NOT EXISTS backup_dimensions AS SELECT * FROM dimensions;
CREATE TABLE IF NOT EXISTS backup_fact_tables AS SELECT * FROM fact_tables;
CREATE TABLE IF NOT EXISTS backup_kv_store AS SELECT * FROM kv_store_7b7e4046;

-- ============================================
-- Part 2: 删除旧表
-- ============================================

-- 删除 dimensions 表（数据已迁移到 physical_tables）
DROP TABLE IF EXISTS dimensions CASCADE;

-- 删除 fact_tables 表（数据已迁移到 physical_tables）
DROP TABLE IF EXISTS fact_tables CASCADE;

-- ============================================
-- Part 3: 清理 KV Store 数据
-- ============================================

-- 删除 properties 相关的 KV 数据（已迁移到 fields 表）
DELETE FROM kv_store_7b7e4046 WHERE key LIKE 'property:%';

-- 删除 dimension 相关的 KV 数据（如果有）
DELETE FROM kv_store_7b7e4046 WHERE key LIKE 'dimension:%';

-- 删除 metric 相关的 KV 数据（如果有）
DELETE FROM kv_store_7b7e4046 WHERE key LIKE 'metric:%';

-- ============================================
-- Part 4: 清理相关索引和触发器
-- ============================================

-- 删除旧表的触发器（如果存在）
DROP TRIGGER IF EXISTS update_dimensions_updated_at ON dimensions;
DROP TRIGGER IF EXISTS update_fact_tables_updated_at ON fact_tables;

-- ============================================
-- Part 5: 更新 CLAUDE.md 文档（手动）
-- ============================================

/*
请在 CLAUDE.md 中更新以下内容：
1. 数据模型说明：使用 physical_tables 和 fields 表
2. API 端点：推荐使用 /physical-tables 和 /fields
3. 废弃端点：标记 /dimensions 和 /fact-tables 为已废弃
*/

-- ============================================
-- Part 6: 验证清理结果
-- ============================================

-- 检查旧表是否已删除
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'dimensions') THEN
    RAISE EXCEPTION 'dimensions 表仍然存在，清理未完成';
  END IF;
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'fact_tables') THEN
    RAISE EXCEPTION 'fact_tables 表仍然存在，清理未完成';
  END IF;
END $$;

-- 检查 physical_tables 和 fields 表是否正常
DO $$
DECLARE
  pt_count INTEGER;
  f_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO pt_count FROM physical_tables;
  SELECT COUNT(*) INTO f_count FROM fields;

  IF pt_count = 0 THEN
    RAISE EXCEPTION 'physical_tables 表为空，请检查迁移';
  END IF;

  RAISE NOTICE '清理完成: physical_tables 有 % 条记录, fields 有 % 条记录', pt_count, f_count;
END $$;

-- ============================================
-- 回滚脚本（如果需要恢复）
-- ============================================

/*
-- 警告: 此回滚脚本仅用于紧急恢复
-- 如果新系统出现问题，可以执行以下脚本

-- 恢复 dimensions 表
CREATE TABLE dimensions AS SELECT * FROM backup_dimensions;

-- 恢复 fact_tables 表
CREATE TABLE fact_tables AS SELECT * FROM backup_fact_tables;

-- 恢复主键和约束
ALTER TABLE dimensions ADD PRIMARY KEY (id);
ALTER TABLE fact_tables ADD PRIMARY KEY (id);
ALTER TABLE dimensions ADD CONSTRAINT dimensions_code_key UNIQUE (code);
ALTER TABLE fact_tables ADD CONSTRAINT fact_tables_code_key UNIQUE (code);

-- 恢复触发器
CREATE TRIGGER update_dimensions_updated_at
  BEFORE UPDATE ON dimensions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_fact_tables_updated_at
  BEFORE UPDATE ON fact_tables
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 恢复 KV Store 数据（从 backup_kv_store）
INSERT INTO kv_store_7b7e4046
SELECT * FROM backup_kv_store
WHERE key LIKE 'property:%' OR key LIKE 'dimension:%' OR key LIKE 'metric:%'
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
*/
