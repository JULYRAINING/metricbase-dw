import React, { useState } from "react";
import { Plus, Search, FileSpreadsheet, Edit3, Trash2, Database } from "lucide-react";
import { Modal } from "../components/Modal";

export default function FactTables() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tables, setTables] = useState([
    { 
      id: "ft_1", 
      name: "交易订单事实表", 
      code: "dwd_trade_order", 
      desc: "存储用户下单支付相关明细数据", 
      dims: ["时间维度", "商品维度", "用户维度", "门店维度"],
      measures: ["订单金额", "折扣金额", "支付金额", "运费"],
      created: "2023-10-05" 
    },
    { 
      id: "ft_2", 
      name: "页面流量事实表", 
      code: "dwd_traffic_page", 
      desc: "存储用户APP/Web端页面浏览日志", 
      dims: ["时间维度", "用户维度", "渠道维度"],
      measures: ["停留时长", "页面浏览量(PV)"],
      created: "2023-10-06" 
    },
    { 
      id: "ft_3", 
      name: "退款交易事实表", 
      code: "dwd_trade_refund", 
      desc: "存储售后退款相关明细", 
      dims: ["时间维度", "商品维度", "门店维度"],
      measures: ["退款金额", "退款件数"],
      created: "2023-10-07" 
    },
  ]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsModalOpen(false);
    // In a real app, we would save the form data here
  };

  return (
    <div className="max-w-6xl mx-auto h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">事实表管理 (DWD)</h1>
          <p className="text-slate-500 mt-1">定义业务事实表，关联相关维度，并定义可用于派生原子指标的度量字段。</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium text-sm shadow-sm hover:shadow"
        >
          <Plus className="w-4 h-4 mr-2" />
          新建事实表
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col flex-1 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex gap-4 bg-slate-50/50">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input 
              type="text" 
              placeholder="搜索事实表名称或编码..." 
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto">
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
              {tables.map((table) => (
                <tr key={table.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className="w-8 h-8 rounded bg-indigo-50 flex items-center justify-center mr-3 text-indigo-600">
                        <FileSpreadsheet className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-medium text-slate-900">{table.name}</div>
                        <div className="text-xs text-slate-500 mt-0.5 truncate max-w-[200px]">{table.desc}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2 py-1 rounded bg-slate-100 text-slate-700 font-mono text-xs border border-slate-200">
                      {table.code}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1.5">
                      {table.dims.map(dim => (
                        <span key={dim} className="text-[11px] px-2 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-100">
                          {dim}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1.5">
                      {table.measures.map(m => (
                        <span key={m} className="text-[11px] px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded border border-emerald-100">
                          {m}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors mr-1 opacity-0 group-hover:opacity-100">
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button className="p-1.5 text-slate-400 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="新建事实表" width="max-w-2xl">
        <form onSubmit={handleSave} className="space-y-5">
          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">事实表名称 <span className="text-red-500">*</span></label>
              <input type="text" placeholder="例如：交易订单事实表" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" required />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">表名编码 <span className="text-red-500">*</span></label>
              <input type="text" placeholder="例如：dwd_trade_order" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" required />
            </div>
          </div>
          
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">描述</label>
            <textarea placeholder="描述该事实表的业务含义..." rows={2} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"></textarea>
          </div>

          <div className="pt-4 border-t border-slate-100 grid grid-cols-2 gap-8">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-800 flex items-center">
                  <Database className="w-4 h-4 mr-1.5 text-blue-500" />
                  关联维度
                </label>
                <button type="button" className="text-xs text-blue-600 hover:text-blue-700 font-medium">+ 添加</button>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                {["时间维度 (dim_date)", "用户维度 (dim_user)", "商品维度 (dim_product)"].map((dim, i) => (
                   <div key={i} className="flex items-center justify-between text-sm bg-white p-2 rounded border border-slate-100 shadow-sm">
                     <span className="text-slate-600">{dim}</span>
                     <Trash2 className="w-3.5 h-3.5 text-slate-300 hover:text-red-500 cursor-pointer transition-colors" />
                   </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-800 flex items-center">
                  <FileSpreadsheet className="w-4 h-4 mr-1.5 text-emerald-500" />
                  定义度量
                </label>
                <button type="button" className="text-xs text-blue-600 hover:text-blue-700 font-medium">+ 添加</button>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                {["订单金额 (order_amount)", "支付金额 (pay_amount)"].map((measure, i) => (
                   <div key={i} className="flex items-center justify-between text-sm bg-white p-2 rounded border border-slate-100 shadow-sm">
                     <span className="text-slate-600">{measure}</span>
                     <Trash2 className="w-3.5 h-3.5 text-slate-300 hover:text-red-500 cursor-pointer transition-colors" />
                   </div>
                ))}
              </div>
            </div>
          </div>

          <div className="pt-6 flex justify-end gap-3 border-t border-slate-100">
            <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
              取消
            </button>
            <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
              保存配置
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
