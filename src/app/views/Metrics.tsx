import React, { useState } from "react";
import { Plus, Search, GitMerge, Calculator, Copy, Tag } from "lucide-react";
import { Modal } from "../components/Modal";

type MetricType = 'atomic' | 'derived' | 'composite';

export default function Metrics() {
  const [activeTab, setActiveTab] = useState<MetricType>('atomic');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Mock data representing inherited dimensions
  const metricsData = {
    atomic: [
      { id: "am_1", name: "支付订单金额", source: "dwd_trade_order", measure: "pay_amount", agg: "SUM", dims: ["时间维度", "商品维度", "用户维度", "门店维度"] },
      { id: "am_2", name: "访问页面次数", source: "dwd_traffic_page", measure: "page_view", agg: "COUNT", dims: ["时间维度", "用户维度"] },
      { id: "am_3", name: "退款金额", source: "dwd_trade_refund", measure: "refund_amount", agg: "SUM", dims: ["时间维度", "商品维度", "门店维度"] }
    ],
    derived: [
      { id: "dm_1", name: "APP端支付订单金额", base: "支付订单金额", condition: "渠道 = 'APP'", dims: ["时间维度", "商品维度", "用户维度", "门店维度"] },
      { id: "dm_2", name: "近7日访问页面次数", base: "访问页面次数", condition: "日期 >= 当天-7", dims: ["时间维度", "用户维度"] }
    ],
    composite: [
      { id: "cm_1", name: "订单退款率", formula: "退款金额 / 支付订单金额", base: ["退款金额", "支付订单金额"], dims: ["时间维度", "商品维度", "门店维度"] /* Intersection of the two */ },
      { id: "cm_2", name: "客单价", formula: "支付订单金额 / 支付用户数", base: ["支付订单金额", "支付用户数"], dims: ["时间维度", "用户维度"] }
    ]
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsModalOpen(false);
  };

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
              placeholder={`搜索${activeTab === 'atomic' ? '原子' : activeTab === 'derived' ? '衍生' : '复合'}指标...`} 
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-white">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-6 py-3 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">指标名称</th>
                
                {activeTab === 'atomic' && (
                  <>
                    <th className="px-6 py-3 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">来源DWD表</th>
                    <th className="px-6 py-3 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">度量/聚合方式</th>
                  </>
                )}
                {activeTab === 'derived' && (
                  <>
                    <th className="px-6 py-3 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">来源原子指标</th>
                    <th className="px-6 py-3 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">业务限定条件</th>
                  </>
                )}
                {activeTab === 'composite' && (
                  <>
                    <th className="px-6 py-3 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">计算公式</th>
                    <th className="px-6 py-3 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">依赖基础指标</th>
                  </>
                )}
                
                <th className="px-6 py-3 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider w-1/3">继承的可分析维度</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {metricsData[activeTab].map((metric: any) => (
                <tr key={metric.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-900">{metric.name}</td>
                  
                  {activeTab === 'atomic' && (
                    <>
                      <td className="px-6 py-4 text-sm text-slate-600 font-mono bg-slate-50/50">{metric.source}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        <span className="font-semibold text-blue-600">{metric.agg}</span>({metric.measure})
                      </td>
                    </>
                  )}
                  {activeTab === 'derived' && (
                    <>
                      <td className="px-6 py-4 text-sm text-slate-600">
                         <div className="inline-flex items-center px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs border border-blue-100">
                           {metric.base}
                         </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 font-mono bg-yellow-50/50 border-l border-r border-yellow-100/50">{metric.condition}</td>
                    </>
                  )}
                  {activeTab === 'composite' && (
                    <>
                      <td className="px-6 py-4 text-sm font-mono text-purple-700 bg-purple-50/50">{metric.formula}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        <div className="flex gap-1 flex-wrap">
                          {metric.base.map((b: string) => (
                             <span key={b} className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs border border-slate-200">{b}</span>
                          ))}
                        </div>
                      </td>
                    </>
                  )}

                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1.5">
                      {metric.dims.map((dim: string) => (
                        <span key={dim} className="inline-flex items-center px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs">
                          <Tag className="w-3 h-3 mr-1 text-slate-400" />
                          {dim}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={`新建${activeTab === 'atomic' ? '原子' : activeTab === 'derived' ? '衍生' : '复合'}指标`} width="max-w-xl">
        <form onSubmit={handleSave} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">指标名称 <span className="text-red-500">*</span></label>
            <input type="text" placeholder="例如：支付订单金额" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" required />
          </div>

          {activeTab === 'atomic' && (
            <>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">来源DWD事实表 <span className="text-red-500">*</span></label>
                <select className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" required>
                  <option value="">请选择事实表...</option>
                  <option value="dwd_trade_order">dwd_trade_order (交易订单事实表)</option>
                  <option value="dwd_traffic_page">dwd_traffic_page (页面流量事实表)</option>
                </select>
                <p className="text-xs text-slate-500 mt-1">系统将自动继承该事实表所关联的所有维度。</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">度量字段 <span className="text-red-500">*</span></label>
                  <select className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" required>
                    <option value="">请选择...</option>
                    <option value="pay_amount">pay_amount (支付金额)</option>
                    <option value="order_amount">order_amount (订单金额)</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">聚合方式 <span className="text-red-500">*</span></label>
                  <select className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" required>
                    <option value="SUM">求和 (SUM)</option>
                    <option value="COUNT">计数 (COUNT)</option>
                    <option value="COUNT_DISTINCT">去重计数 (COUNT DISTINCT)</option>
                    <option value="MAX">最大值 (MAX)</option>
                    <option value="MIN">最小值 (MIN)</option>
                  </select>
                </div>
              </div>
            </>
          )}

          {activeTab === 'derived' && (
            <>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">来源原子指标 <span className="text-red-500">*</span></label>
                <select className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" required>
                  <option value="">请选择原子指标...</option>
                  <option value="am_1">支付订单金额</option>
                  <option value="am_2">访问页面次数</option>
                </select>
                <p className="text-xs text-slate-500 mt-1">系统将自动继承所选原子指标的维度作为可分析维度。</p>
              </div>
              
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">业务限定条件 (Where 过滤) <span className="text-red-500">*</span></label>
                <textarea 
                  placeholder="例如：渠道 = 'APP' AND 订单状态 = '已支付'" 
                  rows={3} 
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" 
                  required 
                />
              </div>
            </>
          )}

          {activeTab === 'composite' && (
            <>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">依赖基础指标 <span className="text-red-500">*</span></label>
                <div className="p-3 border border-slate-300 rounded-lg bg-slate-50">
                  <div className="text-xs text-slate-500 mb-2">勾选参与计算的指标（支持原子或衍生指标）：</div>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    <label className="flex items-center space-x-2 bg-white p-2 rounded border border-slate-100 shadow-sm cursor-pointer">
                      <input type="checkbox" className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                      <span className="text-sm text-slate-700">退款金额</span>
                    </label>
                    <label className="flex items-center space-x-2 bg-white p-2 rounded border border-slate-100 shadow-sm cursor-pointer">
                      <input type="checkbox" className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                      <span className="text-sm text-slate-700">支付订单金额</span>
                    </label>
                    <label className="flex items-center space-x-2 bg-white p-2 rounded border border-slate-100 shadow-sm cursor-pointer">
                      <input type="checkbox" className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                      <span className="text-sm text-slate-700">支付用户数</span>
                    </label>
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-1">系统将自动推断所选指标的<strong className="text-blue-600">维度交集</strong>作为本复合指标的可分析维度。</p>
              </div>
              
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">计算公式 <span className="text-red-500">*</span></label>
                <textarea 
                  placeholder="例如：[退款金额] / [支付订单金额]" 
                  rows={2} 
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" 
                  required 
                />
              </div>
            </>
          )}

          <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 mt-6">
            <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
              取消
            </button>
            <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
              保存并校验维度
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
