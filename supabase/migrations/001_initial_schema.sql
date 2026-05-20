-- 指标管理平台初始数据库Schema
-- 创建时间: 2026-05-19

-- 维度表 (DWD层维度定义)
CREATE TABLE IF NOT EXISTS dimensions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 事实表 (DWD层事实表定义)
CREATE TABLE IF NOT EXISTS fact_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  dims TEXT[] DEFAULT '{}',
  measures TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 指标表 (支持原子/衍生/复合三类指标)
CREATE TABLE IF NOT EXISTS metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('atomic', 'derived', 'composite')),
  source TEXT, -- 来源事实表编码(原子)或来源指标ID(衍生)
  measure TEXT, -- 度量字段(原子指标使用)
  agg TEXT, -- 聚合方式(原子指标使用): SUM, COUNT, COUNT_DISTINCT, MAX, MIN
  condition TEXT, -- 业务限定条件(衍生指标使用)
  formula TEXT, -- 计算公式(复合指标使用)
  base_metrics TEXT[] DEFAULT '{}', -- 依赖的基础指标编码数组(复合指标使用)
  dims TEXT[] DEFAULT '{}', -- 继承的可分析维度编码数组
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 创建更新时间自动更新触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为各表添加更新时间触发器
DROP TRIGGER IF EXISTS update_dimensions_updated_at ON dimensions;
CREATE TRIGGER update_dimensions_updated_at
  BEFORE UPDATE ON dimensions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_fact_tables_updated_at ON fact_tables;
CREATE TRIGGER update_fact_tables_updated_at
  BEFORE UPDATE ON fact_tables
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_metrics_updated_at ON metrics;
CREATE TRIGGER update_metrics_updated_at
  BEFORE UPDATE ON metrics
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 创建索引优化查询性能
CREATE INDEX IF NOT EXISTS idx_dimensions_code ON dimensions(code);
CREATE INDEX IF NOT EXISTS idx_fact_tables_code ON fact_tables(code);
CREATE INDEX IF NOT EXISTS idx_metrics_type ON metrics(type);
CREATE INDEX IF NOT EXISTS idx_metrics_code ON metrics(name);

-- 添加表注释
COMMENT ON TABLE dimensions IS '数据仓库维度定义表(DWD层)';
COMMENT ON TABLE fact_tables IS '数据仓库事实表定义表(DWD层)';
COMMENT ON TABLE metrics IS '指标定义表(支持原子/衍生/复合三类)';
