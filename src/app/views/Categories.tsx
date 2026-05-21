import React, { useState, useEffect } from "react";
import { Plus, Search, Folder, FolderOpen, Edit3, Trash2, ChevronRight, ChevronDown, Loader2 } from "lucide-react";
import { Modal } from "../components/Modal";
import { useCategories } from "../../hooks/useCategories";
import type { Category } from "../../types";

interface CategoryNode extends Category {
  children: CategoryNode[];
}

export default function Categories() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  // 表单状态
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    description: "",
    parent_id: null as string | null,
    order: 0,
  });

  const { categoryTree, loading, error, fetchCategoryTree, createCategory, updateCategory, deleteCategory } = useCategories();

  // 重置表单
  const resetForm = () => {
    setFormData({ name: "", code: "", description: "", parent_id: null, order: 0 });
    setEditingCategory(null);
  };

  // 打开新建弹窗
  const handleOpenCreate = (parentId: string | null = null) => {
    resetForm();
    setFormData(prev => ({ ...prev, parent_id: parentId }));
    setIsModalOpen(true);
  };

  // 打开编辑弹窗
  const handleOpenEdit = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      code: category.code,
      description: category.description || "",
      parent_id: category.parent_id || null,
      order: category.order,
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
      if (editingCategory) {
        success = await updateCategory(editingCategory.id, {
          name: formData.name,
          code: formData.code,
          description: formData.description || undefined,
          parent_id: formData.parent_id,
          order: formData.order,
        });
      } else {
        success = await createCategory({
          name: formData.name,
          code: formData.code,
          description: formData.description || undefined,
          parent_id: formData.parent_id,
          order: formData.order,
        });
      }

      if (success) {
        handleCloseModal();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // 删除分类
  const handleDelete = async (id: string) => {
    if (!confirm("确定要删除这个分类吗？有子分类的分类无法删除。")) return;

    setIsDeleting(id);
    try {
      await deleteCategory(id);
    } finally {
      setIsDeleting(null);
    }
  };

  // 切换节点展开状态
  const toggleNode = (id: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // 搜索防抖
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCategoryTree();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // 初始加载
  useEffect(() => {
    fetchCategoryTree();
  }, []);

  // 渲染树形节点
  const renderTreeNode = (node: CategoryNode, level: number = 0) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedNodes.has(node.id);

    return (
      <div key={node.id} className="select-none">
        <div
          className="flex items-center py-2 px-4 hover:bg-slate-50 transition-colors group"
          style={{ paddingLeft: `${level * 24 + 16}px` }}
        >
          <button
            onClick={() => hasChildren && toggleNode(node.id)}
            className={`w-5 h-5 flex items-center justify-center mr-2 rounded hover:bg-slate-200 transition-colors ${
              hasChildren ? "cursor-pointer" : "cursor-default opacity-0"
            }`}
          >
            {hasChildren && (
              isExpanded ? (
                <ChevronDown className="w-4 h-4 text-slate-500" />
              ) : (
                <ChevronRight className="w-4 h-4 text-slate-500" />
              )
            )}
          </button>

          {isExpanded ? (
            <FolderOpen className="w-5 h-5 text-yellow-500 mr-3" />
          ) : (
            <Folder className="w-5 h-5 text-yellow-500 mr-3" />
          )}

          <div className="flex-1">
            <div className="font-medium text-slate-900">{node.name}</div>
            <div className="text-xs text-slate-500 font-mono">{node.code}</div>
          </div>

          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => handleOpenCreate(node.id)}
              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
              title="添加子分类"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleOpenEdit(node)}
              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
              title="编辑"
            >
              <Edit3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleDelete(node.id)}
              disabled={isDeleting === node.id || hasChildren}
              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-30"
              title={hasChildren ? "请先删除子分类" : "删除"}
            >
              {isDeleting === node.id ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div>
            {node.children.map(child => renderTreeNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  // 过滤树形节点
  const filterTree = (nodes: CategoryNode[]): CategoryNode[] => {
    if (!searchQuery) return nodes;

    const query = searchQuery.toLowerCase();
    return nodes.filter(node => {
      const matches = node.name.toLowerCase().includes(query) ||
                     node.code.toLowerCase().includes(query);
      const hasMatchingChildren = node.children && filterTree(node.children).length > 0;
      return matches || hasMatchingChildren;
    }).map(node => ({
      ...node,
      children: filterTree(node.children || [])
    }));
  };

  const filteredTree = filterTree(categoryTree);

  return (
    <div className="max-w-6xl mx-auto h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">指标分类管理</h1>
          <p className="text-slate-500 mt-1">组织和管理指标的多级分类体系。</p>
        </div>
        <button
          onClick={() => handleOpenCreate()}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium text-sm shadow-sm"
        >
          <Plus className="w-4 h-4 mr-2" />
          新建分类
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col flex-1 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="搜索分类名称或编码..."
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
                onClick={() => fetchCategoryTree()}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                重试
              </button>
            </div>
          ) : filteredTree.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-500">
              <Folder className="w-12 h-12 text-slate-300 mb-4" />
              <p>{searchQuery ? "未找到匹配的分类" : "暂无分类数据，点击右上角新建"}</p>
            </div>
          ) : (
            <div className="py-2">
              {filteredTree.map(node => renderTreeNode(node))}
            </div>
          )}
        </div>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingCategory ? "编辑分类" : "新建分类"}
        width="max-w-md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">
              分类名称 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="例如：销售指标"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              required
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">
              分类编码 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              placeholder="例如：sales_metrics"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              required
              disabled={isSubmitting || !!editingCategory}
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
              placeholder="描述该分类的用途..."
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">排序序号</label>
            <input
              type="number"
              value={formData.order}
              onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })}
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
              {editingCategory ? "保存修改" : "创建"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
