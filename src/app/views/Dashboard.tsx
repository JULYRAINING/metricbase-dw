import React from "react";
import { ArrowRight, Database, Box, Layers, PlayCircle } from "lucide-react";

export default function Dashboard() {
  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">基于指标的数仓平台系统概览</h1>
        <p className="text-slate-500 mt-1">从应用层出发，推演数据流转、指标定义、指标组合逻辑。</p>
      </div>

      <div className="grid grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col items-start gap-4">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">DWD层统一定义</h3>
            <p className="text-sm text-slate-500 mt-1">统一定义全局维度配置（无需定义度量）。</p>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col items-start gap-4">
          <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-lg flex items-center justify-center">
            <Box className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">统一指标管理</h3>
            <p className="text-sm text-slate-500 mt-1">基于度量定义原子指标，衍生和复合指标，并继承维度。</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col items-start gap-4">
          <div className="w-12 h-12 bg-orange-50 text-orange-600 rounded-lg flex items-center justify-center">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">指标维度组合</h3>
            <p className="text-sm text-slate-500 mt-1">选择分析指标，提取维度交集，生成逻辑表结构。</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col items-start gap-4">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center">
            <PlayCircle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">模型物化</h3>
            <p className="text-sm text-slate-500 mt-1">根据生成的逻辑模型，在DWD层物化物理表或应用层关联。</p>
          </div>
        </div>
      </div>

      <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm">
        <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
          <Layers className="w-5 h-5 text-blue-500" />
          核心数据流转架构
        </h2>
        
        <div className="relative p-6 overflow-hidden rounded-xl bg-slate-50 border border-slate-100 flex flex-col gap-12">
          {/* Flow Diagram representation */}
          
          <div className="flex justify-between items-center relative z-10">
            <div className="w-64 bg-white p-4 rounded-lg border border-slate-200 shadow-sm text-center">
              <div className="font-medium text-slate-800">1. DWD层配置</div>
              <div className="text-xs text-slate-500 mt-2 bg-slate-50 p-2 rounded">
                定义全域维度实体<br/>(商品, 用户, 门店等)
              </div>
            </div>
            
            <ArrowRight className="text-slate-300 w-8 h-8" />
            
            <div className="w-64 bg-white p-4 rounded-lg border-2 border-blue-100 shadow-sm text-center">
              <div className="font-medium text-blue-800">2. 指标定义 (继承维度)</div>
              <div className="flex flex-col gap-1 mt-2 text-xs">
                <div className="bg-blue-50 text-blue-700 py-1 px-2 rounded">原子指标 (基于事实表度量)</div>
                <div className="bg-indigo-50 text-indigo-700 py-1 px-2 rounded">衍生指标 (原子+业务限定)</div>
                <div className="bg-purple-50 text-purple-700 py-1 px-2 rounded">复合指标 (指标组合计算)</div>
              </div>
            </div>

            <ArrowRight className="text-slate-300 w-8 h-8" />

            <div className="w-64 bg-white p-4 rounded-lg border-2 border-orange-100 shadow-sm text-center">
              <div className="font-medium text-orange-800">3. 维度指标组合 (模型)</div>
              <div className="text-xs text-slate-600 mt-2 text-left space-y-1 bg-orange-50 p-2 rounded">
                <p>1. 选取待分析指标</p>
                <p>2. 系统自动计算共有维度</p>
                <p>3. 勾选所需维度</p>
                <p>4. 确认逻辑表结构</p>
              </div>
            </div>
          </div>
          
          {/* Materialization loop line */}
          <div className="absolute top-1/2 left-32 right-32 h-32 border-b-2 border-l-2 border-r-2 border-dashed border-emerald-300 rounded-b-xl -z-0 translate-y-8 flex items-end justify-center pb-2">
            <span className="bg-emerald-50 text-emerald-700 text-xs px-3 py-1 rounded-full font-medium border border-emerald-200">
              4. 物化执行 (生成物理表 / 关联应用层)
            </span>
          </div>

        </div>
      </div>
    </div>
  );
}
