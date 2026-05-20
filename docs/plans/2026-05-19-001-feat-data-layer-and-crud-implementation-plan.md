---
title: 指标管理平台数据层与核心功能实现计划
type: feat
status: active
date: 2026-05-19
---

# 指标管理平台数据层与核心功能实现计划

## Overview

将指标管理平台从UI原型阶段推进到功能完整阶段，实现数据持久化、完整的CRUD操作、搜索过滤和模型物化功能。

## Problem Frame

当前项目已完成UI原型开发，所有数据均为硬编码的mock数据，用户操作无法持久化。需要：
1. 设计并实现数据库层存储维度、事实表、指标定义
2. 构建后端API支持CRUD操作
3. 前端接入真实数据并补全缺失的交互功能
4. 实现模型物化的DDL生成逻辑

## Requirements Trace

- R1. 维度管理支持完整的CRUD（创建、读取、更新、删除）
- R2. 事实表管理支持完整的CRUD及维度/度量关联
- R3. 指标管理支持原子/衍生/复合三类指标的CRUD
- R4. 所有列表支持按名称/编码搜索过滤
- R5. 表单提交需验证并持久化到数据库
- R6. 模型构建器支持生成DDL语句
- R7. 数据操作需处理错误和加载状态

## Scope Boundaries

- **In Scope**: 数据层设计、API实现、前端CRUD、搜索、表单验证、DDL生成
- **Out of Scope**: 用户认证、权限管理、数据仓库物理表创建、实时协作

### Deferred to Separate Tasks

- 系统设置页面: 未来迭代
- 高级搜索（多条件组合）: 未来迭代
- 指标版本历史: 未来迭代

## Context & Research

### Relevant Code and Patterns

- **现有UI组件**: `src/app/components/ui/` - 40+ shadcn/ui组件可直接使用
- **视图组件**: `src/app/views/Dimensions.tsx`, `FactTables.tsx`, `Metrics.tsx`, `ModelBuilder.tsx`
- **Modal组件**: `src/app/components/Modal.tsx` - 已封装可复用弹窗
- **后端框架**: `supabase/functions/server/` - Hono框架，已有KV存储示例
- **样式系统**: Tailwind CSS v4 + CSS变量主题

### Technology Stack

- **Frontend**: React 18 + TypeScript + React Router v7
- **Backend**: Supabase Edge Functions (Deno + Hono)
- **Database**: Supabase PostgreSQL
- **HTTP Client**: 原生fetch或轻量级封装

## Key Technical Decisions

- **数据库设计**: 采用三表结构（dimensions, fact_tables, metrics），JSONB存储可变维度/度量数组
- **API风格**: RESTful API，统一返回格式 `{ data, error }`
- **前端状态**: 使用React hooks（useState + useEffect），暂不使用全局状态管理库
- **错误处理**: 后端返回标准HTTP状态码，前端统一错误提示使用sonner toast
- **DDL生成**: 前端模板字符串生成，后端仅做格式验证

## Open Questions

### Resolved During Planning

- **Q**: 是否使用ORM？  
  **A**: 不使用，直接用Supabase原生客户端，减少依赖

- **Q**: 表单验证方案？  
  **A**: 使用原生HTML5验证 + 简单自定义验证，不引入zod等库保持轻量

### Deferred to Implementation

- **Q**: 搜索是前端过滤还是后端查询？  
  **A**: 待实现时根据数据量决定，当前设计保留后端搜索接口

- **Q**: 关联删除约束（如维度被事实表引用时）？  
  **A**: 待实现时根据业务规则确定，当前先实现级联检查提示

## Output Structure

```
src/
├── lib/
│   ├── supabase.ts           # Supabase客户端配置
│   └── api.ts                # API调用封装
├── hooks/
│   ├── useDimensions.ts      # 维度数据hook
│   ├── useFactTables.ts      # 事实表数据hook
│   └── useMetrics.ts         # 指标数据hook
├── types/
│   └── index.ts              # TypeScript类型定义
└── app/views/
    ├── Dimensions.tsx        # 增强版（已修改）
    ├── FactTables.tsx        # 增强版（已修改）
    ├── Metrics.tsx           # 增强版（已修改）
    └── ModelBuilder.tsx      # 增强版（已修改）

supabase/functions/
├── server/
│   ├── index.ts              # 路由总入口（已修改）
│   ├── dimensions.ts         # 维度API处理器
│   ├── fact-tables.ts        # 事实表API处理器
│   └── metrics.ts            # 指标API处理器
└── migrations/
    └── 001_initial_schema.sql # 数据库初始化
```

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

### 数据流架构

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Dimensions  │  │ FactTables  │  │      Metrics        │  │
│  │   View      │  │    View     │  │       View          │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
│         │                │                     │             │
│  ┌──────▼────────────────▼─────────────────────▼──────────┐  │
│  │              Custom Hooks (useDimensions, etc)         │  │
│  └──────┬────────────────┬─────────────────────┬──────────┘  │
│         │                │                     │             │
│  ┌──────▼────────────────▼─────────────────────▼──────────┐  │
│  │                   API Client Layer                     │  │
│  └───────────────────────┬───────────────────────────────┘  │
└──────────────────────────┼──────────────────────────────────┘
                           │ HTTP/REST
┌──────────────────────────┼──────────────────────────────────┐
│                          ▼                                   │
│  Supabase Edge Functions (Hono)                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ /dimensions │  │/fact-tables │  │      /metrics       │  │
│  │   Handler   │  │   Handler   │  │       Handler       │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
│         │                │                     │             │
│  └──────┴────────────────┴─────────────────────┴──────────┘  │
│                          │                                   │
│                          ▼ PostgreSQL                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ dimensions  │  │ fact_tables │  │      metrics        │  │
│  │    table    │  │    table    │  │       table         │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 数据库Schema设计

```sql
-- 维度表
CREATE TABLE dimensions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 事实表
CREATE TABLE fact_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  dims TEXT[] DEFAULT '{}',
  measures TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 指标表（支持原子/衍生/复合）
CREATE TABLE metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('atomic', 'derived', 'composite')),
  source TEXT, -- 来源事实表（原子）或来源指标（衍生/复合）
  measure TEXT, -- 度量字段（原子）
  agg TEXT, -- 聚合方式（原子）
  condition TEXT, -- 业务条件（衍生）
  formula TEXT, -- 计算公式（复合）
  base_metrics TEXT[], -- 依赖指标（复合）
  dims TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

## Implementation Units

### Phase 1: 数据层与API基础

- [ ] **Unit 1: 数据库Schema与迁移**

**Goal:** 创建Supabase数据库表结构

**Requirements:** R1, R2, R3

**Dependencies:** None

**Files:**
- Create: `supabase/migrations/001_initial_schema.sql`

**Approach:**
- 创建dimensions, fact_tables, metrics三张表
- 设置适当的数据类型和约束
- 添加created_at/updated_at自动更新触发器

**Test scenarios:**
- Happy path: 执行迁移脚本成功创建所有表
- Edge case: 验证code字段唯一性约束生效
- Error path: 验证type字段CHECK约束拒绝无效值

**Verification:**
- Supabase Dashboard中可见三张表
- 可手动插入测试数据验证约束

---

- [ ] **Unit 2: Supabase客户端配置与类型定义**

**Goal:** 建立前端数据库连接和类型系统

**Requirements:** R1, R2, R3

**Dependencies:** Unit 1

**Files:**
- Create: `src/lib/supabase.ts`
- Create: `src/types/index.ts`

**Approach:**
- 配置Supabase客户端（使用环境变量）
- 定义Dimension, FactTable, Metric的TypeScript接口
- 定义API响应类型

**Patterns to follow:**
- 参考现有kv_store.tsx中的Supabase客户端创建方式

**Test scenarios:**
- Happy path: 客户端初始化成功，能查询数据
- Error path: 环境变量缺失时给出明确错误

**Verification:**
- TypeScript编译无类型错误
- 浏览器控制台无连接错误

---

- [ ] **Unit 3: 维度API端点**

**Goal:** 实现维度CRUD的REST API

**Requirements:** R1

**Dependencies:** Unit 1

**Files:**
- Create: `supabase/functions/server/dimensions.ts`
- Modify: `supabase/functions/server/index.ts` (添加路由)

**Approach:**
- GET /dimensions - 列表（支持?name=搜索）
- POST /dimensions - 创建
- PUT /dimensions/:id - 更新
- DELETE /dimensions/:id - 删除

**Technical design:**
```typescript
// 路由注册示例方向
app.get('/dimensions', async (c) => { ... })
app.post('/dimensions', async (c) => { ... })
```

**Test scenarios:**
- Happy path: 各端点正常CRUD操作
- Edge case: 删除被引用的维度时返回409冲突
- Error path: 重复code创建返回400错误
- Integration: 创建后立即可查询到

**Verification:**
- 使用curl或Postman测试各端点
- 验证响应格式统一

---

- [ ] **Unit 4: 事实表API端点**

**Goal:** 实现事实表CRUD的REST API

**Requirements:** R2

**Dependencies:** Unit 1, Unit 3

**Files:**
- Create: `supabase/functions/server/fact-tables.ts`
- Modify: `supabase/functions/server/index.ts`

**Approach:**
- 类似Unit 3的CRUD结构
- dims和measures使用TEXT[]数组存储

**Test scenarios:**
- Happy path: 完整CRUD，包含dims/measures数组
- Edge case: 空数组存储和读取正常
- Integration: 创建事实表后可在列表查询

**Verification:**
- API测试通过
- 数组字段存储格式正确

---

- [ ] **Unit 5: 指标API端点**

**Goal:** 实现指标CRUD的REST API（支持三类指标）

**Requirements:** R3

**Dependencies:** Unit 1, Unit 3, Unit 4

**Files:**
- Create: `supabase/functions/server/metrics.ts`
- Modify: `supabase/functions/server/index.ts`

**Approach:**
- 统一接口处理三种类型
- 根据type字段验证必填字段
  - atomic: source, measure, agg必填
  - derived: source, condition必填
  - composite: formula, base_metrics必填

**Test scenarios:**
- Happy path: 三类指标CRUD正常
- Error path: 类型必填字段缺失返回400
- Edge case: base_metrics数组正确处理

**Verification:**
- 三类指标创建和查询正常
- 类型验证生效

---

### Phase 2: 前端数据层与视图集成

- [ ] **Unit 6: 维度管理前端Hook**

**Goal:** 封装维度数据获取和操作的React Hook

**Requirements:** R1

**Dependencies:** Unit 2, Unit 3

**Files:**
- Create: `src/hooks/useDimensions.ts`
- Modify: `src/app/views/Dimensions.tsx`

**Approach:**
- useDimensions hook提供: dimensions, loading, error, refetch
- 提供CRUD方法: createDimension, updateDimension, deleteDimension
- 集成sonner toast提示操作结果

**Patterns to follow:**
- 参考现有Dimensions.tsx中的状态结构

**Test scenarios:**
- Happy path: 加载数据成功显示列表
- Error path: API错误时显示toast提示
- Integration: 删除后列表自动刷新

**Verification:**
- 页面加载显示真实数据（非mock）
- 网络面板可见API请求

---

- [ ] **Unit 7: 维度视图功能补全**

**Goal:** 实现维度的创建、编辑、删除、搜索

**Requirements:** R1, R4, R5

**Dependencies:** Unit 6

**Files:**
- Modify: `src/app/views/Dimensions.tsx`

**Approach:**
- 连接useDimensions hook替换mock数据
- 实现表单提交（区分新建和编辑）
- 实现删除确认对话框
- 搜索功能（前端过滤或调用API）
- 加载状态和空状态处理

**Test scenarios:**
- Happy path: 新建维度后出现在列表
- Happy path: 编辑维度后数据更新
- Happy path: 搜索过滤结果正确
- Error path: 表单验证失败提示
- Edge case: 删除确认后成功移除

**Verification:**
- 维度CRUD全流程可用
- 刷新页面数据持久化

---

- [ ] **Unit 8: 事实表管理前端Hook与视图**

**Goal:** 实现事实表的完整功能

**Requirements:** R2, R4, R5

**Dependencies:** Unit 4, Unit 7

**Files:**
- Create: `src/hooks/useFactTables.ts`
- Modify: `src/app/views/FactTables.tsx`

**Approach:**
- 类似Unit 6-7的模式
- 处理dims和measures数组的增删
- 维度下拉选择器（从dimensions表读取）

**Test scenarios:**
- Happy path: 创建事实表含多维度/度量
- Happy path: 编辑时维度列表正确显示
- Integration: 维度选择下拉有数据

**Verification:**
- 事实表CRUD全流程可用
- 维度/度量标签正确显示

---

- [ ] **Unit 9: 指标管理前端Hook与视图**

**Goal:** 实现三类指标的完整功能

**Requirements:** R3, R4, R5

**Dependencies:** Unit 5, Unit 8

**Files:**
- Create: `src/hooks/useMetrics.ts`
- Modify: `src/app/views/Metrics.tsx`

**Approach:**
- 根据activeTab切换API调用参数
- 表单根据类型动态渲染
- 原子指标选择事实表和度量
- 衍生指标选择原子指标
- 复合指标多选基础指标

**Test scenarios:**
- Happy path: 创建原子指标选择事实表度量
- Happy path: 创建衍生指标设置条件
- Happy path: 创建复合指标选择多个基础指标
- Edge case: 切换Tab时表单状态重置

**Verification:**
- 三类指标均可正常创建
- 指标列表按类型正确过滤

---

### Phase 3: 模型物化与优化

- [ ] **Unit 10: 模型构建器数据集成**

**Goal:** 模型构建器使用真实指标和维度数据

**Requirements:** R6

**Dependencies:** Unit 6, Unit 8, Unit 9

**Files:**
- Modify: `src/app/views/ModelBuilder.tsx`
- Create: `src/lib/ddl-generator.ts`

**Approach:**
- 替换AVAILABLE_METRICS为useMetrics获取的真实数据
- 替换DIMENSION_DICT为useDimensions获取的数据
- 保持现有的维度交集计算逻辑

**Test scenarios:**
- Happy path: 选择指标后维度交集正确计算
- Happy path: 显示真实指标列表
- Edge case: 无指标时的空状态

**Verification:**
- 模型构建器显示真实数据
- 交集计算逻辑仍正常工作

---

- [ ] **Unit 11: DDL生成器实现**

**Goal:** 根据选择的指标和维度生成建表SQL

**Requirements:** R6

**Dependencies:** Unit 10

**Files:**
- Create: `src/lib/ddl-generator.ts`
- Modify: `src/app/views/ModelBuilder.tsx`

**Approach:**
- generateDDL(selectedMetrics, selectedDims)函数
- 生成CREATE TABLE语句
- 维度字段作为普通列
- 指标字段根据类型生成相应SQL表达式

**Technical design:**
```typescript
// 生成逻辑方向示意
function generateDDL(metrics, dims) {
  const columns = dims.map(d => `${d.code} STRING`)
  const metricsCols = metrics.map(m => {
    if (m.type === 'atomic') return `${m.code} ${m.agg}(${m.measure})`
    // ... 其他类型处理
  })
  return `CREATE TABLE ads_model AS SELECT ${[...columns, ...metricsCols].join(',')} ...`
}
```

**Test scenarios:**
- Happy path: 生成包含维度和指标的完整DDL
- Edge case: 原子指标生成正确聚合表达式
- Edge case: 衍生指标包含WHERE条件
- Edge case: 复合指标生成分数表达式

**Verification:**
- 点击"执行物化配置"显示可执行的DDL
- DDL语法在目标数仓可运行

---

- [ ] **Unit 12: 全局优化与错误处理**

**Goal:** 统一错误处理、加载状态、空状态

**Requirements:** R7

**Dependencies:** Unit 7, Unit 8, Unit 9, Unit 11

**Files:**
- Modify: `src/app/views/Dimensions.tsx`
- Modify: `src/app/views/FactTables.tsx`
- Modify: `src/app/views/Metrics.tsx`
- Modify: `src/app/views/ModelBuilder.tsx`
- Create: `src/components/Loading.tsx` (如有需要)
- Create: `src/components/EmptyState.tsx` (如有需要)

**Approach:**
- 统一使用sonner显示操作成功/失败
- 添加全局加载指示器
- 优化空状态显示
- 处理网络错误和超时

**Test scenarios:**
- Error path: 网络断开时友好提示
- Edge case: 空列表时显示引导创建
- Integration: 操作成功后toast提示

**Verification:**
- 各视图错误处理一致
- 用户体验流畅

## System-Wide Impact

- **Interaction graph:** 
  - 新增API路由挂载到 `/dimensions`, `/fact-tables`, `/metrics`
  - 前端hooks集中管理数据获取和缓存
  
- **Error propagation:**
  - API层统一返回 `{ error: string }` 格式
  - Hook层统一抛出错误，视图层用try-catch + toast处理
  
- **State lifecycle risks:**
  - 删除维度前需检查是否被事实表引用（软删除或强制提示）
  - 指标计算依赖的基础指标被删除时的处理

- **API surface parity:**
  - 所有列表接口支持search参数，为后续高级搜索预留

- **Unchanged invariants:**
  - UI组件库（shadcn/ui）使用方式不变
  - 路由结构不变
  - 主题和样式系统不变

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Supabase服务稳定性 | 添加错误处理和重试机制 |
| 维度被引用时删除 | 实现级联检查，给出明确提示 |
| 大数据量性能 | 初始阶段数据量小，后续考虑分页 |
| 类型安全 | 严格TypeScript类型定义 |

## Documentation / Operational Notes

- 需在Supabase Dashboard中手动执行迁移脚本
- 环境变量需配置VITE_SUPABASE_URL和VITE_SUPABASE_ANON_KEY
- 测试数据可通过API直接插入

## Sources & References

- **Related code:** 
  - `src/app/views/*.tsx` - 现有视图组件
  - `supabase/functions/server/kv_store.tsx` - 后端模式参考
- **External docs:** 
  - Supabase JavaScript Client: https://supabase.com/docs/reference/javascript
  - Hono Framework: https://hono.dev/
