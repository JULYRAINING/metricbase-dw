---
title: 对齐 dp 项目功能 - 指标平台能力扩展
type: feat
status: active
date: 2026-05-20
origin: 基于 brainstorm 分析结果
---

# 对齐 dp 项目功能 - 指标平台能力扩展

## Overview

本项目旨在将 IndicatorPlatform（前端 React + Supabase）功能对齐到 dp 项目（Django 后端）的完整数据平台能力，实现从基础的 CRUD 管理升级到支持复杂多维分析的完整指标平台。

核心目标：
1. 扩展数据层：支持完整的分类体系、字段定义、维度映射
2. 升级指标系统：支持嵌套指标（二次聚合）和衍生复合指标
3. 实现查询引擎：基于 CTE + UNION ALL 的三层 SQL 生成引擎
4. 构建分析能力：多维分析查询、SQL 预览、维度计算

## Problem Frame

当前 IndicatorPlatform 仅支持基础的维度、事实表、指标 CRUD，缺乏：
- 层级分类管理能力（Category 树）
- 字段级维度映射定义（Property）
- 复杂指标类型（嵌套、衍生复合）
- SQL 查询生成与执行能力
- 多维数据分析接口

这限制了平台作为数据仓库指标管理系统的实用性。

## Requirements Trace

- R1. 分类管理：支持指标的多级分类组织（父子层级）
- R2. 字段定义：支持事实表字段与维度的关联映射
- R3. 嵌套指标：支持基于二次聚合的嵌套指标（如"购买次数小于3的用户数"）
- R4. 衍生复合指标：支持在复合指标基础上添加筛选条件
- R5. SQL 引擎：支持基于 CTE 三层结构的复杂 SQL 生成
- R6. 多维分析：支持按维度分组、聚合、筛选的数据查询
- R7. SQL 预览：支持预览生成的查询 SQL 而不执行
- R8. 公共维度：支持计算多个指标的交集维度

## Scope Boundaries

- 本次实现不包含 Superset 集成（可后续追加）
- 不包含数据血缘追踪功能
- 不包含可视化图表功能
- 用户权限体系保持现有简单模式

### Deferred to Separate Tasks

- Superset 数据集自动创建：需要额外的 Superset API 集成
- 数据血缘追踪：大规模重构，建议未来版本实现
- 高级可视化图表分析：可使用现有查询 API 对接外部 BI

## Context & Research

### 参考实现

**dp 项目核心参考代码：**
- 模型定义：`/Users/macpro/IdeaProjects/dp/dp/model_reg/`
  - `indicator.py` - 基础指标模型与依赖解析
  - `atomic_indicator.py` - 原子指标定义
  - `derived_indicator.py` - 衍生指标与嵌套逻辑
  - `composite_indicator.py` - 复合指标公式
  - `component.py` - 数据模型（DIM/DWD/ADS）
  - `property.py` - 字段定义与维度映射
  - `category.py` - 分类树管理
- 查询引擎：`/Users/macpro/IdeaProjects/dp/dp/utils/query_engine/v2_engine.py`
  - CTE 三层架构（Layer0 UNION ALL → Layer1 CASE WHEN → Layer2 JOIN）
  - 六种指标类型处理逻辑
  - 维度 JOIN、筛选条件、HAVING 子句生成

### 现有架构

**IndicatorPlatform 当前架构：**
- 前端：React 18 + TypeScript + Vite + Tailwind v4 + shadcn/ui
- 后端：Supabase Edge Functions (Deno + Hono)
- 存储：Supabase KV Store（简单键值存储）
- 现有 API：`dimensions.ts`, `fact-tables.ts`, `metrics.ts`

### 技术约束

- KV Store 不适合复杂关系查询，需设计合理的键命名策略
- Edge Functions 执行时间限制：默认 300s（足够）
- Deno 运行时，需使用 npm 兼容包

## Key Technical Decisions

1. **数据存储策略**：继续使用 KV Store，但引入命名空间规范
   - `category:{id}` - 分类数据
   - `category:children:{id}` - 子分类列表
   - `property:{id}` - 字段定义
   - `component:{id}:properties` - 组件字段列表

2. **SQL 引擎移植策略**：将 Python v2_engine 逻辑完整移植为 TypeScript
   - 保持相同的 CTE 三层架构
   - 统一的 IndicatorNode 数据结构
   - 完整的运算符白名单校验

3. **指标类型扩展**：
   - 保持现有 atomic/derived/composite 三种基础类型
   - 新增 nested（嵌套，带二次聚合）
   - 新增 derived_from_composite（基于复合指标的衍生）

4. **API 路由设计**：
   - `/categories` - 分类管理
   - `/properties` - 字段定义（绑定到组件）
   - `/analysis/query` - 多维分析查询
   - `/analysis/preview-sql` - SQL 预览
   - `/analysis/common-dimensions` - 公共维度计算

## Implementation Units

### Phase 1: 数据层扩展（基础能力）

- [ ] **Unit 1: 分类管理（Category）**

**Goal:** 实现指标的多级分类体系，支持树形结构

**Requirements:** R1

**Dependencies:** None

**Files:**
- Create: `supabase/functions/server/categories.ts`
- Modify: `src/types/index.ts`（添加 Category 类型）
- Test: `supabase/functions/server/categories.test.ts`

**Approach:**
- 实现 Category 模型（id, name, code, parent_id, order, path）
- 支持树形结构操作：获取树、移动节点、获取子分类
- KV 存储策略：`category:{id}` 存储实体，`category:children:{parent_id}` 存储子ID列表

**Patterns to follow:**
- 参考 dp：`/Users/macpro/IdeaProjects/dp/dp/model_reg/category.py`
- 遵循现有 Edge Function 的 Hono 路由模式

**Test scenarios:**
- **Happy path**: 创建分类 → 创建子分类 → 获取树形结构
- **Edge case**: 移动分类到自身子节点（应阻止）
- **Error path**: 删除含有子分类的分类（处理方式：级联删除或阻止）

**Verification:**
- API 能正确处理三级分类嵌套
- 移动分类后路径(path)正确更新

---

- [ ] **Unit 2: 字段定义（Property）**

**Goal:** 实现事实表字段定义，支持维度关联映射

**Requirements:** R2

**Dependencies:** Unit 1 (需要 Component/Dimension 基础)

**Files:**
- Create: `supabase/functions/server/properties.ts`
- Modify: `src/types/index.ts`（添加 Property 类型）
- Modify: `supabase/functions/server/fact-tables.ts`（添加属性管理）
- Test: `supabase/functions/server/properties.test.ts`

**Approach:**
- Property 模型：id, name, type, description, component_id, dimension_id, is_join_key, join_key_target
- 支持定义字段-维度关联关系
- 在事实表中管理其字段列表

**Technical design:**
```
Property {
  id: string
  name: string              // 字段名
  type: 'int'|'string'|'date'|...
  component_id: string      // 所属组件（DWD表）
  dimension_id?: string     // 关联的维度ID
  description?: string
  is_join_key?: boolean     // 是否维度关联键
  join_key_target?: string  // 关联到维度的哪个字段
}
```

**Test scenarios:**
- **Happy path**: 为 DWD 表添加字段 → 关联到维度 → 查询字段列表
- **Integration**: 通过 Property 查询维度关联路径

**Verification:**
- 字段定义能正确关联到维度
- 查询引擎能基于 Property 找到维度关联字段

---

### Phase 2: 指标系统扩展（核心能力）

- [ ] **Unit 3: 扩展指标类型定义**

**Goal:** 支持嵌套指标和衍生复合指标的数据结构

**Requirements:** R3, R4

**Dependencies:** Unit 2

**Files:**
- Modify: `src/types/index.ts`（扩展 Metric 类型）
- Modify: `supabase/functions/server/metrics.ts`（更新创建/更新逻辑）

**Approach:**
- 扩展 Metric 类型，新增字段：
  - `is_nested?: boolean` - 是否嵌套指标
  - `nested_aggregator?: string` - 二次聚合方式
  - `aggregate_on?: string` - 聚合维度/字段
  - `having_conditions?: HavingCondition[]` - HAVING 子句条件
  - `is_derived_from_composite?: boolean` - 是否基于复合指标的衍生

**Patterns to follow:**
- 参考 dp DirivedIndicator 模型中的嵌套逻辑
- 嵌套指标来源可以是原子或复合指标

**Test scenarios:**
- **Happy path**: 创建嵌套指标（如"订单数大于3的用户数"）
- **Happy path**: 创建基于复合指标的衍生（如"VIP平均客单价"）
- **Edge case**: 循环依赖检测（指标A引用指标B，B又引用A）

**Verification:**
- 新指标类型能正确保存和读取
- 嵌套指标的依赖关系正确建立

---

- [ ] **Unit 4: 指标依赖解析器**

**Goal:** 实现指标依赖树构建和循环依赖检测

**Requirements:** R3, R4

**Dependencies:** Unit 3

**Files:**
- Create: `supabase/functions/server/utils/indicator-tree.ts`
- Test: `supabase/functions/server/utils/indicator-tree.test.ts`

**Approach:**
- 实现 `buildIndicatorTree(indicatorIds)` 函数
- 递归加载所有依赖的源指标（复合指标→原子指标，衍生指标→源指标）
- 实现循环依赖检测（visited 集合追踪）

**Technical design:**
```typescript
interface IndicatorNode {
  id: string
  code: string
  name: string
  type: 'atomic'|'derived'|'composite'|'nested'|'derived_from_composite'
  // 类型特定字段...
  sources: IndicatorNode[]  // 依赖的源指标
}

function buildIndicatorTree(ids: string[]): IndicatorNode[]
function detectCircularDependency(node: IndicatorNode, visited: Set<string>): boolean
```

**Patterns to follow:**
- 参考 dp：`Indicator.get_dependent_indicators_by_ids()`
- 参考 dp：`RecursiveDependentError`

**Test scenarios:**
- **Happy path**: 构建复合指标的依赖树（3层嵌套）
- **Error path**: 检测到循环依赖时抛出错误
- **Edge case**: 同一指标被多个指标依赖（去重）

**Verification:**
- 能正确解析五层指标体系（如 dp 的 five-layer 测试数据）
- 循环依赖被正确检测和阻止

---

### Phase 3: 查询引擎（核心引擎）

- [ ] **Unit 5: SQL 生成引擎（核心）**

**Goal:** 实现基于 CTE 三层架构的 SQL 生成器

**Requirements:** R5

**Dependencies:** Unit 4

**Files:**
- Create: `supabase/functions/server/query-engine/index.ts`
- Create: `supabase/functions/server/query-engine/layer0-builder.ts`
- Create: `supabase/functions/server/query-engine/layer1-builder.ts`
- Create: `supabase/functions/server/query-engine/layer2-builder.ts`
- Create: `supabase/functions/server/query-engine/types.ts`
- Test: `supabase/functions/server/query-engine/index.test.ts`

**Approach:**
- 完整移植 dp v2_engine.py 到 TypeScript
- 三层架构：
  - Layer0: UNION ALL 子查询（原子/嵌套指标的底层聚合）
  - Layer1: CASE WHEN 行转列 + 公式计算
  - Layer2: JOIN 维度表 + WHERE 筛选

**Technical design:**
```typescript
class QueryEngine {
  indicators: IndicatorNode[]
  dimensions: Dimension[]
  dimensionProperties: Property[]
  filters: FilterCondition[]

  buildSQL(): string {
    const layer0 = this.buildLayer0()
    const layer1 = this.buildLayer1()
    const layer2 = this.buildLayer2()
    return `WITH ${layer0}, ${layer1}, ${layer2} SELECT * FROM layer2`
  }
}
```

**Patterns to follow:**
- 核心参考：`/Users/macpro/IdeaProjects/dp/dp/utils/query_engine/v2_engine.py`
- 保持 CASE WHEN 行转列逻辑一致
- 支持 nested_from_composite 的特殊处理

**Test scenarios:**
- **Happy path**: 原子指标 SQL 生成（单层）
- **Happy path**: 复合指标 SQL 生成（多层 CASE WHEN）
- **Happy path**: 嵌套指标 SQL 生成（内层聚合 + HAVING）
- **Edge case**: 空维度列表（GROUP BY 处理）
- **Edge case**: 除零保护（NULLIF 包装）

**Verification:**
- 生成的 SQL 与 dp 项目输出一致
- 支持所有六种指标类型

---

- [ ] **Unit 6: SQL 执行器**

**Goal:** 在 Edge Function 中执行生成的 SQL 查询

**Requirements:** R5, R6

**Dependencies:** Unit 5

**Files:**
- Create: `supabase/functions/server/query-engine/executor.ts`
- Test: `supabase/functions/server/query-engine/executor.test.ts`

**Approach:**
- 使用 Supabase 的 SQL API 执行查询
- 支持分页（page, page_size）
- 返回标准格式：{columns, rows, total, sql}

**Technical design:**
```typescript
interface QueryResult {
  columns: string[]
  rows: any[][]
  total: number
  sql: string
}

async function executeQuery(sql: string, page: number, pageSize: number): Promise<QueryResult>
```

**Test scenarios:**
- **Happy path**: 执行简单查询返回结果
- **Error path**: SQL 语法错误处理
- **Edge case**: 大结果集分页处理

**Verification:**
- 能正确执行复杂 CTE 查询
- 分页逻辑正确

---

### Phase 4: 分析 API（对外接口）

- [ ] **Unit 7: 多维分析查询 API**

**Goal:** 提供完整的分析查询接口

**Requirements:** R6, R7

**Dependencies:** Unit 6

**Files:**
- Create: `supabase/functions/server/analysis.ts`
- Modify: `supabase/functions/server/index.ts`（添加路由）
- Test: `supabase/functions/server/analysis.test.ts`

**Approach:**
- POST `/analysis/query` - 执行分析查询
- POST `/analysis/preview-sql` - 仅返回 SQL 不执行
- 支持参数：indicator_ids, dimension_ids, filters, order_by, page

**Patterns to follow:**
- 参考 dp：`/Users/macpro/IdeaProjects/dp/dp/api/views.py` 中的 `AnalysisViewSet`
- 参考 dp：`preview_sql` 函数

**Test scenarios:**
- **Happy path**: 查询原子指标 + 两个维度
- **Happy path**: 查询复合指标计算结果
- **Integration**: 筛选条件正确应用到查询
- **Integration**: 排序和分页正常工作

**Verification:**
- API 返回格式与 dp 项目一致
- SQL 预览和执行结果一致

---

- [ ] **Unit 8: 公共维度计算 API**

**Goal:** 支持计算多个指标的交集维度

**Requirements:** R8

**Dependencies:** Unit 4

**Files:**
- Modify: `supabase/functions/server/analysis.ts`（添加端点）

**Approach:**
- POST `/analysis/common-dimensions`
- 输入 indicator_ids，返回这些指标共同支持的维度列表

**Technical design:**
- 通过 Property 关联找到每个指标支持的维度
- 取交集返回

**Patterns to follow:**
- 参考 dp：`/Users/macpro/IdeaProjects/dp/dp/utils/dimension_calculator.py`

**Test scenarios:**
- **Happy path**: 两个原子指标有公共维度
- **Edge case**: 指标无公共维度（返回空）
- **Happy path**: 复合指标继承来源指标的维度交集

**Verification:**
- 公共维度计算结果正确

---

### Phase 5: 前端集成（用户界面）

- [ ] **Unit 9: 分类管理前端界面**

**Goal:** 实现分类的树形管理界面

**Requirements:** R1

**Dependencies:** Unit 1

**Files:**
- Create: `src/app/views/Categories.tsx`
- Modify: `src/app/routes.tsx`
- Modify: `src/app/components/Layout.tsx`（添加导航）

**Approach:**
- 树形分类展示（展开/折叠）
- 支持拖拽移动分类
- 分类与指标关联（在指标编辑中选择分类）

**Test scenarios:**
- **Happy path**: 创建三级分类结构
- **Happy path**: 移动分类到新父节点
- **Integration**: 创建指标时选择分类

**Verification:**
- 分类树操作流畅
- 指标能正确关联分类

---

- [ ] **Unit 10: 字段定义管理界面**

**Goal:** 实现事实表字段的定义和维度关联

**Requirements:** R2

**Dependencies:** Unit 2

**Files:**
- Modify: `src/app/views/FactTables.tsx`（添加字段管理）

**Approach:**
- 事实表详情页增加"字段管理"标签
- 显示字段列表，支持新增/编辑/删除
- 字段可关联到维度（下拉选择）

**Test scenarios:**
- **Happy path**: 为事实表添加字段并关联维度
- **Happy path**: 编辑字段的维度关联
- **Edge case**: 删除被指标引用的字段（阻止或警告）

**Verification:**
- 字段定义能正确保存
- 维度关联在查询引擎中生效

---

- [ ] **Unit 11: 嵌套指标创建界面**

**Goal:** 支持嵌套指标的表单创建

**Requirements:** R3

**Dependencies:** Unit 3, Unit 9

**Files:**
- Modify: `src/app/views/Metrics.tsx`（扩展表单）

**Approach:**
- 创建指标时选择"嵌套指标"类型
- 表单增加：二次聚合方式、聚合维度、HAVING 条件
- 可视化展示嵌套逻辑（内层聚合 → 筛选 → 外层聚合）

**Test scenarios:**
- **Happy path**: 创建"订单数大于3的用户数"指标
- **Happy path**: 创建基于复合指标的嵌套指标
- **Error path**: 缺少 HAVING 条件的验证

**Verification:**
- 嵌套指标能正确保存
- SQL 生成包含正确的子查询和 HAVING

---

- [ ] **Unit 12: 多维分析查询界面**

**Goal:** 实现分析查询的可视化界面

**Requirements:** R6, R7

**Dependencies:** Unit 7, Unit 8

**Files:**
- Modify: `src/app/views/ModelBuilder.tsx`（升级为分析界面）
- Create: `src/hooks/useAnalysis.ts`

**Approach:**
- 指标选择器（支持多选）
- 维度选择器（基于公共维度计算动态更新）
- 筛选条件构建器
- SQL 预览面板
- 结果表格展示

**Test scenarios:**
- **Happy path**: 选择指标 → 选择维度 → 执行查询 → 查看结果
- **Integration**: 添加筛选条件后结果正确过滤
- **Happy path**: 查看 SQL 预览与实际执行一致

**Verification:**
- 完整分析流程能正常运行
- 结果与 dp 项目查询结果一致

---

## System-Wide Impact

### 数据模型变更
- 新增 Category 和 Property 存储结构
- Metric 类型扩展（新增 nested, derived_from_composite）

### API 变更
- 新增 `/categories` 路由
- 新增 `/analysis/*` 路由组
- 现有 `/metrics` 扩展支持新字段

### 依赖关系
```
Unit 1 (Category)
  ↓
Unit 2 (Property)
  ↓
Unit 3 (Metric Types)
  ↓
Unit 4 (Indicator Tree)
  ↓
Unit 5 (SQL Builder) ← Unit 2 (需要 Property)
  ↓
Unit 6 (Executor)
  ↓
Unit 7 (Analysis API)
Unit 8 (Common Dimensions API)
  ↓
Unit 9-12 (Frontend UI)
```

### 不变更的接口
- 现有维度、事实表的基础 CRUD 行为保持不变
- 现有的简单指标（atomic/derived/composite）行为保持兼容

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| SQL 引擎复杂度高，移植可能遗漏边界情况 | 使用 dp 项目的测试用例作为基准，逐一验证 |
| KV Store 关系查询性能限制 | 设计合理的索引键，避免全量扫描 |
| 嵌套指标逻辑复杂，难以理解 | 提供清晰的 UI 引导和示例 |
| 指标依赖循环风险 | 在保存时强制进行循环检测 |

## Documentation / Operational Notes

- 新增 API 需要在 CLAUDE.md 中更新接口文档
- 复杂的嵌套指标概念需要用户指南
- 考虑添加示例数据初始化脚本（类似 dp 的 init_demo_data）

## Sources & References

- **参考项目**: `/Users/macpro/IdeaProjects/dp`
- **核心参考文件**:
  - `dp/dp/model_reg/indicator.py` - 指标模型
  - `dp/dp/model_reg/category.py` - 分类模型
  - `dp/dp/model_reg/property.py` - 字段定义
  - `dp/dp/utils/query_engine/v2_engine.py` - 查询引擎
  - `dp/dp/api/views.py` - API 实现
- **现有计划**: `docs/plans/2026-05-19-001-feat-data-layer-and-crud-implementation-plan.md`
