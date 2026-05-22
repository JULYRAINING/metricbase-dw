---
title: refactor: 统一维度和事实表为物理表模型
type: refactor
status: active
date: 2026-05-21
origin: 用户需求 - 将维度和事实表统一为同一概念
deepened: 2026-05-21
---

# refactor: 统一维度和事实表为物理表模型

## Overview

将当前分离的 `Dimension`（维度）和 `FactTable`（事实表）实体统一为单一的 `PhysicalTable`（物理表）概念。两者本质上都对应数据仓库中的物理表，由一组字段组成。统一后：

- 所有物理表都由字段组成
- 字段可以绑定到其他物理表作为维度引用
- 支持雪花模型（维度表的字段也可以引用其他维度）

## Problem Frame

**当前问题**：
1. 维度和事实表是独立实体，但本质上都是物理表
2. 维度表无法定义字段，限制了雪花模型的支持
3. 字段存储分散：核心实体在 PostgreSQL，Property 在 KV Store
4. 维度引用不一致：`fact_tables.dims[]` 存名称，`properties.dimension_id` 存 ID

**目标**：
- 统一数据模型，简化架构
- 支持完整的雪花模型
- 建立一致的字段管理和引用机制

## Requirements Trace

- R1. 统一实体：将 Dimension 和 FactTable 合并为 PhysicalTable
- R2. 字段统一：所有表都有字段，字段可引用其他物理表
- R3. 雪花模型：维度表的字段可引用其他维度表
- R4. 向后兼容：保持现有查询引擎功能
- R5. 数据迁移：无损迁移现有数据

## Scope Boundaries

- 本次重构**更改查询引擎的数据访问层**（从 KV Store 到 PostgreSQL），但保持 CTE 生成逻辑不变
- 不改变指标系统的依赖关系
- 不涉及前端整体布局重构

**重要澄清**: 范围边界原描述有误。查询引擎的 `loadDimensions()` 和 `loadDimensionProperties()` 将从 PostgreSQL 查询而非 KV Store，这是核心数据访问模式的改变。CTE 三层架构的 SQL 生成逻辑保持不变，但数据源变化意味着需要额外的性能测试。

### Deferred to Separate Tasks

- 查询性能优化：可在新模型稳定后单独进行
- 字段血缘追踪：未来版本考虑

## Context & Research

### 当前架构

```
PostgreSQL 表:
- dimensions (id, name, code, description)
- fact_tables (id, name, code, description, dims[], measures[])
- metrics (id, name, type, source, measure, agg, ...)

KV Store:
- property:{id} → {id, name, type, component_id, dimension_id, ...}
```

### 关键依赖

- 查询引擎 `layer0-builder.ts` 使用 `node.source`（事实表 code）和 `findDimensionField()`
- 原子指标通过 `source` 字段（表 code 字符串）引用事实表
- 事实表的 `dims[]` 数组存储维度名称（需迁移）

### Institutional Learnings

- 来源: `docs/solutions/logic-errors/sql-preview-mock-api-2025-05-21.md`
- 查询引擎的 `findDimensionField()` 依赖 `component_name === source` 匹配，迁移时必须保持 code 一致

## Key Technical Decisions

### 决策 1: 新建 PostgreSQL `physical_tables` 和 `fields` 表

**理由**: 
- 提供完整的关系约束和引用完整性
- 替代 KV Store 存储字段，建立明确的引用关系
- 支持高效查询和 JOIN 操作
- **关键约束**: 迁移时必须保留原有 ID（使用显式 ID 插入而非 gen_random_uuid()），确保现有引用关系有效

**风险缓解**:
- 当前 KV Store 的 properties.component_id 存储的是 fact_tables/dimensions 的 UUID
- 迁移后这些 UUID 必须继续存在于 physical_tables.id 中
- 使用 `INSERT INTO physical_tables (id, ...) SELECT id, ... FROM dimensions` 保留原 ID

### 决策 2: 字段引用物理表而非抽象维度

**理由**:
- 支持雪花模型的层叠关联
- 统一引用机制，简化逻辑
- 物理表之间的引用更符合实际数据流

### 决策 3: 保留 `table_type` 字段区分表类型

**理由**:
- 便于 UI 展示和筛选
- 查询引擎可根据类型优化（如维度表不需要度量字段）
- 保持概念清晰度

## Alternative Approaches Considered

### 方案 A: 仅 UI 改进（不迁移数据库）

**方案描述**: 保持现有数据库结构，仅在 `Dimensions.tsx` 添加字段管理功能。

**优点**:
- 零迁移风险
- 开发周期短（约 1 天）
- 无需修改查询引擎

**缺点**:
- `properties.component_id` 和 `fact_tables.dims[]` 引用机制不一致
- 无法建立外键约束，数据一致性依赖应用层
- 不解决当前架构的根本问题

**拒绝理由**: 虽然短期内可行，但无法解决引用不一致和缺乏关系约束的根本问题，技术债务会持续积累。

---

### 方案 B: 纯 KV Store 统一（不迁移到 PostgreSQL）

**方案描述**: 将 dimensions 数据迁移到 KV Store（与当前 properties 一致），统一存储策略。

**优点**:
- 保持与现有查询引擎的兼容性
- 无需修改查询引擎的数据加载逻辑

**缺点**:
- KV Store 无法建立外键约束
- 大数据集查询性能不如 PostgreSQL
- 与项目长期方向（PostgreSQL 优先）不一致

**拒绝理由**: 技术方向与项目演进相反，且无法获得 PostgreSQL 的关系约束优势。

## Open Questions

### Resolved During Planning

- Q: 字段是否需要区分角色（维度键/度量/属性）？
- A: 是，添加 `field_role` 字段：`dimension_key | measure | attribute`

### Deferred to Implementation

- 现有数据的完整迁移脚本细节
- 查询引擎性能影响的实测结果

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

### 新数据模型

```
physical_tables                fields
┌──────────────────┐          ┌─────────────────────────┐
│ id (PK)          │◄────────│ id (PK)                 │
│ name             │          │ name                    │
│ code (unique)    │          │ type                    │
│ table_type       │          │ field_role              │
│ description      │          │ table_id (FK)           │
│ created_at       │          │ dimension_ref_id (FK)   │──► physical_tables.id
│ updated_at       │          │ description             │
└──────────────────┘          │ is_join_key             │
                              │ join_key_target         │
                              │ created_at              │
                              │ updated_at              │
                              └─────────────────────────┘

table_type: 'dimension' | 'fact'  # 去除 'hybrid'（当前无需求）
field_role: 'dimension_key' | 'measure' | 'attribute'

**注意**: 'hybrid' 表类型已从设计中移除。如未来需要，可追加枚举值，但目前遵循 YAGNI 原则，不引入无人使用的复杂性。
```

### 迁移关系

```
原 dimensions 表 → physical_tables (table_type='dimension')
原 fact_tables 表 → physical_tables (table_type='fact')
原 fact_tables.dims[] → fields (field_role='dimension_key')
原 fact_tables.measures[] → fields (field_role='measure')
原 properties (KV) → fields (field_role='attribute')
```

## Implementation Units

### Phase 1: 数据库层

- [x] **Unit 1: 创建新的数据库表结构**

**Goal:** 创建 `physical_tables` 和 `fields` PostgreSQL 表，建立完整的关系约束

**Requirements:** R1, R5

**Dependencies:** None

**Files:**
- Create: `supabase/migrations/002_physical_tables_unification.sql`

**Approach:**
- 创建 `physical_tables` 表，包含 `id, name, code, table_type, description, created_at, updated_at`
- 创建 `fields` 表，包含 `id, name, type, field_role, table_id, dimension_ref_id, description, is_join_key, join_key_target, created_at, updated_at`
- 添加外键约束：`fields.table_id → physical_tables.id`, `fields.dimension_ref_id → physical_tables.id`
- 添加唯一约束：`physical_tables.code`, `fields(table_id, name)`
- 添加索引策略：
  ```sql
  CREATE INDEX idx_fields_table_id_role ON fields(table_id, field_role);
  CREATE INDEX idx_fields_dimension_ref ON fields(dimension_ref_id) WHERE field_role='dimension_key';
  CREATE INDEX idx_physical_tables_type ON physical_tables(table_type);
  ```

**Test scenarios:**
- **Happy path**: 创建表成功，约束生效
- **Edge case**: 级联删除测试（删除物理表时字段一并删除）
- **Error path**: 重复 code 插入应失败

**Verification:**
- 表结构符合设计
- 外键约束正确工作

---

- [x] **Unit 2: 数据迁移脚本**

**Goal:** 将现有 `dimensions`、`fact_tables` 和 `properties` 数据迁移到新表

**Requirements:** R5

**Dependencies:** Unit 1

**Files:**
- Modify: `supabase/migrations/002_physical_tables_unification.sql`（追加迁移逻辑）

**Approach:**
1. 迁移 `dimensions` 数据到 `physical_tables`，**保留原 ID**，设置 `table_type='dimension'`
2. 迁移 `fact_tables` 数据到 `physical_tables`，**保留原 ID**，设置 `table_type='fact'`
3. 将 `fact_tables.dims[]` 数组展开为 `fields` 记录，`field_role='dimension_key'`（需先转换维度代码到 ID）
4. 将 `fact_tables.measures[]` 数组展开为 `fields` 记录，`field_role='measure'`
5. 迁移 KV Store 的 `properties` 到 `fields`，`field_role='attribute'`
6. 更新字段引用：将 `properties.dimension_id` 映射到 `fields.dimension_ref_id`

**关键迁移逻辑:**
```sql
-- 保留原 ID（关键！）
INSERT INTO physical_tables (id, name, code, table_type, description, created_at, updated_at)
SELECT id, name, code, 'dimension', description, created_at, updated_at
FROM dimensions;

INSERT INTO physical_tables (id, name, code, table_type, description, created_at, updated_at)
SELECT id, name, code, 'fact', description, created_at, updated_at
FROM fact_tables;

-- dims[] 转换：代码 → ID
INSERT INTO fields (id, name, type, field_role, table_id, dimension_ref_id, ...)
SELECT gen_random_uuid(), dim_code, 'string', 'dimension_key', ft.id, d.id, ...
FROM fact_tables ft, unnest(ft.dims) AS dim_code
JOIN dimensions d ON d.code = dim_code;
```

**Technical design:**
```sql
-- 示例迁移逻辑
INSERT INTO physical_tables (id, name, code, table_type, description, created_at, updated_at)
SELECT id, name, code, 'dimension', description, created_at, updated_at
FROM dimensions;

INSERT INTO fields (id, name, type, field_role, table_id, dimension_ref_id, ...)
SELECT ...
FROM properties_kv p
JOIN physical_tables pt ON p.component_id = pt.id;
```

**Test scenarios:**
- **Happy path**: 所有数据完整迁移，数量一致
- **Edge case**: 空数组 `dims[]` 和 `measures[]` 的处理
- **Integration**: 迁移后查询引擎能正确使用新表

**Verification:**
- 数据完整性检查脚本通过
- 原始数据可回滚

---

### Phase 2: API 层

- [x] **Unit 2.5: 迁移验证与回滚准备**

**Goal:** 创建完整的迁移验证脚本和一键回滚机制

**Requirements:** R5

**Dependencies:** Unit 2

**Files:**
- Create: `supabase/migrations/002_migration_validation.sql`

**Approach:**
- 数据完整性校验：
  - 记录数对比：每个源表与目标表行数一致
  - 关系校验：fields.dimension_ref_id 有效引用 physical_tables.id
  - 语义等价：抽样对比前 10 行数据
- 回滚准备：
  - 导出原始数据为 JSON 备份
  - 创建回滚 SQL 脚本（DROP 新表、恢复旧数据）
  - 回滚执行时间 < 5 分钟

**Test scenarios:**
- **Happy path**: 验证脚本全部通过
- **Error path**: 发现数据不一致时阻止继续迁移

**Verification:**
- 验证脚本可执行
- 回滚脚本实测可行（在测试环境）

---

- [x] **Unit 3: PhysicalTable API 端点**

**Goal:** 创建统一的 `/physical-tables` API 端点，支持 CRUD 操作

**Requirements:** R1

**Dependencies:** Unit 2

**Files:**
- Create: `supabase/functions/server/physical-tables.ts`
- Modify: `supabase/functions/server/index.ts`（添加路由）

**Approach:**
- GET `/physical-tables` - 列表查询，支持 `table_type` 筛选和搜索
- POST `/physical-tables` - 创建物理表
- GET `/physical-tables/:id` - 获取详情（含字段列表）
- PUT `/physical-tables/:id` - 更新物理表基本信息
- DELETE `/physical-tables/:id` - 删除（需检查引用）
- 使用 Supabase 客户端直接操作 PostgreSQL 表

**Patterns to follow:**
- 参考 `supabase/functions/server/dimensions.ts` 的 CRUD 结构
- 遵循现有 API 的错误处理模式

**Test scenarios:**
- **Happy path**: 完整 CRUD 流程
- **Error path**: 删除被指标引用的表（返回 409）
- **Edge case**: 搜索和筛选参数组合

**Verification:**
- API 端点通过 Postman/curl 测试
- 返回格式与现有 API 一致

---

- [x] **Unit 4: Field API 端点**

**Goal:** 创建 `/fields` API 端点，支持字段管理

**Requirements:** R2, R3

**Dependencies:** Unit 3

**Files:**
- Create: `supabase/functions/server/fields.ts`
- Modify: `supabase/functions/server/index.ts`（添加路由）

**Approach:**
- GET `/fields?table_id=xxx` - 获取指定表的字段列表
- POST `/fields` - 创建字段（含维度引用）
- PUT `/fields/:id` - 更新字段
- DELETE `/fields/:id` - 删除字段
- 支持批量操作（创建多个字段）

**Patterns to follow:**
- 参考 `supabase/functions/server/properties.ts` 的字段管理模式
- 复用现有的类型校验逻辑

**Test scenarios:**
- **Happy path**: 创建字段并引用其他物理表作为维度
- **Edge case**: 同名字段冲突检测
- **Integration**: 雪花模型场景 - 维度表字段引用另一个维度表

**Verification:**
- 字段 API 支持完整的引用关系
- 批量操作事务正确

---

- [x] **Unit 5: 向后兼容 API 别名**

**Goal:** 保持 `/dimensions` 和 `/fact-tables` 端点的向后兼容性

**Requirements:** R4

**Dependencies:** Unit 3, Unit 4

**Files:**
- Modify: `supabase/functions/server/dimensions.ts`
- Modify: `supabase/functions/server/fact-tables.ts`

**Approach:**
- `/dimensions` 端点重定向到 `/physical-tables?table_type=dimension`
- `/fact-tables` 端点重定向到 `/physical-tables?table_type=fact`
- 保持响应格式兼容现有前端调用
- 添加废弃警告 header

**Test scenarios:**
- **Happy path**: 旧端点返回正确数据
- **Integration**: 现有前端无需修改即可工作

**Verification:**
- 现有前端功能不受影响

---

### Phase 3: 查询引擎适配

- [x] **Unit 6: 更新查询引擎的数据加载逻辑**

**Goal:** 修改查询引擎从新表结构加载数据

**Requirements:** R4

**Dependencies:** Unit 2

**Files:**
- Modify: `supabase/functions/server/query-engine/index.ts`
- Modify: `supabase/functions/server/query-engine/layer0-builder.ts`
- Modify: `supabase/functions/server/utils/indicator-tree.ts`

**Approach:**
- 更新 `KEYS` 常量，使用新的表名
- `loadDimensions()` 改为从 `physical_tables` 和 `fields` 查询
- `loadDimensionProperties()` 改为从 `fields` 表查询，`field_role='dimension_key'`
- `findDimensionField()` 更新匹配逻辑，使用 `dimension_ref_id` 关联

**Technical design:**
```typescript
// 新的维度字段查找逻辑
function findDimensionField(tableCode: string, dimCode: string, fields: Field[]): Field | undefined {
  return fields.find(f => 
    f.table_code === tableCode && 
    f.field_role === 'dimension_key' &&
    f.dimension_ref_code === dimCode
  );
}
```

**Patterns to follow:**
- 保持现有的 CTE 三层架构
- 最小化修改，仅替换数据源

**Test scenarios:**
- **Happy path**: 原子指标 SQL 生成正确
- **Happy path**: 复合指标 SQL 生成正确
- **Integration**: 多维度分析查询执行成功

**Verification:**
- 生成的 SQL 与迁移前一致
- 分析 API 返回正确结果

---

### Phase 4: 前端适配

- [x] **Unit 7: 更新类型定义**

**Goal:** 更新前端 TypeScript 类型定义以匹配新模型

**Requirements:** R1

**Dependencies:** Unit 1

**Files:**
- Modify: `src/types/index.ts`

**Approach:**
- 添加 `PhysicalTable` 和 `Field` 类型定义
- 添加 `TableType` 和 `FieldRole` 枚举
- 保留 `Dimension` 和 `FactTable` 类型别名（向后兼容）
- 更新 API 请求/响应类型

**Test scenarios:**
- **Happy path**: TypeScript 编译无错误

**Verification:**
- 类型定义完整且一致

---

- [x] **Unit 8: 创建统一的物理表管理视图**

**Goal:** 创建新的 `PhysicalTables.tsx` 视图，支持所有表类型管理

**Requirements:** R1, R2, R3

**Dependencies:** Unit 3, Unit 4, Unit 7

**Files:**
- Create: `src/app/views/PhysicalTables.tsx`
- Modify: `src/app/routes.tsx`（添加路由）
- Modify: `src/app/components/Layout.tsx`（添加导航）
- Create: `src/hooks/usePhysicalTables.ts`
- Create: `src/hooks/useFields.ts`

**Approach:**
- 统一的表列表视图，支持按类型筛选
- 表详情页包含字段管理面板
- 支持创建不同类型的物理表
- 字段可引用其他物理表作为维度（下拉选择）

**Patterns to follow:**
- 参考 `FactTables.tsx` 的字段管理模式
- 使用现有的 shadcn/ui 组件

**Test scenarios:**
- **Happy path**: 创建维度表并添加字段
- **Happy path**: 创建事实表，字段引用维度表
- **Happy path**: 雪花模型 - 维度表字段引用另一个维度表
- **Edge case**: 删除被引用的物理表（阻止并提示）

**Verification:**
- UI 流畅，操作直观
- 字段引用关系正确显示

---

- [x] **Unit 9: 更新现有视图使用新 API**

**Goal:** 修改 Dimensions.tsx 和 FactTables.tsx 使用向后兼容 API

**Requirements:** R4

**Dependencies:** Unit 5, Unit 8

**Files:**
- Modify: `src/app/views/Dimensions.tsx`
- Modify: `src/app/views/FactTables.tsx`
- Modify: `src/hooks/useDimensions.ts`
- Modify: `src/hooks/useFactTables.ts`

**Approach:**
- 保持现有视图基本不变
- 添加废弃提示，引导用户使用新视图
- 确保与向后兼容 API 正常工作

**Test scenarios:**
- **Happy path**: 旧视图继续正常工作

**Verification:**
- 无功能回退

---

### Phase 5: 收尾

- [x] **Unit 10: 清理旧表和 KV Store 数据**

**Goal:** 在确认新系统稳定后，清理旧数据（谨慎操作）

**Requirements:** R5

**Dependencies:** Unit 6, Unit 8, Unit 9（全部稳定运行后）

**Files:**
- Create: `supabase/migrations/003_cleanup_old_tables.sql`

**Approach:**
- 创建清理迁移脚本但不立即执行
- 提供回滚方案
- **稳定性标准**（必须全部满足才能执行清理）：
  - physical-tables 和 fields API 连续 7 天零 5xx 错误
  - 查询延迟 < 迁移前基准的 110%
  - 零用户报告的数据差异
- 建议在生产环境观察 1-2 周后再执行

**Verification:**
- 稳定性指标已定义且可监控
- 清理脚本准备就绪，可随时执行

---

## System-Wide Impact

### 数据模型变更
- `dimensions` 和 `fact_tables` 表合并为 `physical_tables`
- 新增 `fields` 表替代 KV Store 的 `properties`
- `metrics.source` 继续引用物理表 code（字符串），无需变更

### API 变更
- 新增 `/physical-tables` 和 `/fields` 端点
- `/dimensions` 和 `/fact-tables` 保持兼容，标记废弃

### 不变更的接口
- 指标 API (`/metrics`) 保持不变
- 分析 API (`/analysis/query`) 保持不变
- 查询引擎输出格式保持不变

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| 数据迁移丢失或错误 | 编写详细的迁移验证脚本，提供完整回滚方案（Unit 2.5） |
| 查询引擎性能下降 | 迁移前后进行性能基准测试对比，添加必要索引 |
| 现有功能回退 | 全面回归测试，分阶段发布 |
| 维度引用关系复杂化（雪花模型） | UI 中可视化引用关系，帮助用户理解 |
| **metrics.source 引用失效** | 迁移前验证所有指标 source 有对应物理表；添加迁移后校验脚本 |
| **旧 ID 映射失败** | 使用显式 ID 保留策略（不使用 gen_random_uuid()），确保 component_id 有效 |

## Documentation / Operational Notes

- 更新 `CLAUDE.md` 添加新的数据模型说明
- 创建迁移指南文档，说明从旧模型到新模型的映射
- 添加废弃 API 的时间表说明

## Sources & References

- 现有计划: `docs/plans/2026-05-20-001-feat-align-with-dp-project-plan.md`
- 数据库迁移: `supabase/migrations/001_initial_schema.sql`
- 查询引擎: `supabase/functions/server/query-engine/`
