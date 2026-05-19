import React from "react";
import { Outlet, NavLink } from "react-router";
import {
  LayoutDashboard,
  Database,
  Calculator,
  Workflow,
  Settings,
  Bell,
  Search,
  FileSpreadsheet
} from "lucide-react";

export function Layout() {
  const navItems = [
    { name: "系统概览", path: "/", icon: LayoutDashboard },
    { name: "维度管理 (DWD)", path: "/dimensions", icon: Database },
    { name: "事实表管理 (DWD)", path: "/fact-tables", icon: FileSpreadsheet },
    { name: "指标管理", path: "/metrics", icon: Calculator },
    { name: "模型构建器", path: "/model-builder", icon: Workflow },
  ];

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col transition-all duration-300">
        <div className="h-16 flex items-center px-6 border-b border-slate-800">
          <div className="flex items-center gap-2 text-white font-bold text-lg tracking-wide">
            <Database className="text-blue-500 w-6 h-6" />
            <span>MetricBase DW</span>
          </div>
        </div>

        <nav className="flex-1 py-6 px-3 space-y-1">
          <div className="px-3 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            平台模块
          </div>
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-blue-600 text-white"
                    : "hover:bg-slate-800 hover:text-white"
                }`
              }
            >
              <item.icon className="w-5 h-5 mr-3 flex-shrink-0" />
              {item.name}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <button className="flex items-center w-full px-3 py-2 text-sm font-medium rounded-lg hover:bg-slate-800 hover:text-white transition-colors">
            <Settings className="w-5 h-5 mr-3" />
            系统设置
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 z-10">
          <div className="flex items-center text-slate-500 w-96">
            <Search className="w-5 h-5 mr-2" />
            <input
              type="text"
              placeholder="搜索指标、维度或模型..."
              className="bg-transparent border-none focus:outline-none w-full text-sm"
            />
          </div>
          <div className="flex items-center space-x-4">
            <button className="relative p-2 text-slate-400 hover:text-slate-600 transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold border border-blue-200">
              A
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-8 relative">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
