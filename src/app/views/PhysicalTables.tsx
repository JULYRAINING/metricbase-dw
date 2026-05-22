import React, { useState, useEffect } from "react";
import { Plus, Search, Database, Edit3, Trash2, Layers, Loader2, Table2 } from "lucide-react";
import { Modal } from "../components/Modal";
import { usePhysicalTables } from "../../hooks/usePhysicalTables";
import { useFields } from "../../hooks/useFields";
import { fetchDimensionTables } from "../../lib/api";
import type { PhysicalTable, Field, TableType, FieldRole } from "../../types";

type FilterTab = 'all' | 'dimension' | 'fact';

const TABLE_TYPE_LABELS: Record<TableType, string> = {
  dimension: '维度表',
  fact: '事实表',
};

const FIELD_ROLE_LABELS: Record<FieldRole, string> = {
  dimension_key: '维度键',
  measure: '度量',
  attribute: '属性',
};

const FIELD_TYPE_OPTIONS = [
  { value: 'string', label: '字符串 (string)' },
  { value: 'int', label: '整数 (int)' },
  { value: 'decimal', label: '小数 (decimal)' },
  { value: 'date', label: '日期 (date)' },
  { value: 'datetime', label: '日期时间 (datetime)' },
  { value: 'boolean', label: '布尔 (boolean)' },
];

export default function PhysicalTables() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<PhysicalTable | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  // Field management state
  const [managingTable, setManagingTable] = useState<PhysicalTable | null>(null);
  const [isFieldModalOpen, setIsFieldModalOpen] = useState(false);
  const [editingField, setEditingField] = useState<Field | null>(null);
  const [dimensionTables, setDimensionTables] = useState<PhysicalTable[]>([]);

  const tableTypeFilter = activeFilter === 'all' ? undefined : activeFilter;
  const { physicalTables, loading, error, refetch, create, update, remove } = usePhysicalTables(searchQuery, tableTypeFilter);
  const { fields, fetchFieldsByTable, create: createField, update: updateField, remove: removeField } = useFields();

  // Table form state
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    table_type: "dimension" as TableType,
    description: "",
  });

  // Field form state
  const [fieldForm, setFieldForm] = useState({
    name: "",
    type: "string" as Field['type'],
    field_role: "attribute" as FieldRole,
    dimension_ref_id: "",
    description: "",
    is_join_key: false,
  });

  // Load dimension tables for snowflake reference dropdown
  useEffect(() => {
    const loadDimensionTables = async () => {
      const response = await fetchDimensionTables();
      if (response.data) {
        setDimensionTables(response.data);
      }
    };
    loadDimensionTables();
  }, []);

  // Reset forms
  const resetTableForm = () => {
    setFormData({ name: "", code: "", table_type: "dimension", description: "" });
    setEditingTable(null);
  };

  const resetFieldForm = () => {
    setFieldForm({
      name: "",
      type: "string",
      field_role: "attribute",
      dimension_ref_id: "",
      description: "",
      is_join_key: false,
    });
    setEditingField(null);
  };

  // Table CRUD handlers
  const handleOpenCreate = () => {
    resetTableForm();
    setIsModalOpen(true);
  };

  const handleOpenEdit = (table: PhysicalTable) => {
    setEditingTable(table);
    setFormData({
      name: table.name,
      code: table.code,
      table_type: table.table_type,
      description: table.description || "",
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    if (isSubmitting) return;
    setIsModalOpen(false);
    resetTableForm();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const data = {
        name: formData.name,
        code: formData.code,
        table_type: formData.table_type,
        description: formData.description || undefined,
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
    if (!confirm("确定要删除这个物理表吗？关联的字段也会被删除。")) return;
    setIsDeleting(id);
    try {
      await remove(id);
    } finally {
      setIsDeleting(null);
    }
  };

  // Field management handlers
  const handleManageFields = async (table: PhysicalTable) => {
    setManagingTable(table);
    await fetchFieldsByTable(table.id);
    setIsFieldModalOpen(true);
  };

  const handleCloseFieldModal = () => {
    setIsFieldModalOpen(false);
    setManagingTable(null);
    resetFieldForm();
  };

  const handleEditField = (field: Field) => {
    setEditingField(field);
    setFieldForm({
      name: field.name,
      type: field.type,
      field_role: field.field_role,
      dimension_ref_id: field.dimension_ref_id || "",
      description: field.description || "",
      is_join_key: field.is_join_key,
    });
  };

  const handleSaveField = async () => {
    if (!managingTable || !fieldForm.name.trim()) return;

    const data = {
      name: fieldForm.name.trim(),
      type: fieldForm.type,
      field_role: fieldForm.field_role,
      table_id: managingTable.id,
      dimension_ref_id: fieldForm.dimension_ref_id || null,
      description: fieldForm.description || undefined,
      is_join_key: fieldForm.is_join_key,
    };

    let success: boolean;
    if (editingField) {
      success = await updateField(editingField.id, data);
    } else {
      success = await createField(data);
    }

    if (success) {
      await fetchFieldsByTable(managingTable.id);
      resetFieldForm();
    }
  };

  const handleDeleteField = async (fieldId: string) => {
    if (!confirm("确定要删除这个字段吗？")) return;
    const success = await removeField(fieldId);
    if (success && managingTable) {
      await fetchFieldsByTable(managingTable.id);
    }
  };

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => refetch(), 300);
    return () => clearTimeout(timer);
  }, [searchQuery, activeFilter]);

  // Filter available dimension tables for reference (exclude self)
  const availableDimensionRefs = managingTable
    ? dimensionTables.filter(t => t.id !== managingTable.id)
    : dimensionTables;

  return (
    <div className="max-w-6xl mx-auto h-full flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">物理表管理</h1>
          <p className="text-slate-500 mt-1">
            统一管理维度表和事实表，支持字段管理和雪花模型。
          </p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium text-sm shadow-sm"
        >
          <Plus className="w-4 h-4 mr-2" />新建物理表
        </button>
      </div>

      {/* Main content card */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col flex-1 overflow-hidden">
        {/* Filter bar */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-4 bg-slate-50/50">
          {/* Type filter tabs */}
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setActiveFilter('all')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              全部
            </button>
            <button
              onClick={() => setActiveFilter('dimension')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeFilter === 'dimension'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              维度表
            </button>
            <button
              onClick={() => setActiveFilter('fact')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeFilter === 'fact'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              事实表
            </button>
          </div>

          {/* Search input */}
          <div className="relative max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="搜索表名称或编码..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Table list */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-500">
              <p>加载失败: {error}</p>
              <button
                onClick={() => refetch()}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg"
              >
                重试
              </button>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="px-6 py-3 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    表名称
                  </th>
                  <th className="px-6 py-3 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    表名编码
                  </th>
                  <th className="px-6 py-3 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    类型
                  </th>
                  <th className="px-6 py-3 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    字段数
                  </th>
                  <th className="px-6 py-3 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {physicalTables.map((table) => (
                  <tr key={table.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div
                          className={`w-8 h-8 rounded flex items-center justify-center mr-3 ${
                            table.table_type === 'dimension'
                              ? 'bg-blue-50 text-blue-600'
                              : 'bg-indigo-50 text-indigo-600'
                          }`}
                        >
                          {table.table_type === 'dimension' ? (
                            <Database className="w-4 h-4" />
                          ) : (
                            <Table2 className="w-4 h-4" />
                          )}
                        </div>
                        <div>
                          <div className="font-medium text-slate-900">{table.name}</div>
                          <div className="text-xs text-slate-500 mt-0.5 truncate max-w-[200px]">
                            {table.description}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2 py-1 rounded bg-slate-100 text-slate-700 font-mono text-xs border border-slate-200">
                        {table.code}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded border ${
                          table.table_type === 'dimension'
                            ? 'bg-blue-50 text-blue-700 border-blue-100'
                            : 'bg-indigo-50 text-indigo-700 border-indigo-100'
                        }`}
                      >
                        {TABLE_TYPE_LABELS[table.table_type]}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-slate-600">
                        {(table as PhysicalTable & { field_count?: number }).field_count || 0} 个字段
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleManageFields(table)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors mr-1 opacity-0 group-hover:opacity-100"
                        title="管理字段"
                      >
                        <Layers className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleOpenEdit(table)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors mr-1 opacity-0 group-hover:opacity-100"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(table.id)}
                        disabled={isDeleting === table.id}
                        className="p-1.5 text-slate-400 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50"
                      >
                        {isDeleting === table.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
                {physicalTables.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                      {searchQuery ? "未找到匹配的物理表" : "暂无物理表数据，点击上方按钮创建"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Create/Edit Table Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingTable ? "编辑物理表" : "新建物理表"}
        width="max-w-2xl"
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">
                表名称 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="例如：用户维度表"
                required
                disabled={isSubmitting}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">
                表名编码 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="例如：dim_user"
                required
                disabled={isSubmitting || !!editingTable}
                pattern="^[a-z][a-z0-9_]*$"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">
              表类型 <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.table_type}
              onChange={(e) => setFormData({ ...formData, table_type: e.target.value as TableType })}
              disabled={isSubmitting || !!editingTable}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="dimension">维度表 (Dimension)</option>
              <option value="fact">事实表 (Fact)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">描述</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="描述该表的业务含义..."
              rows={2}
              disabled={isSubmitting}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="pt-6 flex justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={handleCloseModal}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm disabled:opacity-50 flex items-center"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingTable ? "保存修改" : "创建"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Field Management Modal */}
      <Modal
        isOpen={isFieldModalOpen}
        onClose={handleCloseFieldModal}
        title={`管理字段 - ${managingTable?.name || ""}`}
        width="max-w-4xl"
      >
        <div className="space-y-5">
          {/* Field list table */}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2 text-xs font-semibold text-slate-500">字段名</th>
                  <th className="px-4 py-2 text-xs font-semibold text-slate-500">类型</th>
                  <th className="px-4 py-2 text-xs font-semibold text-slate-500">角色</th>
                  <th className="px-4 py-2 text-xs font-semibold text-slate-500">维度引用</th>
                  <th className="px-4 py-2 text-xs font-semibold text-slate-500">Join Key</th>
                  <th className="px-4 py-2 text-xs font-semibold text-slate-500 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {fields.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                      暂无字段定义，请在下方添加
                    </td>
                  </tr>
                ) : (
                  fields.map((field) => (
                    <tr key={field.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2 font-medium">{field.name}</td>
                      <td className="px-4 py-2">
                        <span className="px-2 py-0.5 bg-slate-100 rounded text-xs">
                          {field.type}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`px-2 py-0.5 rounded text-xs ${
                            field.field_role === 'dimension_key'
                              ? 'bg-blue-50 text-blue-700'
                              : field.field_role === 'measure'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-slate-50 text-slate-700'
                          }`}
                        >
                          {FIELD_ROLE_LABELS[field.field_role]}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        {field.dimension_ref_id
                          ? dimensionTables.find((t) => t.id === field.dimension_ref_id)?.name || field.dimension_ref_id
                          : '-'}
                      </td>
                      <td className="px-4 py-2">
                        {field.is_join_key ? (
                          <span className="text-green-600 text-xs font-medium">Yes</span>
                        ) : (
                          <span className="text-slate-400 text-xs">-</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <button
                          onClick={() => handleEditField(field)}
                          className="p-1 text-slate-400 hover:text-blue-600"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteField(field.id)}
                          className="p-1 text-slate-400 hover:text-red-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Add/Edit field form */}
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
            <h4 className="text-sm font-medium text-slate-700 mb-3">
              {editingField ? '编辑字段' : '添加字段'}
            </h4>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-slate-600">
                  字段名 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={fieldForm.name}
                  onChange={(e) => setFieldForm({ ...fieldForm, name: e.target.value })}
                  placeholder="例如：user_id"
                  className="w-full px-3 py-2 border border-slate-300 rounded text-sm mt-1"
                />
              </div>
              <div>
                <label className="text-xs text-slate-600">字段类型</label>
                <select
                  value={fieldForm.type}
                  onChange={(e) => setFieldForm({ ...fieldForm, type: e.target.value as Field['type'] })}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-sm mt-1"
                >
                  {FIELD_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-600">字段角色</label>
                <select
                  value={fieldForm.field_role}
                  onChange={(e) => setFieldForm({ ...fieldForm, field_role: e.target.value as FieldRole })}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-sm mt-1"
                >
                  <option value="dimension_key">维度键</option>
                  <option value="measure">度量</option>
                  <option value="attribute">属性</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-600">维度引用 (雪花模型)</label>
                <select
                  value={fieldForm.dimension_ref_id}
                  onChange={(e) => setFieldForm({ ...fieldForm, dimension_ref_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-sm mt-1"
                >
                  <option value="">无</option>
                  {availableDimensionRefs.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.code})
                    </option>
                  ))}
                </select>
                {managingTable?.table_type === 'fact' && (
                  <p className="text-[10px] text-slate-400 mt-1">事实表字段通常不引用其他维度表</p>
                )}
              </div>
              <div>
                <label className="text-xs text-slate-600">描述</label>
                <input
                  type="text"
                  value={fieldForm.description}
                  onChange={(e) => setFieldForm({ ...fieldForm, description: e.target.value })}
                  placeholder="字段描述..."
                  className="w-full px-3 py-2 border border-slate-300 rounded text-sm mt-1"
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={fieldForm.is_join_key}
                    onChange={(e) => setFieldForm({ ...fieldForm, is_join_key: e.target.checked })}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-xs text-slate-600">是 Join Key</span>
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-3">
              {editingField && (
                <button
                  onClick={() => resetFieldForm()}
                  className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded"
                >
                  取消编辑
                </button>
              )}
              <button
                onClick={handleSaveField}
                disabled={!fieldForm.name.trim()}
                className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {editingField ? '更新' : '添加'}
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
