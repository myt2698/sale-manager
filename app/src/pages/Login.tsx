import { useNavigate } from "react-router";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Shield, User, CreditCard, TrendingUp } from "lucide-react";

const roleConfig: Record<string, { icon: React.ReactNode; color: string; desc: string }> = {
  admin: { icon: <Shield size={18} />, color: "bg-blue-500", desc: "全部权限" },
  sales: { icon: <TrendingUp size={18} />, color: "bg-emerald-500", desc: "销售相关" },
  finance: { icon: <CreditCard size={18} />, color: "bg-amber-500", desc: "回款相关" },
};

export default function Login() {
  const { users, login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = (userId: number) => {
    login(userId);
    navigate("/");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="w-full max-w-sm px-4">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center mx-auto mb-4 shadow-lg">
            <User size={28} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-slate-800">销售管理系统</h1>
          <p className="text-sm text-slate-400 mt-1">请选择用户登录</p>
        </div>

        <div className="space-y-3">
          {users.map((u) => {
            const cfg = roleConfig[u.role];
            return (
              <button
                key={u.id}
                onClick={() => handleLogin(u.id)}
                className="w-full flex items-center gap-4 p-4 rounded-xl bg-white border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all text-left group"
              >
                <div className={`w-10 h-10 rounded-full ${cfg.color} flex items-center justify-center text-white shrink-0 group-hover:scale-105 transition-transform`}>
                  {cfg.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-700 group-hover:text-blue-600 transition-colors">
                    {u.name}
                  </p>
                  <p className="text-xs text-slate-400">{u.email}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                    {cfg.desc}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        <p className="text-center text-[11px] text-slate-300 mt-8">
          点击用户卡片即可切换登录，无需密码
        </p>
      </div>
    </div>
  );
}
