import React, { useState, useEffect } from "react";
import { Plus, Search, FileSpreadsheet, Edit3, Trash2, Database, Loader2 } from "lucide-react";
import { Modal } from "../components/Modal";
import { useFactTables } from "../../hooks/useFactTables";
import { useDimensions } from "../../hooks/useDimensions";
import { useProperties } from "../../hooks/useProperties";
import type { FactTable, Property } from "../../types";

export default function FactTables() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<FactTable | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const { factTables, loading, error, refetch, create, update, remove } = useFactTables(searchQuery);
  const { dimensions } = useDimensions();
  const { properties, fetchProperties, createProperty, updateProperty, deleteProperty } = useProperties();

  const [managingTable, setManagingTable] = useState<FactTable | null>(null);
  const [isPropertyModalOpen, setIsPropertyModalOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [propertyForm, setPropertyForm] = useState({
    name: "",
    type: "string" as Property["type"],
    dimension_id: "",
    description: "",
    is_join_key: false,
  });

  const [formData, setFormData] = useState({
    name: "",
    code: "",
    description: "",
    dims: [] as string[],
    measures: [] as string[],
  });
  const [newMeasure, setNewMeasure] = useState("");

  const resetForm = () => {
    setFormData({ name: "", code: "", description: "", dims: [], measures: [] });
    setEditingTable(null);
    setNewMeasure("");
  };

  const handleOpenCreate = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleOpenEdit = (table: FactTable) => {
    setEditingTable(table);
    setFormData({
      name: table.name,
      code: table.code,
      description: table.description || "",
      dims: table.dims || [],
      measures: table.measures || [],
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
      const data = {
        name: formData.name,
        code: formData.code,
        description: formData.description || undefined,
        dims: formData.dims,
        measures: formData.measures,
      };
      const success = editingTable
        ? await update(editingTable.id, data)
        : await create(data);
      if (success) handleCloseModal();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定要删除这个事实表吗？")) return;
    setIsDeleting(id);
    try { await remove(id); } finally { setIsDeleting(null); }
  };

  // 字段管理相关函数
  const handleManageProperties = async (table: FactTable) => {
    setManagingTable(table);
    await fetchProperties(table.id);
    setIsPropertyModalOpen(true);
  };

  const handleClosePropertyModal = () => {
    setIsPropertyModalOpen(false);
    setManagingTable(null);
    setEditingProperty(null);
    setPropertyForm({
      name: "",
      type: "string",
      dimension_id: "",
      description: "",
      is_join_key: false,
    });
  };

  const handleEditProperty = (prop: Property) => {
    setEditingProperty(prop);
    setPropertyForm({
      name: prop.name,
      type: prop.type,
      dimension_id: prop.dimension_id || "",
      description: prop.description || "",
      is_join_key: prop.is_join_key || false,
    });
  };

  const handleSaveProperty = async () => {
    if (!managingTable || !propertyForm.name.trim()) return;

    const data = {
      name: propertyForm.name.trim(),
      type: propertyForm.type,
      component_id: managingTable.id,
      dimension_id: propertyForm.dimension_id || null,
      description: propertyForm.description || undefined,
      is_join_key: propertyForm.is_join_key,
    };

    if (editingProperty) {
      await updateProperty(editingProperty.id, data);
    } else {
      await createProperty(data);
    }

    await fetchProperties(managingTable.id);
    setEditingProperty(null);
    setPropertyForm({
      name: "",
      type: "string",
      dimension_id: "",
      description: "",
      is_join_key: false,
    });
  };

  const handleDeleteProperty = async (propId: string) => {
    if (!confirm("确定要删除这个字段吗？")) return;
    await deleteProperty(propId);
    if (managingTable) {
      await fetchProperties(managingTable.id);
    }
  };

  const toggleDim = (dimName: string) => {
    setFormData(prev => ({
      ...prev,
      dims: prev.dims.includes(dimName)
        ? prev.dims.filter(d => d !== dimName)
        : [...prev.dims, dimName]
    }));
  };

  const addMeasure = () => {
    if (!newMeasure.trim()) return;
    setFormData(prev => ({ ...prev, measures: [...prev.measures, newMeasure.trim()] }));
    setNewMeasure("");
  };

  const removeMeasure = (idx: number) => {
    setFormData(prev => ({ ...prev, measures: prev.measures.filter((_, i) => i !== idx) }));
  };

  useEffect(() => {
    const timer = setTimeout(() => refetch(), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  return (
    <div className="max-w-6xl mx-auto h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">事实表管理 (DWD)</h1>
          <p className="text-slate-500 mt-1">定义业务事实表，关联相关维度，并定义可用于派生原子指标的度量字段。</p>
        </div>
        <button onClick={handleOpenCreate} className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium text-sm shadow-sm">
          <Plus className="w-4 h-4 mr-2" />新建事实表
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col flex-1 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex gap-4 bg-slate-50/50">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input type="text" placeholder="搜索事实表名称或编码..." value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        <div className="flex-1 overflow-auto">
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
                <th className="px-6 py-3 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">事实表名称</th>
                <th className="px-6 py-3 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">表名编码</th>
                <th className="px-6 py-3 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider w-1/4">关联维度</th>
                <th className="px-6 py-3 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider w-1/4">包含度量</th>
                <th className="px-6 py-3 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {factTables.map((table) => (
                <tr key={table.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className="w-8 h-8 rounded bg-indigo-50 flex items-center justify-center mr-3 text-indigo-600">
                        <FileSpreadsheet className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-medium text-slate-900">{table.name}</div>
                        <div className="text-xs text-slate-500 mt-0.5 truncate max-w-[200px]">{table.description}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2 py-1 rounded bg-slate-100 text-slate-700 font-mono text-xs border border-slate-200">{table.code}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1.5">
                      {table.dims?.map(dim => (
                        <span key={dim} className="text-[11px] px-2 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-100">{dim}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1.5">
                      {table.measures?.map(m => (
                        <span key={m} className="text-[11px] px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded border border-emerald-100">{m}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => handleManageProperties(table)} className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors mr-1 opacity-0 group-hover:opacity-100" title="管理字段"><Database className="w-4 h-4" /></button>
                    <button onClick={() => handleOpenEdit(table)} className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors mr-1 opacity-0 group-hover:opacity-100"><Edit3 className="w-4 h-4" /></button>
                    <button onClick={() => handleDelete(table.id)} disabled={isDeleting === table.id} className="p-1.5 text-slate-400 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50">{isDeleting === table.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}</button>
                  </td>
                </tr>
              ))}
              {factTables.length === 0 && (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-500">{searchQuery ? "未找到匹配的事实表" : "暂无事实表数据"}</td></tr>
              )}
            </tbody>
          </table>
          )}
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={editingTable ? "编辑事实表" : "新建事实表"} width="max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">事实表名称 <span className="text-red-500">*</span></label>
              <input type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})}
                placeholder="例如：交易订单事实表" required disabled={isSubmitting}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">表名编码 <span className="text-red-500">*</span></label>
              <input type="text" value={formData.code} onChange={(e) => setFormData({...formData, code: e.target.value})}
                placeholder="例如：dwd_trade_order" required disabled={isSubmitting || !!editingTable}
                pattern="^[a-z][a-z0-9_]*$"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">描述</label>
            <textarea value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})}
              placeholder="描述该事实表的业务含义..." rows={2} disabled={isSubmitting}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
          </div>

          <div className="pt-4 border-t border-slate-100 grid grid-cols-2 gap-8">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-800 flex items-center"><Database className="w-4 h-4 mr-1.5 text-blue-500" />关联维度</label>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg max-h-40 overflow-y-auto">
                {dimensions.map((dim) => (
                  <label key={dim.id} className="flex items-center space-x-2 p-2 hover:bg-white rounded cursor-pointer">
                    <input type="checkbox" checked={formData.dims.includes(dim.name)}
                      onChange={() => toggleDim(dim.name)} disabled={isSubmitting}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                    <span className="text-sm text-slate-700">{dim.name}</span>
                  </label>
                ))}
                {dimensions.length === 0 && <p className="text-xs text-slate-400 text-center py-2">请先创建维度</p>}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-800 flex items-center"><FileSpreadsheet className="w-4 h-4 mr-1.5 text-emerald-500" />定义度量</label>
              </div>
              <div className="flex gap-2">
                <input type="text" value={newMeasure} onChange={(e) => setNewMeasure(e.target.value)}
                  placeholder="输入度量名称" disabled={isSubmitting}
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addMeasure())} />
                <button type="button" onClick={addMeasure} disabled={isSubmitting || !newMeasure.trim()}
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">添加</button>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2 max-h-32 overflow-y-auto">
                {formData.measures.map((measure, i) => (
                  <div key={i} className="flex items-center justify-between text-sm bg-white p-2 rounded border border-slate-100">
                    <span className="text-slate-600">{measure}</span>
                    <button type="button" onClick={() => removeMeasure(i)} disabled={isSubmitting}><Trash2 className="w-3.5 h-3.5 text-slate-300 hover:text-red-500" /></button>
                  </div>
                ))}
                {formData.measures.length === 0 && <p className="text-xs text-slate-400 text-center py-2">暂无度量字段</p>}
              </div>
            </div>
          </div>

          <div className="pt-6 flex justify-end gap-3 border-t border-slate-100">
            <button type="button" onClick={handleCloseModal} disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50">取消</button>
            <button type="submit" disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm disabled:opacity-50 flex items-center">
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}{editingTable ? "保存修改" : "保存配置"}
            </button>
          </div>
        </form>
      </Modal>

      {/* 字段管理弹窗 */}
      <Modal isOpen={isPropertyModalOpen} onClose={handleClosePropertyModal} title={`管理字段 - ${managingTable?.name || ''}`} width="max-w-3xl">
        <div className="space-y-5">
          {/* 字段列表 */}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2 text-xs font-semibold text-slate-500">字段名</th>
                  <th className="px-4 py-2 text-xs font-semibold text-slate-500">类型</th>
                  <th className="px-4 py-2 text-xs font-semibold text-slate-500">关联维度</th>
                  <th className="px-4 py-2 text-xs font-semibold text-slate-500 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {properties.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">暂无字段定义</td></tr>
                ) : (
                  properties.map((prop) => (
                    <tr key={prop.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2 font-medium">{prop.name}</td>
                      <td className="px-4 py-2"><span className="px-2 py-0.5 bg-slate-100 rounded text-xs">{prop.type}</span></td>
                      <td className="px-4 py-2">{prop.dimension_id ? dimensions.find(d => d.id === prop.dimension_id)?.name || prop.dimension_id : '-'}</td>
                      <td className="px-4 py-2 text-right">
                        <button onClick={() => handleEditProperty(prop)} className="p-1 text-slate-400 hover:text-blue-600"><Edit3 className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDeleteProperty(prop.id)} className="p-1 text-slate-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* 添加/编辑字段表单 */}
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
            <h4 className="text-sm font-medium text-slate-700 mb-3">{editingProperty ? '编辑字段' : '添加字段'}</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-600">字段名 <span className="text-red-500">*</span></label>
                <input type="text" value={propertyForm.name} onChange={(e) => setPropertyForm({...propertyForm, name: e.target.value})} placeholder="例如：order_id" className="w-full px-3 py-2 border border-slate-300 rounded text-sm mt-1" />
              </div>
              <div>
                <label className="text-xs text-slate-600">字段类型</label>
                <select value={propertyForm.type} onChange={(e) => setPropertyForm({...propertyForm, type: e.target.value as Property['type']})} className="w-full px-3 py-2 border border-slate-300 rounded text-sm mt-1">
                  <option value="string">字符串 (string)</option>
                  <option value="int">整数 (int)</option>
                  <option value="decimal">小数 (decimal)</option>
                  <option value="date">日期 (date)</option>
                  <option value="datetime">日期时间 (datetime)</option>
                  <option value="boolean">布尔 (boolean)</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-600">关联维度</label>
                <select value={propertyForm.dimension_id} onChange={(e) => setPropertyForm({...propertyForm, dimension_id: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded text-sm mt-1">
                  <option value="">无</option>
                  {dimensions.map(dim => (
                    <option key={dim.id} value={dim.id}>{dim.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-600">描述</label>
                <input type="text" value={propertyForm.description} onChange={(e) => setPropertyForm({...propertyForm, description: e.target.value})} placeholder="字段描述..." className="w-full px-3 py-2 border border-slate-300 rounded text-sm mt-1" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-3">
              {editingProperty && (
                <button onClick={() => { setEditingProperty(null); setPropertyForm({name: '', type: 'string', dimension_id: '', description: '', is_join_key: false}); }} className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded">取消编辑</button>
              )}
              <button onClick={handleSaveProperty} disabled={!propertyForm.name.trim()} className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">{editingProperty ? '更新' : '添加'}</button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
