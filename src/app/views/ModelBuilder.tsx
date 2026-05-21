/**
 * 模型构建器 - 多维分析界面
 * 支持多指标查询、维度选择、SQL预览
 */

import React, { useState, useMemo } from "react";
import {
  Play,
  Code,
  Database,
  Filter,
  X,
  ChevronDown,
  ChevronRight,
  Loader2,
  Download,
  BarChart3,
  Settings,
  Layers,
  Check,
  Calculator,
  Table,
  Activity,
} from "lucide-react";
import { Modal } from "../components/Modal";
import { useAnalysis } from "../../hooks/useAnalysis";
import { useMetrics } from "../../hooks/useMetrics";
import { useDimensions } from "../../hooks/useDimensions";
import { generateDDL } from "../../lib/ddl-generator";
import type { Metric, Dimension, AnalysisResult } from "../../types";

// 筛选条件类型
interface FilterCondition {
  id: string;
  field: string;
  operator: string;
  value: string;
}

// 视图模式
 type ViewMode = "builder" | "results" | "ddl";

export default function ModelBuilder() {
  // 数据加载
  const { metrics: availableMetrics, loading: metricsLoading } = useMetrics();
  const { dimensions: allDimensions, loading: dimsLoading } = useDimensions();
  const {
    result,
    loading: queryLoading,
    error,
    executeQuery,
    previewSQL,
    clearResult,
  } = useAnalysis();

  // 选择状态
  const [selectedMetricIds, setSelectedMetricIds] = useState<string[]>([]);
  const [selectedDimIds, setSelectedDimIds] = useState<string[]>([]);
  const [filters, setFilters] = useState<FilterCondition[]>([]);

  // UI 状态
  const [showSQLPreview, setShowSQLPreview] = useState(false);
  const [sqlPreview, setSqlPreview] = useState<string>("");
  const [viewMode, setViewMode] = useState<ViewMode>("builder");
  const [showDDL, setShowDDL] = useState(false);
  const [orderBy, setOrderBy] = useState<string>("");
  const [pageSize, setPageSize] = useState<number>(100);

  // 构建维度字典
  const dimensionDict = useMemo(() => {
    const dict: Record<string, Dimension> = {};
    allDimensions.forEach((d) => {
      dict[d.code] = d;
      dict[d.id] = d;
    });
    return dict;
  }, [allDimensions]);

  // 获取选中的指标完整对象
  const selectedMetrics = useMemo(() => {
    return availableMetrics.filter((m) => selectedMetricIds.includes(m.id));
  }, [selectedMetricIds, availableMetrics]);

  // 获取选中的维度完整对象
  const selectedDimensions = useMemo(() => {
    return allDimensions.filter((d) => selectedDimIds.includes(d.id));
  }, [selectedDimIds, allDimensions]);

  // Select/Deselect Metrics
  const toggleMetric = (id: string) => {
    setSelectedMetricIds((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
    // Reset selected dims when metrics change
    setSelectedDimIds([]);
  };

  // Select/Deselect Dimensions
  const toggleDim = (id: string) => {
    setSelectedDimIds((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    );
  };

  // 添加筛选条件
  const addFilter = () => {
    const newFilter: FilterCondition = {
      id: Math.random().toString(36).substr(2, 9),
      field: "",
      operator: "eq",
      value: "",
    };
    setFilters([...filters, newFilter]);
  };

  // 更新筛选条件
  const updateFilter = (id: string, updates: Partial<FilterCondition>) => {
    setFilters(filters.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  };

  // 删除筛选条件
  const removeFilter = (id: string) => {
    setFilters(filters.filter((f) => f.id !== id));
  };

  // Core Logic: Calculate intersection of dimensions
  const intersectedDims = useMemo(() => {
    if (selectedMetricIds.length === 0 || availableMetrics.length === 0) return [];

    const selectedMetricsData = availableMetrics.filter((m) =>
      selectedMetricIds.includes(m.id)
    );
    const dimArrays = selectedMetricsData.map((m) => m.dims || []);

    if (dimArrays.length === 0) return [];

    const intersection = dimArrays.reduce(
      (acc, curr) => acc.filter((dim) => curr.includes(dim)),
      dimArrays[0] || []
    );

    return intersection.map((code) => dimensionDict[code]).filter(Boolean);
  }, [selectedMetricIds, availableMetrics, dimensionDict]);

  // Generate DDL
  const ddlResult = useMemo(() => {
    if (selectedMetricIds.length === 0 || selectedDimIds.length === 0) return null;
    return generateDDL(selectedMetrics, selectedDimensions);
  }, [selectedMetrics, selectedDimensions, selectedMetricIds, selectedDimIds]);

  // 预览 SQL
  const handlePreviewSQL = async () => {
    if (selectedMetricIds.length === 0) return;

    const sql = await previewSQL({
      indicator_ids: selectedMetricIds,
      dimension_ids: selectedDimIds,
      filters: filters
        .filter((f) => f.field && f.value)
        .map((f) => ({
          property_id: f.field,
          operator: f.operator,
          value: f.value,
        })),
      order_by: orderBy,
      page_size: pageSize,
    });

    if (sql) {
      setSqlPreview(sql);
      setShowSQLPreview(true);
    }
  };

  // 执行查询
  const handleExecuteQuery = async () => {
    if (selectedMetricIds.length === 0) return;

    await executeQuery({
      indicator_ids: selectedMetricIds,
      dimension_ids: selectedDimIds,
      filters: filters
        .filter((f) => f.field && f.value)
        .map((f) => ({
          property_id: f.field,
          operator: f.operator,
          value: f.value,
        })),
      order_by: orderBy,
      page_size: pageSize,
    });

    setViewMode("results");
  };

  // 导出 CSV
  const handleExportCSV = () => {
    if (!result) return;

    const headers = result.columns.join(",");
    const rows = result.rows.map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
    );
    const csv = [headers, ...rows].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `analysis_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  };

  // 获取指标类型显示文本
  const getMetricTypeText = (type: string) => {
    const typeMap: Record<string, string> = {
      atomic: "原子",
      derived: "衍生",
      composite: "复合",
      nested: "嵌套",
      derived_from_composite: "衍生复合",
    };
    return typeMap[type] || type;
  };

  // 获取指标类型颜色
  const getMetricTypeColor = (type: string) => {
    const colorMap: Record<string, string> = {
      atomic: "bg-blue-100 text-blue-700",
      derived: "bg-green-100 text-green-700",
      composite: "bg-purple-100 text-purple-700",
      nested: "bg-orange-100 text-orange-700",
      derived_from_composite: "bg-pink-100 text-pink-700",
    };
    return colorMap[type] || "bg-gray-100 text-gray-700";
  };

  const loading = metricsLoading || dimsLoading;

  return (
    <div className="max-w-7xl mx-auto h-full flex flex-col gap-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">模型构建器</h1>
          <p className="text-slate-500 mt-1">
            选择指标和维度，构建多维分析查询或生成数据表结构。
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode("builder")}
            className={`flex items-center px-4 py-2 rounded-lg transition ${
              viewMode === "builder"
                ? "bg-blue-600 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            <Settings className="w-4 h-4 mr-2" />
            配置
          </button>
          <button
            onClick={() => setViewMode("ddl")}
            disabled={selectedMetricIds.length === 0}
            className={`flex items-center px-4 py-2 rounded-lg transition ${
              viewMode === "ddl"
                ? "bg-slate-800 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            } disabled:opacity-50`}
          >
            <Database className="w-4 h-4 mr-2" />
            DDL
          </button>
          <button
            onClick={handlePreviewSQL}
            disabled={selectedMetricIds.length === 0}
            className="flex items-center px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition disabled:opacity-50"
          >
            <Code className="w-4 h-4 mr-2" />
            SQL
          </button>
          <button
            onClick={handleExecuteQuery}
            disabled={selectedMetricIds.length === 0 || queryLoading}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
          >
            {queryLoading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Play className="w-4 h-4 mr-2" />
            )}
            执行查询
          </button>
        </div>
      </div>

      {/* Main Content */}
      {viewMode === "builder" && (
        <div className="flex gap-6 flex-1 min-h-0">
          {/* Step 1: Select Metrics */}
          <div className="w-1/3 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200">
              <h2 className="font-semibold text-slate-800 flex items-center">
                <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm mr-2">
                  1
                </span>
                选择指标
                {selectedMetricIds.length > 0 && (
                  <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs">
                    {selectedMetricIds.length}
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-500 mt-1 pl-8">
                勾选需要分析的指标
              </p>
            </div>
            <div className="flex-1 overflow-auto p-2">
              {metricsLoading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                </div>
              ) : availableMetrics.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-sm text-slate-400">
                  暂无指标数据
                </div>
              ) : (
                <div className="space-y-1">
                  {availableMetrics.map((metric) => {
                    const isSelected = selectedMetricIds.includes(metric.id);
                    return (
                      <div
                        key={metric.id}
                        onClick={() => toggleMetric(metric.id)}
                        className={`p-3 m-2 rounded-lg border cursor-pointer transition-all flex items-center ${
                          isSelected
                            ? "border-blue-500 bg-blue-50"
                            : "border-slate-200 hover:border-blue-300 hover:bg-slate-50"
                        }`}
                      >
                        <div
                          className={`w-5 h-5 rounded border mr-3 flex items-center justify-center ${
                            isSelected
                              ? "bg-blue-500 border-blue-500"
                              : "border-slate-300 bg-white"
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-sm text-slate-800 flex items-center gap-2">
                            {metric.name}
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded ${getMetricTypeColor(
                                metric.type
                              )}`}
                            >
                              {getMetricTypeText(metric.type)}
                            </span>
                          </div>
                          <div className="flex gap-1 mt-1.5 flex-wrap">
                            {metric.dims?.slice(0, 3).map((dim) => (
                              <span
                                key={dim}
                                className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded border border-slate-200"
                              >
                                {dimensionDict[dim]?.name || dim}
                              </span>
                            ))}
                            {metric.dims && metric.dims.length > 3 && (
                              <span className="text-[10px] px-1.5 py-0.5 text-slate-400">
                                +{metric.dims.length - 3}
                              </span>
                            )}
                          </div>
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

          {/* Step 2: Select Dimensions */}
          <div className="w-1/3 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200">
              <h2 className="font-semibold text-slate-800 flex items-center">
                <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm mr-2">
                  2
                </span>
                选择维度
                {selectedDimIds.length > 0 && (
                  <span className="ml-2 px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-xs">
                    {selectedDimIds.length}
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-500 mt-1 pl-8">选择共有的维度</p>
            </div>
            <div className="flex-1 overflow-auto p-4 bg-slate-50/50">
              {selectedMetricIds.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-slate-400 text-center p-6">
                  请先在左侧选择至少一个指标
                </div>
              ) : intersectedDims.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-red-400 text-center p-6 bg-red-50 rounded-lg border border-red-100">
                  所选指标没有共有的维度交集
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-xs font-semibold text-indigo-600 mb-2 uppercase tracking-wide">
                    可用的共有维度 ({intersectedDims.length})
                  </div>
                  {intersectedDims.map((dim) => {
                    if (!dim) return null;
                    const isSelected = selectedDimIds.includes(dim.id);
                    return (
                      <div
                        key={dim.id}
                        onClick={() => toggleDim(dim.id)}
                        className={`p-3 rounded-lg border cursor-pointer transition-all flex items-center bg-white ${
                          isSelected
                            ? "border-indigo-500 shadow-[0_0_0_1px_rgba(99,102,241,1)]"
                            : "border-slate-200 hover:border-indigo-300"
                        }`}
                      >
                        <div
                          className={`w-5 h-5 rounded border mr-3 flex items-center justify-center transition-colors ${
                            isSelected
                              ? "bg-indigo-500 border-indigo-500"
                              : "border-slate-300"
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                        </div>
                        <div>
                          <div className="font-medium text-sm text-slate-800">
                            {dim.name}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            {dim.code}
                          </div>
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

          {/* Step 3: Settings & Filters */}
          <div className="w-1/3 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200">
              <h2 className="font-semibold text-slate-800 flex items-center">
                <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm mr-2">
                  3
                </span>
                查询设置
              </h2>
              <p className="text-xs text-slate-500 mt-1 pl-8">配置筛选和排序</p>
            </div>
            <div className="flex-1 overflow-auto p-4 space-y-6">
              {/* 筛选条件 */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-sm font-medium text-slate-700 flex items-center">
                    <Filter className="w-4 h-4 mr-1 text-orange-500" />
                    筛选条件
                  </h3>
                  <button
                    onClick={addFilter}
                    className="text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded hover:bg-orange-200 transition"
                  >
                    + 添加
                  </button>
                </div>
                <div className="space-y-2">
                  {filters.length === 0 ? (
                    <p className="text-xs text-slate-400 py-2">暂无筛选条件</p>
                  ) : (
                    filters.map((filter) => (
                      <div
                        key={filter.id}
                        className="flex gap-1 items-center p-2 bg-slate-50 rounded-lg"
                      >
                        <select
                          value={filter.field}
                          onChange={(e) =>
                            updateFilter(filter.id, { field: e.target.value })
                          }
                          className="flex-1 px-2 py-1 text-xs border border-slate-200 rounded"
                        >
                          <option value="">选择字段</option>
                          {selectedDimensions.map((dim) => (
                            <option key={dim.id} value={dim.id}>
                              {dim.name}
                            </option>
                          ))}
                        </select>
                        <select
                          value={filter.operator}
                          onChange={(e) =>
                            updateFilter(filter.id, { operator: e.target.value })
                          }
                          className="w-20 px-2 py-1 text-xs border border-slate-200 rounded"
                        >
                          <option value="eq">=</option>
                          <option value="ne">≠</option>
                          <option value="gt">&gt;</option>
                          <option value="gte">≥</option>
                          <option value="lt">&lt;</option>
                          <option value="lte">≤</option>
                          <option value="like">~</option>
                        </select>
                        <input
                          type="text"
                          value={filter.value}
                          onChange={(e) =>
                            updateFilter(filter.id, { value: e.target.value })
                          }
                          placeholder="值"
                          className="flex-1 px-2 py-1 text-xs border border-slate-200 rounded"
                        />
                        <button
                          onClick={() => removeFilter(filter.id)}
                          className="p-1 text-slate-400 hover:text-red-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* 排序和分页 */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-slate-700 flex items-center">
                  <Settings className="w-4 h-4 mr-1 text-purple-500" />
                  高级设置
                </h3>
                <div>
                  <label className="text-xs text-slate-600 block mb-1">
                    排序字段
                  </label>
                  <select
                    value={orderBy}
                    onChange={(e) => setOrderBy(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  >
                    <option value="">默认</option>
                    {selectedDimensions.map((dim) => (
                      <option key={dim.id} value={`dim_${dim.id}`}>
                        {dim.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-600 block mb-1">
                    每页行数
                  </label>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  >
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={200}>200</option>
                    <option value={500}>500</option>
                  </select>
                </div>
              </div>

              {/* 摘要 */}
              <div className="pt-4 border-t border-slate-200">
                <h4 className="text-sm font-medium text-slate-700 mb-2">配置摘要</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">指标</span>
                    <span className="font-medium">{selectedMetrics.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">维度</span>
                    <span className="font-medium">{selectedDimensions.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">筛选</span>
                    <span className="font-medium">{filters.length}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DDL View */}
      {viewMode === "ddl" && (
        <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl shadow-xl flex flex-col overflow-hidden text-slate-200">
          <div className="p-4 border-b border-slate-800 flex justify-between items-center">
            <div>
              <h2 className="font-semibold text-white flex items-center">
                <Database className="w-5 h-5 mr-2 text-emerald-400" />
                数据表结构 (DDL)
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                生成的 DWS / ADS 层表结构
              </p>
            </div>
            <button
              onClick={() => setViewMode("builder")}
              className="px-4 py-2 text-sm text-slate-400 hover:text-white transition"
            >
              返回
            </button>
          </div>
          <div className="flex-1 overflow-auto p-6">
            {selectedMetricIds.length === 0 || selectedDimIds.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-500">
                请先选择指标和维度
              </div>
            ) : ddlResult ? (
              <div className="space-y-6">
                {/* Table Preview */}
                <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
                  <div className="bg-slate-950 px-4 py-2 flex items-center text-xs font-mono text-emerald-400 border-b border-slate-700">
                    <Table className="w-4 h-4 mr-2" />
                    {ddlResult.tableName}
                  </div>
                  <div className="p-1">
                    {selectedDimIds.length > 0 && (
                      <div className="mb-2">
                        <div className="px-3 py-1.5 text-[10px] uppercase font-bold text-slate-500 tracking-wider bg-slate-800">
                          维度 (Group By)
                        </div>
                        {selectedDimIds.map((dimId) => (
                          <div
                            key={dimId}
                            className="px-3 py-1.5 flex justify-between items-center text-sm hover:bg-slate-700/50"
                          >
                            <span className="text-indigo-300 flex items-center gap-2">
                              <Layers className="w-3.5 h-3.5" /> {dimensionDict[dimId]?.code}
                            </span>
                            <span className="text-slate-500 text-xs">
                              {dimensionDict[dimId]?.name}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    {selectedMetricIds.length > 0 && (
                      <div>
                        <div className="px-3 py-1.5 text-[10px] uppercase font-bold text-slate-500 tracking-wider bg-slate-800">
                          指标 (Select)
                        </div>
                        {selectedMetrics.map((metric) => (
                          <div
                            key={metric.id}
                            className="px-3 py-1.5 flex justify-between items-center text-sm hover:bg-slate-700/50"
                          >
                            <span className="text-blue-300 flex items-center gap-2">
                              <Activity className="w-3.5 h-3.5" /> {metric.code}
                            </span>
                            <span className="text-slate-500 text-xs">
                              {metric.name}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* SQL Preview */}
                <div className="bg-slate-950 rounded-lg border border-slate-800 overflow-hidden">
                  <div className="bg-slate-900 px-4 py-2 flex items-center justify-between border-b border-slate-800">
                    <span className="text-xs font-mono text-emerald-400">
                      {ddlResult.tableName}
                    </span>
                    <span className="text-xs text-slate-500">SQL DDL</span>
                  </div>
                  <pre className="p-4 text-xs font-mono text-slate-300 overflow-x-auto">
                    {ddlResult.sql}
                  </pre>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Results View */}
      {viewMode === "results" && (
        <div className="flex-1 bg-white border border-slate-200 rounded-xl flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setViewMode("builder")}
                className="text-slate-600 hover:text-slate-900"
              >
                <ChevronRight className="w-5 h-5 rotate-180" />
              </button>
              <h2 className="font-semibold text-slate-800 flex items-center">
                <BarChart3 className="w-5 h-5 mr-2 text-blue-500" />
                查询结果
              </h2>
              {result && (
                <>
                  <span className="text-sm text-slate-600">
                    共 <strong>{result.total}</strong> 行
                  </span>
                  <span className="text-xs text-slate-400">
                    {result.columns.length} 列
                  </span>
                </>
              )}
            </div>
            {result && (
              <button
                onClick={handleExportCSV}
                className="flex items-center px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition"
              >
                <Download className="w-4 h-4 mr-1.5" />
                导出 CSV
              </button>
            )}
          </div>
          <div className="flex-1 overflow-auto">
            {error ? (
              <div className="flex flex-col items-center justify-center h-full text-red-600">
                <p>查询失败: {error}</p>
                <button
                  onClick={() => setViewMode("builder")}
                  className="mt-4 px-4 py-2 bg-slate-100 rounded-lg hover:bg-slate-200 transition"
                >
                  返回修改
                </button>
              </div>
            ) : result ? (
              <table className="w-full text-sm">
                <thead className="bg-slate-100 sticky top-0 z-10">
                  <tr>
                    {result.columns.map((col) => (
                      <th
                        key={col}
                        className="px-4 py-3 text-left font-semibold text-slate-700 border-b border-slate-200 whitespace-nowrap"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {result.rows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      {row.map((cell, cellIdx) => (
                        <td
                          key={cellIdx}
                          className="px-4 py-2 text-slate-600 whitespace-nowrap"
                        >
                          {cell === null || cell === undefined
                            ? "-"
                            : String(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400">
                <p>暂无查询结果</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SQL Preview Modal */}
      <Modal
        isOpen={showSQLPreview}
        onClose={() => setShowSQLPreview(false)}
        title="SQL 预览"
        width="max-w-4xl"
      >
        <div className="space-y-4">
          <div className="bg-slate-900 text-slate-100 p-4 rounded-lg overflow-auto max-h-96 font-mono text-sm">
            <pre>{sqlPreview || "-- 点击预览 SQL 按钮生成"}</pre>
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowSQLPreview(false)}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition"
            >
              关闭
            </button>
            <button
              onClick={() => {
                navigator.clipboard.writeText(sqlPreview);
              }}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              复制 SQL
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
