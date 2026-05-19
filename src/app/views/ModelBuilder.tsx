import React, { useState, useMemo } from "react";
import { Layers, Database, Check, ChevronRight, Calculator, Table, Activity } from "lucide-react";

// Mock Data for the builder
const AVAILABLE_METRICS = [
  { id: "m1", name: "支付订单金额", type: "atomic", dims: ["dim_date", "dim_product", "dim_user", "dim_store"] },
  { id: "m2", name: "退款金额", type: "atomic", dims: ["dim_date", "dim_product", "dim_store"] },
  { id: "m3", name: "访问页面次数", type: "atomic", dims: ["dim_date", "dim_user", "dim_channel"] },
  { id: "m4", name: "客单价", type: "composite", dims: ["dim_date", "dim_user"] },
];

const DIMENSION_DICT: Record<string, { name: string; desc: string }> = {
  "dim_date": { name: "时间维度", desc: "分区与业务日期" },
  "dim_product": { name: "商品维度", desc: "SKU及商品类目属性" },
  "dim_user": { name: "用户维度", desc: "注册用户信息" },
  "dim_store": { name: "门店维度", desc: "线下门店信息" },
  "dim_channel": { name: "渠道维度", desc: "流量来源渠道" }
};

export default function ModelBuilder() {
  const [selectedMetricIds, setSelectedMetricIds] = useState<string[]>([]);
  const [selectedDimIds, setSelectedDimIds] = useState<string[]>([]);

  // Select/Deselect Metrics
  const toggleMetric = (id: string) => {
    setSelectedMetricIds(prev => 
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    );
    // Reset selected dims when metrics change because the intersection changes
    setSelectedDimIds([]);
  };

  // Select/Deselect Dimensions from intersection
  const toggleDim = (id: string) => {
    setSelectedDimIds(prev => 
      prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]
    );
  };

  // Core Logic: Calculate intersection of dimensions based on selected metrics
  const intersectedDims = useMemo(() => {
    if (selectedMetricIds.length === 0) return [];
    
    // Get all dimension arrays of selected metrics
    const selectedMetrics = AVAILABLE_METRICS.filter(m => selectedMetricIds.includes(m.id));
    const dimArrays = selectedMetrics.map(m => m.dims);
    
    // Intersect
    const intersection = dimArrays.reduce((acc, curr) => 
      acc.filter(dim => curr.includes(dim))
    );
    
    return intersection;
  }, [selectedMetricIds]);

  return (
    <div className="max-w-7xl mx-auto h-full flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">维度指标组合 (数据模型构建)</h1>
        <p className="text-slate-500 mt-1">选择所需的分析指标，系统将自动推断共享的维度交集，生成最终逻辑宽表。</p>
      </div>

      <div className="flex gap-6 flex-1 min-h-0">
        
        {/* Step 1: Select Metrics */}
        <div className="w-1/3 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200">
            <h2 className="font-semibold text-slate-800 flex items-center">
              <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm mr-2">1</span>
              选择待分析指标
            </h2>
            <p className="text-xs text-slate-500 mt-1 pl-8">勾选需要放入同一个数据模型的指标</p>
          </div>
          <div className="flex-1 overflow-auto p-2">
            {AVAILABLE_METRICS.map(metric => {
              const isSelected = selectedMetricIds.includes(metric.id);
              return (
                <div 
                  key={metric.id}
                  onClick={() => toggleMetric(metric.id)}
                  className={`p-3 m-2 rounded-lg border cursor-pointer transition-all flex items-center ${
                    isSelected ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'
                  }`}
                >
                  <div className={`w-5 h-5 rounded border mr-3 flex items-center justify-center ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-slate-300 bg-white'}`}>
                    {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-sm text-slate-800">{metric.name}</div>
                    <div className="flex gap-1 mt-1.5 flex-wrap">
                      {metric.dims.map(dim => (
                        <span key={dim} className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded border border-slate-200">
                          {DIMENSION_DICT[dim]?.name || dim}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-center text-slate-300">
          <ChevronRight className="w-8 h-8" />
        </div>

        {/* Step 2: Select Intersected Dimensions */}
        <div className="w-1/3 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200">
            <h2 className="font-semibold text-slate-800 flex items-center">
              <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm mr-2">2</span>
              选择所需维度
            </h2>
            <p className="text-xs text-slate-500 mt-1 pl-8">系统已提取指标的共享维度，请勾选需要的维度</p>
          </div>
          <div className="flex-1 overflow-auto p-4 bg-slate-50/50">
            {selectedMetricIds.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-slate-400 text-center p-6">
                请先在左侧选择至少一个指标
              </div>
            ) : intersectedDims.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-red-400 text-center p-6 bg-red-50 rounded-lg border border-red-100">
                所选指标没有共有的维度交集，无法生成宽表，请重新选择。
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-xs font-semibold text-indigo-600 mb-2 uppercase tracking-wide">
                  可用的共有维度 ({intersectedDims.length})
                </div>
                {intersectedDims.map(dimId => {
                  const isSelected = selectedDimIds.includes(dimId);
                  const dimInfo = DIMENSION_DICT[dimId];
                  return (
                    <div 
                      key={dimId}
                      onClick={() => toggleDim(dimId)}
                      className={`p-3 rounded-lg border cursor-pointer transition-all flex items-center bg-white ${
                        isSelected ? 'border-indigo-500 shadow-[0_0_0_1px_rgba(99,102,241,1)]' : 'border-slate-200 hover:border-indigo-300'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded border mr-3 flex items-center justify-center transition-colors ${isSelected ? 'bg-indigo-500 border-indigo-500' : 'border-slate-300'}`}>
                        {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                      </div>
                      <div>
                        <div className="font-medium text-sm text-slate-800">{dimInfo?.name}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{dimInfo?.desc} ({dimId})</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-center text-slate-300">
          <ChevronRight className="w-8 h-8" />
        </div>

        {/* Step 3: Resulting Logical Model */}
        <div className="w-1/3 bg-slate-900 border border-slate-800 rounded-xl shadow-xl flex flex-col overflow-hidden text-slate-200 relative">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Database className="w-32 h-32" />
          </div>
          
          <div className="p-4 border-b border-slate-800 relative z-10">
            <h2 className="font-semibold text-white flex items-center">
              <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-sm mr-2 border border-emerald-500/30">3</span>
              生成逻辑表结构
            </h2>
            <p className="text-xs text-slate-400 mt-1 pl-8">最终生成的 DWS / ADS 层表结构预览</p>
          </div>
          
          <div className="flex-1 overflow-auto p-4 relative z-10">
            {selectedDimIds.length === 0 && selectedMetricIds.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-slate-600">
                等待配置...
              </div>
            ) : (
              <div className="space-y-6">
                
                {/* Table Preview */}
                <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
                  <div className="bg-slate-950 px-4 py-2 flex items-center text-xs font-mono text-emerald-400 border-b border-slate-700">
                    <Table className="w-4 h-4 mr-2" />
                    ads_logical_model_v1
                  </div>
                  
                  <div className="p-1">
                    {/* Dimensions Part */}
                    {selectedDimIds.length > 0 && (
                      <div className="mb-2">
                        <div className="px-3 py-1.5 text-[10px] uppercase font-bold text-slate-500 tracking-wider bg-slate-800">
                          维度 (Group By)
                        </div>
                        {selectedDimIds.map(dimId => (
                          <div key={dimId} className="px-3 py-1.5 flex justify-between items-center text-sm hover:bg-slate-700/50">
                            <span className="text-indigo-300 flex items-center gap-2"><Layers className="w-3.5 h-3.5" /> {dimId}</span>
                            <span className="text-slate-500 text-xs">{DIMENSION_DICT[dimId]?.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Metrics Part */}
                    {selectedMetricIds.length > 0 && (
                      <div>
                        <div className="px-3 py-1.5 text-[10px] uppercase font-bold text-slate-500 tracking-wider bg-slate-800">
                          指标 (Select)
                        </div>
                        {selectedMetricIds.map(mId => {
                          const metric = AVAILABLE_METRICS.find(m => m.id === mId);
                          return (
                            <div key={mId} className="px-3 py-1.5 flex justify-between items-center text-sm hover:bg-slate-700/50">
                              <span className="text-blue-300 flex items-center gap-2"><Activity className="w-3.5 h-3.5" /> metric_{mId}</span>
                              <span className="text-slate-500 text-xs">{metric?.name}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <button 
                  disabled={selectedMetricIds.length === 0}
                  className={`w-full py-3 rounded-lg font-medium shadow flex items-center justify-center transition-all ${
                    selectedMetricIds.length > 0 
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/50 cursor-pointer' 
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <Database className="w-4 h-4 mr-2" />
                  执行物化配置 (DDL生成)
                </button>

              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
