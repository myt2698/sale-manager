import { useState, useEffect, createContext } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { useAuth } from "@/hooks/useAuth";
import { usePrivacyMode } from "@/hooks/usePrivacyMode";
import { useMockTrpc } from "@/mock/useMockData";
import {
  LayoutDashboard,
  Users,
  ShoppingCart,
  BarChart3,
  Package,
  Menu,
  X,
  LogOut,
  User,
  FileText,
  FileCode,
  TrendingUp,
  Eye,
  EyeOff,
  DatabaseBackup,
} from "lucide-react";

// 保密模式 Context
export const PrivacyContext = createContext<{ privacyMode: boolean; toggle: () => void }>({
  privacyMode: false,
  toggle: () => {},
});

const navItems = [
  { path: "/", label: "仪表盘", icon: LayoutDashboard },
  { path: "/customers", label: "客户管理", icon: Users },
  { path: "/quotation-records", label: "报价记录", icon: TrendingUp },
  { path: "/sales-orders", label: "销售订单", icon: ShoppingCart },
  { path: "/sample-orders", label: "样品订单", icon: Package },
  { path: "/reports", label: "销售报表中心", icon: BarChart3 },
  { path: "/sample-reports", label: "样品报表中心", icon: FileText },
  { path: "/products", label: "产品管理", icon: Package },
  { path: "/filename-generator", label: "文件命名", icon: FileCode },
  { path: "/data-management", label: "数据与备份", icon: DatabaseBackup },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, isAuthenticated } = useAuth();
  const { privacyMode, toggle: togglePrivacy } = usePrivacyMode();

  // 未登录时重定向到登录页
  useEffect(() => {
    if (!isAuthenticated && location.pathname !== "/login") {
      navigate("/login");
    }
  }, [isAuthenticated, location.pathname, navigate]);

  const trpc = useMockTrpc();
  const { data: globalRemindersData, refetch: refetchGlobalReminders } = trpc.reminder.list.useQuery({ global: true, overdueOnly: true });
  const { data: globalSampleRemindersData, refetch: refetchGlobalSampleReminders } = trpc.sampleReminder.list.useQuery({ global: true, overdueOnly: true });
  const overdueReminderCount = globalRemindersData?.items?.length ?? 0;
  const overdueSampleReminderCount = globalSampleRemindersData?.items?.length ?? 0;

  useEffect(() => {
    const handler = () => { refetchGlobalReminders(); refetchGlobalSampleReminders(); };
    window.addEventListener("mock-refresh", handler);
    return () => window.removeEventListener("mock-refresh", handler);
  }, [refetchGlobalReminders, refetchGlobalSampleReminders]);

  return (
    <PrivacyContext.Provider value={{ privacyMode, toggle: togglePrivacy }}>
    <div className="flex h-screen bg-[#f1f5f9]">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? "w-[240px]" : "w-[64px]"
        } bg-white border-r border-slate-200 flex flex-col z-20 transition-all duration-300 shrink-0`}
      >
        {/* Logo */}
        <div className="h-[56px] flex items-center justify-between px-4 border-b border-slate-100">
          {sidebarOpen && (
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-md bg-blue-600 flex items-center justify-center">
                <BarChart3 size={16} className="text-white" />
              </div>
              <h1 className="text-sm font-bold text-slate-800 tracking-wide">
                销售管理系统
              </h1>
            </div>
          )}
          {!sidebarOpen && (
            <div className="w-8 h-8 rounded-md bg-blue-600 flex items-center justify-center mx-auto">
              <BarChart3 size={16} className="text-white" />
            </div>
          )}
          {sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Nav Items */}
        <nav className="flex-1 py-3 px-2 space-y-0.5">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path === "/quotation-records" && location.pathname === "/quotation-rules");
            const Icon = item.icon;
            const itemReminderCount = item.path === "/sales-orders"
              ? overdueReminderCount
              : item.path === "/sample-orders"
                ? overdueSampleReminderCount
                : 0;
            const showReminderBadge = itemReminderCount > 0;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2 rounded-md transition-all duration-200 group ${
                  isActive
                    ? "bg-blue-50 text-blue-700"
                    : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                }`}
                title={!sidebarOpen ? item.label : undefined}
              >
                <div className="relative shrink-0">
                  <Icon size={18} strokeWidth={isActive ? 2 : 1.5} />
                  {showReminderBadge && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[15px] h-[15px] px-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                      {itemReminderCount > 99 ? "99+" : itemReminderCount}
                    </span>
                  )}
                </div>
                {sidebarOpen && (
                  <span className={`text-[13px] ${isActive ? "font-semibold" : "font-medium"}`}>
                    {item.label}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User Profile */}
        <div className="border-t border-slate-100 p-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
              <User size={15} className="text-slate-500" />
            </div>
            {sidebarOpen && (
              <>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-slate-700 truncate">
                    {user?.name ?? "用户"}
                  </p>
                  <p className="text-[11px] text-slate-400 truncate">
                    {user?.email ?? ""}
                  </p>
                </div>
                <button
                  onClick={togglePrivacy}
                  className={`p-1.5 transition-colors rounded-md hover:bg-slate-50 ${privacyMode ? "text-amber-500 hover:text-amber-600" : "text-slate-400 hover:text-slate-600"}`}
                  title={privacyMode ? "保密模式已开启" : "保密模式"}
                >
                  {privacyMode ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
                <button
                  onClick={logout}
                  className="p-1.5 text-slate-400 hover:text-red-500 transition-colors rounded-md hover:bg-slate-50"
                  title="退出登录"
                >
                  <LogOut size={15} />
                </button>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top Bar */}
        <header className="h-[56px] bg-white border-b border-slate-200 flex items-center justify-between px-5 shrink-0">
          <div className="flex items-center gap-3">
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-1.5 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <Menu size={18} />
              </button>
            )}
            <h2 className="text-[15px] font-semibold text-slate-800">
              {navItems.find((n) => n.path === location.pathname)?.label ?? "页面"}
            </h2>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-5">
          {children}
        </main>
      </div>
    </div>
    </PrivacyContext.Provider>
  );
}
