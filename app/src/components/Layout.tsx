import { useState, useRef, useEffect, createContext, useContext } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { useAuth } from "@/hooks/useAuth";
import { usePrivacyMode } from "@/hooks/usePrivacyMode";
import { useMockTrpc } from "@/mock/useMockData";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Users,
  ShoppingCart,
  DollarSign,
  BarChart3,
  Package,
  Menu,
  X,
  ChevronRight,
  LogOut,
  User,
  Bell,
  CheckCircle,
  AlertTriangle,
  Clock,
  Info,
  FileText,
  FileCode,
  TrendingUp,
  Eye,
  EyeOff,
} from "lucide-react";

// 保密模式 Context
export const PrivacyContext = createContext<{ privacyMode: boolean; toggle: () => void }>({
  privacyMode: false,
  toggle: () => {},
});

interface NotifyItem {
  id: number;
  title: string;
  desc: string;
  time: string;
  type: "warning" | "info" | "success";
  read: boolean;
  route: string;
}

const DEFAULT_NOTIFICATIONS: NotifyItem[] = [
  { id: 1, title: "订单 SO-2026-001 逾期提醒", desc: "客户：华为技术有限公司，已逾期 3 天", time: "2小时前", type: "warning", read: false, route: "/sales-orders" },
  { id: 2, title: "样品单 SP-2026-002 待出库", desc: "产品：工业通信模组，请安排发货", time: "5小时前", type: "info", read: false, route: "/sample-orders" },
  { id: 3, title: "回款提醒：小米科技 ¥50,000", desc: "账期到期日：2026-05-22", time: "1天前", type: "success", read: false, route: "/finance" },
];

const LS_NOTIFY_KEY = "sales-sys-notifications";

function loadNotifications(): NotifyItem[] {
  try {
    const raw = localStorage.getItem(LS_NOTIFY_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_NOTIFICATIONS;
  } catch {
    return DEFAULT_NOTIFICATIONS;
  }
}

function saveNotifications(list: NotifyItem[]) {
  localStorage.setItem(LS_NOTIFY_KEY, JSON.stringify(list));
}

const navItems = [
  { path: "/", label: "仪表盘", icon: LayoutDashboard },
  { path: "/customers", label: "客户管理", icon: Users },
  { path: "/quotation-records", label: "报价记录", icon: TrendingUp },
  { path: "/sales-orders", label: "销售订单", icon: ShoppingCart },
  { path: "/finance", label: "回款管理", icon: DollarSign },
  { path: "/reports", label: "报表中心", icon: BarChart3 },
  { path: "/products", label: "产品管理", icon: Package },
  { path: "/filename-generator", label: "文件命名", icon: FileCode },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [notifyList, setNotifyList] = useState(loadNotifications);
  const notifyRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifyRef.current && !notifyRef.current.contains(e.target as Node)) setNotifyOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    saveNotifications(notifyList);
  }, [notifyList]);

  const unreadCount = notifyList.filter(n => !n.read).length;

  const iconMap = {
    warning: <AlertTriangle size={14} className="text-amber-500" />,
    info: <Info size={14} className="text-blue-500" />,
    success: <CheckCircle size={14} className="text-emerald-500" />,
  };

  const trpc = useMockTrpc();
  const { data: globalRemindersData, refetch: refetchGlobalReminders } = trpc.reminder.list.useQuery({ global: true, overdueOnly: true });
  const overdueReminderCount = globalRemindersData?.items?.length ?? 0;

  useEffect(() => {
    const handler = () => { refetchGlobalReminders(); };
    window.addEventListener("mock-refresh", handler);
    return () => window.removeEventListener("mock-refresh", handler);
  }, [refetchGlobalReminders]);

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
            const showReminderBadge = item.path === "/sales-orders" && overdueReminderCount > 0;
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
                      {overdueReminderCount > 99 ? "99+" : overdueReminderCount}
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
          <div className="flex items-center gap-2">
            <div className="relative" ref={notifyRef}>
              <button
                className="relative p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                onClick={() => setNotifyOpen(!notifyOpen)}
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-[15px] h-[15px] bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>
              {notifyOpen && (
                <div className="absolute right-0 top-full mt-2 w-[320px] bg-white rounded-lg shadow-elevated border border-slate-200 z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <h4 className="text-[13px] font-semibold text-slate-700">通知</h4>
                    <div className="flex items-center gap-3">
                      {unreadCount > 0 && (
                        <button className="text-[11px] text-blue-600 hover:text-blue-700 font-medium" onClick={() => setNotifyList(nl => nl.map(n => ({ ...n, read: true })))}>
                          全部已读
                        </button>
                      )}
                      {notifyList.length > 0 && (
                        <button className="text-[11px] text-slate-400 hover:text-red-500" onClick={() => setNotifyList([])}>
                          清空
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    {notifyList.length === 0 && (
                      <div className="text-center py-8 text-slate-400 text-sm">暂无通知</div>
                    )}
                    {notifyList.map(n => (
                      <Link key={n.id} to={n.route}
                        className={`block px-4 py-3 border-b border-slate-50 last:border-b-0 hover:bg-slate-50 transition-colors ${n.read ? "opacity-50" : ""}`}
                        onClick={() => { setNotifyList(nl => nl.map(x => x.id === n.id ? { ...x, read: true } : x)); setNotifyOpen(false); }}>
                        <div className="flex items-start gap-2.5">
                          <div className="mt-0.5 flex-shrink-0">{iconMap[n.type]}</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-medium text-slate-700">{n.title}</p>
                            <p className="text-[11px] text-slate-400 mt-0.5">{n.desc}</p>
                            <p className="text-[11px] text-slate-300 mt-1 flex items-center gap-1"><Clock size={10} />{n.time}</p>
                          </div>
                          {!n.read && <div className="w-[6px] h-[6px] bg-blue-500 rounded-full flex-shrink-0 mt-2" />}
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
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
