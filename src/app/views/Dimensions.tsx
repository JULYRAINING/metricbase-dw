import React, { useState, useEffect } from "react";
import { Plus, Search, Table, Edit3, Trash2, Loader2 } from "lucide-react";
import { Modal } from "../components/Modal";
import { useDimensions } from "../../hooks/useDimensions";
import type { Dimension } from "../../types";

export default function Dimensions() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDimension, setEditingDimension] = useState<Dimension | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  // 表单状态
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    description: "",
  });

  const { dimensions, loading, error, refetch, create, update, remove } = useDimensions(searchQuery);

  // 重置表单
  const resetForm = () => {
    setFormData({ name: "", code: "", description: "" });
    setEditingDimension(null);
  };

  // 打开新建弹窗
  const handleOpenCreate = () => {
    resetForm();
    setIsModalOpen(true);
  };

  // 打开编辑弹窗
  const handleOpenEdit = (dimension: Dimension) => {
    setEditingDimension(dimension);
    setFormData({
      name: dimension.name,
      code: dimension.code,
      description: dimension.description || "",
    });
    setIsModalOpen(true);
  };

  // 关闭弹窗
  const handleCloseModal = () => {
    if (isSubmitting) return;
    setIsModalOpen(false);
    resetForm();
  };

  // 提交表单
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);

    try {
      let success;
      if (editingDimension) {
        success = await update(editingDimension.id, {
          name: formData.name,
          code: formData.code,
          description: formData.description || undefined,
        });
      } else {
        success = await create({
          name: formData.name,
          code: formData.code,
          description: formData.description || undefined,
        });
      }

      if (success) {
        handleCloseModal();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // 删除维度
  const handleDelete = async (id: string) => {
    if (!confirm("确定要删除这个维度吗？此操作不可恢复。")) return;

    setIsDeleting(id);
    try {
      await remove(id);
    } finally {
      setIsDeleting(null);
    }
  };

  // 搜索防抖
  useEffect(() => {
    const timer = setTimeout(() => {
      refetch();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  return (
    <div className="max-w-6xl mx-auto h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">维度管理 (DWD)</h1>
          <p className="text-slate-500 mt-1">全局维度的统一定义和配置管理，作为后续指标继承的基础。</p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium text-sm shadow-sm"
        >
          <Plus className="w-4 h-4 mr-2" />
          新建维度
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col flex-1 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="搜索维度名称或编码..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

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
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                重试
              </button>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-3 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">维度名称</th>
                  <th className="px-6 py-3 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">维度编码 (DWD表)</th>
                  <th className="px-6 py-3 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">描述</th>
                  <th className="px-6 py-3 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">创建时间</th>
                  <th className="px-6 py-3 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dimensions.map((dim) => (
                  <tr key={dim.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <Table className="w-4 h-4 text-blue-500 mr-2" />
                        <span className="font-medium text-slate-900">{dim.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 font-mono">{dim.code}</td>
                    <td className="px-6 py-4 text-sm text-slate-500">{dim.description || "-"}</td>
                    <td className="px-6 py-4 text-sm text-slate-500">
                      {new Date(dim.created_at).toLocaleDateString('zh-CN')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleOpenEdit(dim)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors mr-2"
                        title="编辑"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(dim.id)}
                        disabled={isDeleting === dim.id}
                        className="p-1.5 text-slate-400 hover:text-red-600 transition-colors disabled:opacity-50"
                        title="删除"
                      >
                        {isDeleting === dim.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
                {dimensions.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                      {searchQuery ? "未找到匹配的维度" : "暂无维度数据，点击右上角新建"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingDimension ? "编辑维度" : "新建维度"}
        width="max-w-md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">
              维度名称 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="例如：用户维度"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              required
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">
              维度编码 (DWD表名) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              placeholder="例如：dim_user_info"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              required
              disabled={isSubmitting || !!editingDimension}
              pattern="^[a-z][a-z0-9_]*$"
              title="小写字母开头，只能包含小写字母、数字和下划线"
            />
            <p className="text-xs text-slate-500">小写字母开头，只能包含小写字母、数字和下划线</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">描述</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="描述该维度的业务含义..."
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              disabled={isSubmitting}
            />
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 mt-6">
            <button
              type="button"
              onClick={handleCloseModal}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              disabled={isSubmitting}
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 flex items-center"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingDimension ? "保存修改" : "保存"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
