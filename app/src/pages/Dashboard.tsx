import { useMockTrpc } from "@/mock/useMockData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router";
import {
  ShoppingCart,
  Users,
  DollarSign,
  AlertTriangle,
  TrendingUp,
  CheckCircle,
  Package,
  FileText,
  RotateCcw,
  BarChart3,
  Wallet,
  Clock,
  ArrowRight,
} from "lucide-react";

const statusColors: Record<string, string> = {
  "进行中": "bg-blue-100 text-blue-700",
  "待签收": "bg-orange-100 text-orange-700",
  "待对账": "bg-purple-100 text-purple-700",
  "待开票": "bg-indigo-100 text-indigo-700",
  "待付款": "bg-red-100 text-red-700",
  "已完成": "bg-green-100 text-green-700",
  "退货中": "bg-amber-100 text-amber-700",
};

export default function Dashboard() {
  const trpc = useMockTrpc();
  const { data: stats } = trpc.dashboard.stats.useQuery();
  const { data: aging } = trpc.dashboard.arAging.useQuery();
  const { data: overdueOrders } = trpc.dashboard.overdueOrders.useQuery();

  // 顶部4个核心指标
  const kpiCards = [
    {
      label: "订单总数",
      value: stats?.orders.total ?? 0,
      unit: "笔",
      icon: ShoppingCart,
      iconBg: "bg-blue-100",
      iconColor: "text-blue-600",
      trend: `应收 ¥${(Number(stats?.orders.totalAmount ?? 0) / 10000).toFixed(1)}万`,
    },
    {
      label: "进行中",
      value: stats?.orders.inProgress ?? 0,
      unit: "笔",
      icon: Package,
      iconBg: "bg-amber-100",
      iconColor: "text-amber-600",
      trend: `待签收 ${stats?.orders.pendingReceipt ?? 0} · 待对账 ${stats?.orders.pendingReconciliation ?? 0}`,
    },
    {
      label: "客户总数",
      value: stats?.customers.total ?? 0,
      unit: "家",
      icon: Users,
      iconBg: "bg-green-100",
      iconColor: "text-green-600",
      trend: `活跃 ${stats?.customers.active ?? 0} · 潜在 ${stats?.customers.potential ?? 0}`,
    },
    {
      label: "本月回款",
      value: `¥${(Number(stats?.payments.monthTotal ?? 0) / 10000).toFixed(1)}`,
      unit: "万",
      icon: DollarSign,
      iconBg: "bg-emerald-100",
      iconColor: "text-emerald-600",
      trend: `${stats?.payments.monthCount ?? 0} 笔回款`,
    },
  ];

  // 账龄分析数据
  const agingData = [
    { label: "未逾期", count: aging?.current.count ?? 0, amount: aging?.current.amount ?? 0, color: "text-green-600", bar: "bg-green-500", bg: "bg-green-50" },
    { label: "1-30天", count: aging?.d30.count ?? 0, amount: aging?.d30.amount ?? 0, color: "text-yellow-600", bar: "bg-yellow-500", bg: "bg-yellow-50" },
    { label: "31-60天", count: aging?.d60.count ?? 0, amount: aging?.d60.amount ?? 0, color: "text-orange-600", bar: "bg-orange-500", bg: "bg-orange-50" },
    { label: "61-90天", count: aging?.d90.count ?? 0, amount: aging?.d90.amount ?? 0, color: "text-red-600", bar: "bg-red-500", bg: "bg-red-50" },
    { label: "90天以上", count: aging?.over90.count ?? 0, amount: aging?.over90.amount ?? 0, color: "text-red-800", bar: "bg-red-700", bg: "bg-red-100" },
  ];

  const totalAgingAmount = agingData.reduce((s, i) => s + i.amount, 0);

  // 逾期金额
  const overdueAmount = (overdueOrders ?? []).reduce(
    (sum: number, o: any) => sum + Math.max(0, Number(o.totalAmount) - Number(o.receivedAmount)),
    0
  );

  return (
    <div className="space-y-5">
      {/* ===== 核心指标卡片 ===== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.label} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-xs text-gray-400">{kpi.label}</p>
                    <p className="text-xl font-bold text-gray-900">{kpi.value}<span className="text-xs font-normal text-gray-400 ml-0.5">{kpi.unit}</span></p>
                    <p className="text-xs text-gray-500">{kpi.trend}</p>
                  </div>
                  <div className={`w-9 h-9 ${kpi.iconBg} rounded-lg flex items-center justify-center shrink-0`}>
                    <Icon size={18} className={kpi.iconColor} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ===== 第二行：应收账款概览 + 账龄分析 ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* 应收账款总览 */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Wallet size={15} className="text-blue-500" />
              应收账款概览
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center py-3">
              <p className="text-xs text-gray-400 mb-1">应收总额</p>
              <p className="text-3xl font-bold text-gray-900">¥{(totalAgingAmount / 10000).toFixed(2)}<span className="text-sm font-normal text-gray-400">万</span></p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-red-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500">逾期金额</p>
                <p className="text-lg font-bold text-red-600">¥{(overdueAmount / 10000).toFixed(2)}万</p>
              </div>
              <div className="bg-amber-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500">逾期订单</p>
                <p className="text-lg font-bold text-amber-600">{overdueOrders?.length ?? 0} <span className="text-xs font-normal">笔</span></p>
              </div>
            </div>
            <div className="space-y-2">
              {agingData.map((item) => (
                <div key={item.label} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${item.bar}`} />
                    <span className="text-gray-500">{item.label}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-gray-400">{item.count}笔</span>
                    <span className={`font-medium ${item.color} w-16 text-right`}>¥{(item.amount / 10000).toFixed(1)}万</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 账龄分析柱状图 */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 size={15} className="text-blue-500" />
              应收账款账龄分析
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-4 h-40 px-2">
              {agingData.map((item) => {
                const maxAmount = Math.max(...agingData.map((d) => d.amount), 1);
                const heightPct = Math.max((item.amount / maxAmount) * 100, 5);
                return (
                  <div key={item.label} className="flex-1 flex flex-col items-center gap-2">
                    <span className={`text-xs font-bold ${item.color}`}>¥{(item.amount / 10000).toFixed(1)}万</span>
                    <div className="w-full flex justify-center">
                      <div
                        className={`w-12 ${item.bar} rounded-t-md transition-all`}
                        style={{ height: `${heightPct * 1.2}px` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500">{item.label}</span>
                    <span className="text-xs text-gray-400">{item.count}笔</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ===== 第三行：逾期订单 + 订单状态分布 ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* 逾期订单预警 */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-red-600">
              <AlertTriangle size={15} />
              逾期订单预警
              <span className="text-xs font-normal text-gray-400 ml-1">共 {overdueOrders?.length ?? 0} 笔 / ¥{(overdueAmount / 10000).toFixed(2)}万</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {overdueOrders && overdueOrders.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs text-gray-400">
                      <th className="text-left pb-2 font-normal">订单号</th>
                      <th className="text-left pb-2 font-normal">客户</th>
                      <th className="text-left pb-2 font-normal">状态</th>
                      <th className="text-right pb-2 font-normal">未收金额</th>
                      <th className="text-right pb-2 font-normal">逾期天数</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overdueOrders.map((order: any) => {
                      const balance = Number(order.totalAmount) - Number(order.receivedAmount);
                      return (
                        <tr key={order.id} className="border-b border-gray-50 hover:bg-red-50/30">
                          <td className="py-2.5 font-medium">{order.orderNo}</td>
                          <td className="py-2.5 text-gray-500">{order.customerName}</td>
                          <td className="py-2.5">
                            <Badge className={`${statusColors[order.orderStatus] ?? ""} text-xs`}>{order.orderStatus}</Badge>
                          </td>
                          <td className="py-2.5 text-right text-red-600 font-medium">¥{balance.toLocaleString()}</td>
                          <td className="py-2.5 text-right">
                            <Badge className="bg-red-100 text-red-700 text-xs">{order.overdueDays}天</Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-10 text-gray-400 text-sm">
                <CheckCircle size={36} className="mx-auto mb-2 text-green-300" />
                暂无逾期订单
              </div>
            )}
          </CardContent>
        </Card>

        {/* 订单状态分布 + 快捷操作 */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp size={15} className="text-blue-500" />
              订单状态分布
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: "进行中", value: stats?.orders.inProgress ?? 0, color: "bg-blue-500" },
              { label: "待签收", value: stats?.orders.pendingReceipt ?? 0, color: "bg-orange-500" },
              { label: "待对账", value: stats?.orders.pendingReconciliation ?? 0, color: "bg-purple-500" },
              { label: "待开票", value: stats?.orders.pendingPayment ?? 0, color: "bg-indigo-500" },
              { label: "待付款", value: stats?.orders.pendingPayment ?? 0, color: "bg-red-500" },
              { label: "已完成", value: stats?.orders.completed ?? 0, color: "bg-green-500" },
              { label: "退货中", value: stats?.orders.afterSales ?? 0, color: "bg-amber-500" },
            ].map((s) => {
              const maxVal = Math.max(stats?.orders.total ?? 1, 1);
              const pct = Math.max((s.value / maxVal) * 100, 3);
              return (
                <div key={s.label} className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 w-12 shrink-0">{s.label}</span>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full ${s.color} rounded-full`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs font-medium w-6 text-right">{s.value}</span>
                </div>
              );
            })}

            <div className="border-t pt-3 mt-3 space-y-2">
              <p className="text-xs text-gray-400">快捷操作</p>
              <div className="grid grid-cols-2 gap-2">
                <Link to="/sales-orders" className="flex items-center gap-1.5 p-2 bg-blue-50 rounded-md text-xs text-blue-700 hover:bg-blue-100 transition-colors">
                  <ShoppingCart size={13} /> 销售订单 <ArrowRight size={11} />
                </Link>
                <Link to="/finance" className="flex items-center gap-1.5 p-2 bg-green-50 rounded-md text-xs text-green-700 hover:bg-green-100 transition-colors">
                  <DollarSign size={13} /> 回款管理 <ArrowRight size={11} />
                </Link>
                <Link to="/customers" className="flex items-center gap-1.5 p-2 bg-purple-50 rounded-md text-xs text-purple-700 hover:bg-purple-100 transition-colors">
                  <Users size={13} /> 客户管理 <ArrowRight size={11} />
                </Link>
                <Link to="/quotation-rules" className="flex items-center gap-1.5 p-2 bg-amber-50 rounded-md text-xs text-amber-700 hover:bg-amber-100 transition-colors">
                  <FileText size={13} /> 报价管理 <ArrowRight size={11} />
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 隐蔽入口：金属价行情 */}
      <div className="mt-6 text-center">
        <Link to="/metal-prices" className="text-[10px] text-gray-300 hover:text-gray-500 transition-colors" title="金属价行情">
          M
        </Link>
      </div>
    </div>
  );
}
