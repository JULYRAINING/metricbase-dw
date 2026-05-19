import React, { useState } from "react";
import { Plus, Search, Table, Edit3, Trash2 } from "lucide-react";
import { Modal } from "../components/Modal";

export default function Dimensions() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [dimensions, setDimensions] = useState([
    { id: "dim_user", name: "用户维度", code: "dim_user_info", desc: "注册用户基本信息", created: "2023-10-01" },
    { id: "dim_product", name: "商品维度", code: "dim_product_sku", desc: "商品SKU属性信息", created: "2023-10-02" },
    { id: "dim_store", name: "门店维度", code: "dim_store_info", desc: "线下门店基本信息", created: "2023-10-03" },
    { id: "dim_date", name: "时间维度", code: "dim_date", desc: "全局通用时间维表", created: "2023-10-01" },
  ]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsModalOpen(false);
  };

  return (
    <div className="max-w-6xl mx-auto h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">维度管理 (DWD)</h1>
          <p className="text-slate-500 mt-1">全局维度的统一定义和配置管理，作为后续指标继承的基础。</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
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
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto">
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
                  <td className="px-6 py-4 text-sm text-slate-500">{dim.desc}</td>
                  <td className="px-6 py-4 text-sm text-slate-500">{dim.created}</td>
                  <td className="px-6 py-4 text-right">
                    <button className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors mr-2">
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button className="p-1.5 text-slate-400 hover:text-red-600 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {dimensions.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    暂无数据
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="新建维度" width="max-w-md">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">维度名称 <span className="text-red-500">*</span></label>
            <input type="text" placeholder="例如：用户维度" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" required />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">维度编码 (DWD表名) <span className="text-red-500">*</span></label>
            <input type="text" placeholder="例如：dim_user_info" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" required />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">描述</label>
            <textarea placeholder="描述该维度的业务含义..." rows={3} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"></textarea>
          </div>
          <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 mt-6">
            <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
              取消
            </button>
            <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
              保存
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
