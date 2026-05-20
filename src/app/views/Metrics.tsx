import React, { useState, useEffect } from "react";
import { Plus, Search, GitMerge, Calculator, Copy, Tag, Loader2, Edit3, Trash2 } from "lucide-react";
import { Modal } from "../components/Modal";
import { useMetrics } from "../../hooks/useMetrics";
import { useFactTables } from "../../hooks/useFactTables";
import type { Metric, MetricType } from "../../types";

export default function Metrics() {
  const [activeTab, setActiveTab] = useState<MetricType>('atomic');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingMetric, setEditingMetric] = useState<Metric | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const { metrics, loading, error, refetch, create, update, remove } = useMetrics(activeTab, searchQuery);
  const { factTables } = useFactTables();

  // 表单状态
  const [formData, setFormData] = useState({
    name: "",
    type: "atomic" as MetricType,
    source: "",
    measure: "",
    agg: "SUM",
    condition: "",
    formula: "",
    base_metrics: [] as string[],
    dims: [] as string[],
  });

  const resetForm = () => {
    setFormData({
      name: "", type: "atomic", source: "", measure: "", agg: "SUM",
      condition: "", formula: "", base_metrics: [], dims: []
    });
    setEditingMetric(null);
  };

  const handleOpenCreate = () => {
    resetForm();
    setFormData(prev => ({ ...prev, type: activeTab }));
    setIsModalOpen(true);
  };

  const handleOpenEdit = (metric: Metric) => {
    setEditingMetric(metric);
    setFormData({
      name: metric.name,
      type: metric.type,
      source: metric.source || "",
      measure: metric.measure || "",
      agg: metric.agg || "SUM",
      condition: metric.condition || "",
      formula: metric.formula || "",
      base_metrics: metric.base_metrics || [],
      dims: metric.dims || [],
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    if (isSubmitting) return;
    setIsModalOpen(false);
    resetForm();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const data = { ...formData };
      const success = editingMetric
        ? await update(editingMetric.id, data)
        : await create(data);
      if (success) handleCloseModal();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定要删除这个指标吗？")) return;
    setIsDeleting(id);
    try { await remove(id); } finally { setIsDeleting(null); }
  };

  useEffect(() => {
    const timer = setTimeout(() => refetch(), 300);
    return () => clearTimeout(timer);
  }, [searchQuery, activeTab]);

  return (
    <div className="max-w-6xl mx-auto h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">统一指标管理</h1>
          <p className="text-slate-500 mt-1">配置和管理原子指标、衍生指标和复合指标，自动继承和交集维度。</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium text-sm shadow-sm"
        >
          <Plus className="w-4 h-4 mr-2" />
          新建指标
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col flex-1 overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-4">
          <button 
            onClick={() => setActiveTab('atomic')}
            className={`py-4 px-6 font-medium text-sm border-b-2 transition-colors ${activeTab === 'atomic' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            <div className="flex items-center"><Copy className="w-4 h-4 mr-2"/> 原子指标 (基于DWD)</div>
          </button>
          <button 
            onClick={() => setActiveTab('derived')}
            className={`py-4 px-6 font-medium text-sm border-b-2 transition-colors ${activeTab === 'derived' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            <div className="flex items-center"><GitMerge className="w-4 h-4 mr-2"/> 衍生指标 (原子+条件)</div>
          </button>
          <button 
            onClick={() => setActiveTab('composite')}
            className={`py-4 px-6 font-medium text-sm border-b-2 transition-colors ${activeTab === 'composite' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            <div className="flex items-center"><Calculator className="w-4 h-4 mr-2"/> 复合指标 (指标计算)</div>
          </button>
        </div>

        <div className="p-4 border-b border-slate-100 flex gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`搜索${activeTab === 'atomic' ? '原子' : activeTab === 'derived' ? '衍生' : '复合'}指标...`}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-white">
          {loading ? (
            <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-500">
              <p>加载失败: {error}</p>
              <button onClick={() => refetch()} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg">重试</button>
            </div>
          ) : (
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-6 py-3 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">指标名称</th>
                {activeTab === 'atomic' && (<><th className="px-6 py-3 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">来源DWD表</th><th className="px-6 py-3 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">度量/聚合</th></>)}
                {activeTab === 'derived' && (<><th className="px-6 py-3 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">来源原子指标</th><th className="px-6 py-3 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">业务限定条件</th></>)}
                {activeTab === 'composite' && (<><th className="px-6 py-3 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">计算公式</th><th className="px-6 py-3 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">依赖基础指标</th></>)}
                <th className="px-6 py-3 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider w-1/3">继承的可分析维度</th>
                <th className="px-6 py-3 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {metrics.map((metric: Metric) => (
                <tr key={metric.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-900">{metric.name}</td>
                  {activeTab === 'atomic' && (<><td className="px-6 py-4 text-sm text-slate-600 font-mono bg-slate-50/50">{metric.source}</td><td className="px-6 py-4 text-sm text-slate-600"><span className="font-semibold text-blue-600">{metric.agg}</span>({metric.measure})</td></>)}
                  {activeTab === 'derived' && (<><td className="px-6 py-4 text-sm text-slate-600"><div className="inline-flex items-center px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs border border-blue-100">{metric.source}</div></td><td className="px-6 py-4 text-sm text-slate-600 font-mono bg-yellow-50/50 border-l border-r border-yellow-100/50">{metric.condition}</td></>)}
                  {activeTab === 'composite' && (<><td className="px-6 py-4 text-sm font-mono text-purple-700 bg-purple-50/50">{metric.formula}</td><td className="px-6 py-4 text-sm text-slate-600"><div className="flex gap-1 flex-wrap">{metric.base_metrics?.map((b: string) => (<span key={b} className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs border border-slate-200">{b}</span>))}</div></td></>)}
                  <td className="px-6 py-4"><div className="flex flex-wrap gap-1.5">{metric.dims?.map((dim: string) => (<span key={dim} className="inline-flex items-center px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs"><Tag className="w-3 h-3 mr-1 text-slate-400" />{dim}</span>))}</div></td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => handleOpenEdit(metric)} className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors mr-2" title="编辑"><Edit3 className="w-4 h-4" /></button>
                    <button onClick={() => handleDelete(metric.id)} disabled={isDeleting === metric.id} className="p-1.5 text-slate-400 hover:text-red-600 transition-colors disabled:opacity-50" title="删除">{isDeleting === metric.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}</button>
                  </td>
                </tr>
              ))}
              {metrics.length === 0 && (
                <tr><td colSpan={4} className="px-6 py-12 text-center text-slate-500">{searchQuery ? "未找到匹配的指标" : `暂无${activeTab === 'atomic' ? '原子' : activeTab === 'derived' ? '衍生' : '复合'}指标`}</td></tr>
              )}
            </tbody>
          </table>
          )}
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={`新建${activeTab === 'atomic' ? '原子' : activeTab === 'derived' ? '衍生' : '复合'}指标`} width="max-w-xl">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">指标名称 <span className="text-red-500">*</span></label>
            <input type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} placeholder="例如：支付订单金额" required disabled={isSubmitting} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
          </div>

          {activeTab === 'atomic' && (<>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">来源DWD事实表 <span className="text-red-500">*</span></label>
              <select value={formData.source} onChange={(e) => setFormData({...formData, source: e.target.value})} required disabled={isSubmitting} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                <option value="">请选择事实表...</option>
                {factTables.map(ft => (<option key={ft.id} value={ft.code}>{ft.code} ({ft.name})</option>))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">度量字段 <span className="text-red-500">*</span></label>
                <input type="text" value={formData.measure} onChange={(e) => setFormData({...formData, measure: e.target.value})} placeholder="例如：pay_amount" required disabled={isSubmitting} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">聚合方式 <span className="text-red-500">*</span></label>
                <select value={formData.agg} onChange={(e) => setFormData({...formData, agg: e.target.value})} required disabled={isSubmitting} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                  <option value="SUM">求和 (SUM)</option>
                  <option value="COUNT">计数 (COUNT)</option>
                  <option value="COUNT_DISTINCT">去重计数 (COUNT DISTINCT)</option>
                  <option value="MAX">最大值 (MAX)</option>
                  <option value="MIN">最小值 (MIN)</option>
                </select>
              </div>
            </div>
          </>)}

          {activeTab === 'derived' && (<>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">来源原子指标 <span className="text-red-500">*</span></label>
              <input type="text" value={formData.source} onChange={(e) => setFormData({...formData, source: e.target.value})} placeholder="原子指标ID" required disabled={isSubmitting} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">业务限定条件 (Where 过滤) <span className="text-red-500">*</span></label>
              <textarea value={formData.condition} onChange={(e) => setFormData({...formData, condition: e.target.value})} placeholder="例如：渠道 = 'APP' AND 订单状态 = '已支付'" rows={3} required disabled={isSubmitting} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500" />
            </div>
          </>)}

          {activeTab === 'composite' && (<>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">计算公式 <span className="text-red-500">*</span></label>
              <textarea value={formData.formula} onChange={(e) => setFormData({...formData, formula: e.target.value})} placeholder="例如：[退款金额] / [支付订单金额]" rows={2} required disabled={isSubmitting} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500" />
            </div>
          </>)}

          <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 mt-6">
            <button type="button" onClick={handleCloseModal} disabled={isSubmitting} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50">取消</button>
            <button type="submit" disabled={isSubmitting} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm disabled:opacity-50 flex items-center">
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}保存并校验维度
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
