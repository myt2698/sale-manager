import { useState, useContext } from "react";
import { useMockTrpc } from "@/mock/useMockData";
import { PrivacyContext } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DollarSign,
  Plus,
  CreditCard,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Search,
  Trash2,
  X,
  Package,
  Eye,
  ClipboardList,
} from "lucide-react";
import { toast } from "sonner";

const paymentStatusColors: Record<string, string> = {
  待付款: "bg-red-100 text-red-800",
  部分付款: "bg-yellow-100 text-yellow-800",
  全部付款: "bg-green-100 text-green-800",
  已完成: "bg-green-100 text-green-800",
  待开票: "bg-purple-100 text-purple-800",
  待预审: "bg-yellow-100 text-yellow-800",
  生产中: "bg-indigo-100 text-indigo-800",
  待发货: "bg-cyan-100 text-cyan-800",
  部分待签收: "bg-pink-50 text-pink-600 border border-pink-200",
  待签收: "bg-pink-100 text-pink-800",
  待对账: "bg-amber-100 text-amber-800",
  退货中: "bg-orange-100 text-orange-800",
};

export default function Finance() {
  const { privacyMode } = useContext(PrivacyContext);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"manage" | "records">("manage");
  const [showDetail, setShowDetail] = useState(false);
  const [detailOrderId, setDetailOrderId] = useState<number | null>(null);

  const trpc = useMockTrpc();
  const { data: rawData, refetch } = trpc.salesOrder.list.useQuery({
    search: search || undefined,
    status: statusFilter === "all" ? undefined : statusFilter,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    page,
    pageSize: 10,
  });

  // 按订单日期降序排列
  const sortedItems = [...(rawData?.items ?? [])].sort((a: any, b: any) =>
    new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime()
  );
  const data = rawData ? { ...rawData, items: sortedItems } : undefined;

  const { data: paymentsData, refetch: refetchPayments } = trpc.finance.listPayments.useQuery({
    orderId: selectedOrderId ?? undefined,
    page: 1,
    pageSize: 50,
  });
  // 所有回款记录（用于页面展示）
  const { data: allPaymentsData, refetch: refetchAllPayments } = trpc.finance.listPayments.useQuery({
    page: 1,
    pageSize: 200,
  });
  const { data: detailData } = trpc.salesOrder.getById.useQuery(
    { id: detailOrderId! }, { enabled: !!detailOrderId }
  );

  const utils = trpc.useUtils();

  const recordPaymentMutation = trpc.finance.recordPayment.useMutation({
    onSuccess: () => {
      toast.success("回款登记成功");
      closePaymentForm();
      refetch();
      refetchPayments();
      utils.salesOrder.list.invalidate();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deletePaymentMutation = trpc.finance.deletePayment.useMutation({
    onSuccess: () => {
      toast.success("回款记录已删除");
      refetchPayments();
      refetch();
    },
  });

  const [paymentForm, setPaymentForm] = useState({
    orderId: 0,
    amount: "",
    paymentMethod: "银行转账" as string,
    paymentDate: new Date().toISOString().split("T")[0],
    payerName: "",
    notes: "",
  });

  const openPaymentForm = (order: any) => {
    setSelectedOrderId(order.id);
    setPaymentForm({
      orderId: order.id,
      amount: "",
      paymentMethod: "银行转账",
      paymentDate: new Date().toISOString().split("T")[0],
      payerName: order.customerName || "",
      notes: "",
    });
    setShowPaymentForm(true);
  };

  const closePaymentForm = () => {
    setShowPaymentForm(false);
    setSelectedOrderId(null);
    setPaymentForm({
      orderId: 0,
      amount: "",
      paymentMethod: "银行转账",
      paymentDate: new Date().toISOString().split("T")[0],
      payerName: "",
      notes: "",
    });
  };

  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentForm.amount || parseFloat(paymentForm.amount) <= 0) {
      toast.error("请填写回款金额");
      return;
    }
    recordPaymentMutation.mutate({
      ...paymentForm,
    });
  };

  const totalPages = Math.ceil((data?.total ?? 0) / (data?.pageSize ?? 10));

  // 统计数据
  const totalReceivable = data?.items.reduce(
    (sum, o) => sum + Number(o.totalAmount) - Number(o.receivedAmount),
    0
  ) ?? 0;

  const totalReceived = data?.items.reduce(
    (sum, o) => sum + Number(o.receivedAmount),
    0
  ) ?? 0;

  const overdueCount = data?.items.filter((o) => o.isOverdue).length ?? 0;

  const orderPayments = paymentsData?.items.filter((p) => p.orderId === selectedOrderId) ?? [];

  return (
    <div className="space-y-4 pb-8">
      {/* Tab Switcher */}
      <div className="flex items-center gap-0 bg-white rounded-lg border p-1 w-fit">
        <button
          onClick={() => setActiveTab("manage")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === "manage" ? "bg-blue-600 text-white shadow-sm" : "text-gray-500 hover:bg-gray-50"}`}
        >
          <DollarSign size={15} />回款管理
        </button>
        <button
          onClick={() => setActiveTab("records")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === "records" ? "bg-blue-600 text-white shadow-sm" : "text-gray-500 hover:bg-gray-50"}`}
        >
          <ClipboardList size={15} />回款记录
        </button>
      </div>

      {activeTab === "manage" ? (<>
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center shrink-0">
              <TrendingDown size={20} className="text-red-500" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-400">应收账款</p>
              <p className="text-lg font-bold text-red-600 truncate">
                {privacyMode ? "****" : `¥${totalReceivable.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center shrink-0">
              <TrendingUp size={20} className="text-green-500" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-400">已收金额</p>
              <p className="text-lg font-bold text-green-600 truncate">
                {privacyMode ? "****" : `¥${totalReceived.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
              <DollarSign size={20} className="text-blue-500" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-400">回款率</p>
              <p className="text-lg font-bold text-blue-600 truncate">
                {totalReceived + totalReceivable > 0
                  ? ((totalReceived / (totalReceived + totalReceivable)) * 100).toFixed(1)
                  : 0}%
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center shrink-0">
              <AlertTriangle size={20} className="text-orange-500" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-400">逾期订单</p>
              <p className="text-lg font-bold text-orange-600 truncate">
                {overdueCount}笔
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[160px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <Input
                placeholder="搜索订单号或客户..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-1">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-9 border rounded-md px-2 text-sm text-gray-600"
              />
              <span className="text-gray-400 text-sm">-</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-9 border rounded-md px-2 text-sm text-gray-600"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="进行中">进行中</SelectItem>
                <SelectItem value="待签收">待签收</SelectItem>
                <SelectItem value="待对账">待对账</SelectItem>
                <SelectItem value="待开票">待开票</SelectItem>
                <SelectItem value="待付款">待付款</SelectItem>
                <SelectItem value="部分付款">部分付款</SelectItem>
                <SelectItem value="已完成">已完成</SelectItem>
                <SelectItem value="退货中">退货中</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Orders with Finance Status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">订单回款明细</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 hover:bg-gray-50">
                <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wider">客户</TableHead>
                <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wider">产品</TableHead>
                <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">订单金额</TableHead>
                <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">已收款</TableHead>
                <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">未收余额</TableHead>
                <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">状态</TableHead>
                <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wider text-right w-[80px]">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.items.map((order) => {
                const balance = Number(order.balance ?? 0);
                return (
                  <TableRow key={order.id} className="hover:bg-blue-50/40 transition-colors cursor-default group border-b border-gray-50">
                    <TableCell className="py-3">
                      <div className="text-sm font-medium text-gray-900">{order.customerName}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{order.orderDate ? new Date(order.orderDate).toLocaleDateString() : "-"}</div>
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="text-sm text-gray-800 truncate max-w-[140px]">{order.productName}</div>
                    </TableCell>
                    <TableCell className="py-3 text-right">
                      <span className="text-sm font-semibold text-gray-900">{privacyMode ? "****" : `¥${Number(order.totalAmount).toLocaleString()}`}</span>
                    </TableCell>
                    <TableCell className="py-3 text-right">
                      <span className="text-sm font-medium text-green-600">
                        {privacyMode ? "****" : `¥${Number(order.receivedAmount).toLocaleString()}`}
                      </span>
                    </TableCell>
                    <TableCell className="py-3 text-right">
                      <span className={`text-sm font-medium ${balance > 0 ? "text-red-600" : "text-gray-400"}`}>
                        {privacyMode ? "****" : `¥${balance.toLocaleString()}`}
                      </span>
                    </TableCell>
                    <TableCell className="py-3 text-center">
                      <Badge className={`${paymentStatusColors[order.orderStatus] ?? ""} text-xs px-2.5 py-0.5 rounded-full font-medium`}>
                        {order.orderStatus}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-3 text-right">
                      <div className="flex justify-end gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => { setDetailOrderId(order.id); setShowDetail(true); }}
                          title="查看详情"
                        >
                          <Eye size={15} className="text-gray-500" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => openPaymentForm(order)}
                          disabled={balance <= 0}
                          title="登记回款"
                        >
                          <Plus size={16} className="text-green-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {(!data || data.items.length === 0) && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-16">
                    <div className="flex flex-col items-center gap-2 text-gray-300">
                      <Package size={40} />
                      <p className="text-sm">暂无数据</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page <= 1}
          >
            上一页
          </Button>
          <span className="text-sm text-gray-500 py-2">
            第 {page} / {totalPages} 页
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
          >
            下一页
          </Button>
        </div>
      )}

      </>) : (<>
      {/* Payment Records */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard size={18} className="text-blue-500" />
            回款记录
            <Badge className="bg-gray-100 text-gray-500 text-xs">{allPaymentsData?.items.length ?? 0}条</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 hover:bg-gray-50">
                <TableHead className="text-xs font-semibold text-gray-500">回款日期</TableHead>
                <TableHead className="text-xs font-semibold text-gray-500">客户</TableHead>
                <TableHead className="text-xs font-semibold text-gray-500 text-right">金额</TableHead>
                <TableHead className="text-xs font-semibold text-gray-500">方式</TableHead>
                <TableHead className="text-xs font-semibold text-gray-500">付款人</TableHead>
                <TableHead className="text-xs font-semibold text-gray-500 text-center w-[60px]">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(allPaymentsData?.items ?? []).sort((a: any, b: any) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime()).map((p: any) => (
                <TableRow key={p.id} className="border-b border-gray-50 hover:bg-blue-50/30 transition-colors group">
                  <TableCell className="py-3">
                    <div className="text-xs font-medium text-gray-700">{new Date(p.paymentDate).toLocaleDateString()}</div>
                  </TableCell>
                  <TableCell className="py-3">
                    <div className="text-sm text-gray-800">{p.customerName || "-"}</div>
                    <div className="text-xs text-gray-400">{p.orderNo || ""}</div>
                  </TableCell>
                    <TableCell className="py-3 text-right">
                      <span className="text-sm font-bold text-green-700">{privacyMode ? "****" : `¥${Number(p.amount).toLocaleString()}`}</span>
                    </TableCell>
                    <TableCell className="py-3">
                      <Badge className="bg-blue-50 text-blue-700 text-xs px-2 py-0">{p.paymentMethod}</Badge>
                    </TableCell>
                    <TableCell className="py-3 text-sm text-gray-700">{p.payerName || "-"}</TableCell>
                    <TableCell className="py-3 text-center">
                      <button
                        className="p-1.5 rounded hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors"
                        title="删除"
                        onClick={() => {
                          if (confirm("确定删除这条回款记录？")) {
                            deletePaymentMutation.mutate({ id: p.id }, {
                              onSuccess: () => refetchAllPayments(),
                            });
                          }
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </TableCell>
                  </TableRow>
              ))}
              {(!allPaymentsData || allPaymentsData.items.length === 0) && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-gray-300">
                    <CreditCard size={32} className="mx-auto mb-2" />
                    <p className="text-sm">暂无回款记录</p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      </>)}

       {showPaymentForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4">
            <div className="p-6 space-y-4">
              <div className="sticky top-0 z-10 flex justify-end -mx-2 -mt-2 mb-2">
                <button
                  onClick={closePaymentForm}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-[#F5F5F5] text-gray-500 hover:bg-[#E5E5E5] hover:text-gray-700 transition-colors shadow-sm"
                >
                  <X size={15} strokeWidth={2.5} />
                </button>
              </div>
              <h3 className="text-lg font-semibold flex items-center gap-2 -mt-4">
                <CreditCard size={20} />
                登记回款
              </h3>

              <form onSubmit={handlePaymentSubmit} className="space-y-4">
                {/* Order Summary */}
                {selectedOrderId && data?.items.find((o) => o.id === selectedOrderId) && (
                  <div className="bg-gray-50 rounded-lg p-4 grid grid-cols-3 gap-4">
                    {(() => {
                      const order = data.items.find((o) => o.id === selectedOrderId);
                      if (!order) return null;
                      const bal = Number(order.balance ?? 0);
                      return (
                        <>
                          <div className="text-center">
                            <p className="text-xs text-gray-400">订单金额</p>
                            <p className="text-lg font-bold text-gray-900">{privacyMode ? "****" : `¥${Number(order.totalAmount).toLocaleString()}`}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-gray-400">已收金额</p>
                            <p className="text-lg font-bold text-green-600">{privacyMode ? "****" : `¥${Number(order.receivedAmount).toLocaleString()}`}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-gray-400">未收余额</p>
                            <p className="text-lg font-bold text-red-600">{privacyMode ? "****" : `¥${bal.toLocaleString()}`}</p>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}

                {/* Payment Info */}
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                    <CreditCard size={15} className="text-blue-500" />
                    回款信息
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-gray-500">回款金额 *</Label>
                      <Input
                        className="mt-1"
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={paymentForm.amount}
                        onChange={(e) =>
                          setPaymentForm({ ...paymentForm, amount: e.target.value })
                        }
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">回款日期 *</Label>
                      <Input
                        className="mt-1"
                        type="date"
                        value={paymentForm.paymentDate}
                        onChange={(e) =>
                          setPaymentForm({ ...paymentForm, paymentDate: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">回款方式</Label>
                      <Select
                        value={paymentForm.paymentMethod}
                        onValueChange={(v) =>
                          setPaymentForm({ ...paymentForm, paymentMethod: v })
                        }
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="银行转账">银行转账</SelectItem>
                          <SelectItem value="支票">支票</SelectItem>
                          <SelectItem value="现金">现金</SelectItem>
                          <SelectItem value="承兑汇票">承兑汇票</SelectItem>
                          <SelectItem value="其他">其他</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">付款人</Label>
                      <Input
                        className="mt-1"
                        value={paymentForm.payerName}
                        onChange={(e) =>
                          setPaymentForm({ ...paymentForm, payerName: e.target.value })
                        }
                        placeholder="付款方名称"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">备注</Label>
                    <textarea
                      className="w-full border rounded-md p-2 text-sm mt-1"
                      rows={2}
                      value={paymentForm.notes}
                      onChange={(e) =>
                        setPaymentForm({ ...paymentForm, notes: e.target.value })
                      }
                      placeholder="其他补充说明..."
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={closePaymentForm}>
                    取消
                  </Button>
                  <Button type="submit" disabled={recordPaymentMutation.isPending}>
                    {recordPaymentMutation.isPending ? "登记中..." : "确认登记"}
                  </Button>
                </div>
              </form>

              {/* Payment History for this order */}
              {orderPayments.length > 0 && (
                <div className="mt-4 border-t pt-4">
                  <h4 className="text-sm font-medium mb-3">该订单回款记录</h4>
                  <div className="rounded-lg border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50">
                          <TableHead className="text-xs">金额</TableHead>
                          <TableHead className="text-xs">方式</TableHead>
                          <TableHead className="text-xs">日期</TableHead>
                          <TableHead className="text-xs">付款人</TableHead>
                          <TableHead className="text-xs w-[60px]">操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orderPayments.map((p) => (
                          <TableRow key={p.id}>
                            <TableCell className="text-sm text-green-600 font-medium">
                              {privacyMode ? "****" : `¥${Number(p.amount).toLocaleString()}`}
                            </TableCell>
                            <TableCell className="text-sm">{p.paymentMethod}</TableCell>
                            <TableCell className="text-sm">
                              {new Date(p.paymentDate).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="text-sm">{p.payerName || "-"}</TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => {
                                  if (confirm("确定删除这条回款记录？")) {
                                    deletePaymentMutation.mutate({ id: p.id });
                                  }
                                }}
                              >
                                <Trash2 size={14} className="text-red-400" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Order Detail Dialog */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" showCloseButton={false}>
          <div className="sticky top-0 z-10 flex justify-end -mx-2 -mt-2 mb-2">
            <button
              onClick={() => setShowDetail(false)}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-[#F5F5F5] text-gray-500 hover:bg-[#E5E5E5] hover:text-gray-700 transition-colors shadow-sm"
            >
              <X size={15} strokeWidth={2.5} />
            </button>
          </div>
          <DialogHeader className="-mt-6">
            <DialogTitle className="flex items-center gap-2">
              <Package size={20} /> 订单详情 - {detailData?.orderNo}
            </DialogTitle>
          </DialogHeader>
          {detailData && (
            <div className="space-y-4">
              {/* 财务与发货概览 */}
              <div className="border rounded-lg p-3 bg-white">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-gray-400">财务概览</p>
                  <span className="text-xs text-gray-400">{Number(detailData.shippedTotal ?? 0).toFixed(2)} / {detailData.quantity} kg 已发</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <div className="flex items-center gap-1">
                    <span className="text-gray-400 text-xs">订单</span>
                    <span className="font-semibold">{privacyMode ? "****" : `¥${Number(detailData.totalAmount).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`}</span>
                  </div>
                  <div className="w-px h-3 bg-gray-200" />
                  <div className="flex items-center gap-1">
                    <span className="text-gray-400 text-xs">已收</span>
                    <span className="font-semibold text-green-600">{privacyMode ? "****" : `¥${Number(detailData.receivedAmount).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`}</span>
                  </div>
                  <div className="w-px h-3 bg-gray-200" />
                  <div className="flex items-center gap-1">
                    <span className="text-gray-400 text-xs">未收</span>
                    <span className="font-semibold text-red-600">{privacyMode ? "****" : `¥${Number(detailData.balance).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`}</span>
                  </div>
                </div>
                <div className="mt-2">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-gray-400">发货进度</span>
                    <span className="text-gray-500">{Number(detailData.quantity) > 0 ? Math.round((Number(detailData.shippedTotal ?? 0) / Number(detailData.quantity)) * 100) : 0}%</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${Number(detailData.quantity) > 0 ? Math.min(100, (Number(detailData.shippedTotal ?? 0) / Number(detailData.quantity)) * 100) : 0}%` }} />
                  </div>
                </div>
              </div>

              {/* 基本信息 */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-gray-400">客户:</span> {detailData.customerName}</div>
                <div><span className="text-gray-400">客户订单号:</span> {detailData.customerOrderNo || "-"}</div>
                <div><span className="text-gray-400">产品:</span> {detailData.productName}</div>
                <div><span className="text-gray-400">料号:</span> {detailData.productCode || "-"}</div>
                <div><span className="text-gray-400">型号:</span> {detailData.productModel || "-"}</div>
                <div><span className="text-gray-400">数量:</span> {detailData.quantity} kg</div>
                <div><span className="text-gray-400">单价:</span> {privacyMode ? "****" : `¥${Number(detailData.unitPrice).toLocaleString()}`}</div>
                <div><span className="text-gray-400">订单日期:</span> {detailData.orderDate ? new Date(detailData.orderDate).toLocaleDateString() : "-"}</div>
                <div><span className="text-gray-400">账期:</span> {detailData.paymentTerms === "0" || detailData.paymentTerms === 0 ? "现款" : detailData.paymentTerms ? `${detailData.paymentTerms}天` : "30天"}</div>
                <div className="col-span-2"><span className="text-gray-400">收货地址:</span> {detailData.shippingAddress || "-"}</div>
                {detailData.notes && <div className="col-span-2 bg-yellow-50 rounded p-2 mt-1"><span className="text-gray-400 text-xs">备注:</span> <span className="text-sm">{detailData.notes}</span></div>}
                <div className="col-span-2"><span className="text-gray-400">状态:</span> <Badge className={paymentStatusColors[detailData.orderStatus] ?? ""}>{detailData.orderStatus}</Badge></div>
              </div>

              {/* 发货批次 - 五维状态 */}
              {(detailData.shipments ?? []).length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-gray-700">发货批次</h4>
                  {(detailData.shipments ?? []).map((s: any, idx: number) => (
                    <div key={s.id} className="border rounded-lg bg-white">
                      <div className="flex items-center justify-between p-3 border-b bg-gray-50">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-gray-400">批次 #{idx + 1}</span>
                          <span className="font-semibold text-gray-900">{Number(s.quantity).toFixed(2)} kg</span>
                          <span className="text-gray-300">|</span>
                          <span className="text-xs text-gray-500">{s.logisticsCompany}</span>
                          <span className="text-gray-300">|</span>
                          <span className="text-xs font-mono text-gray-400">{s.logisticsNo}</span>
                        </div>
                        <span className="text-xs text-gray-400">{new Date(s.shippedDate).toLocaleDateString()}</span>
                      </div>
                      <div className="p-3">
                        <div className="flex flex-wrap gap-2">
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-gray-400">签收:</span>
                            <Badge className={`${s.receivingStatus === "已签收" ? "bg-teal-100 text-teal-800" : "bg-pink-100 text-pink-800"} text-xs px-1.5 py-0`}>{s.receivingStatus}</Badge>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-gray-400">对账:</span>
                            <Badge className={`${s.reconciliationStatus === "已对账" ? "bg-purple-100 text-purple-800" : "bg-gray-100 text-gray-500"} text-xs px-1.5 py-0`}>{s.reconciliationStatus}</Badge>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-gray-400">票据:</span>
                            <Badge className={`${s.invoiceStatus === "已开票" ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-500"} text-xs px-1.5 py-0`}>{s.invoiceStatus}</Badge>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-gray-400">付款:</span>
                            <Badge className={`${s.paymentStatus === "已支付" ? "bg-green-100 text-green-800" : s.paymentStatus === "部分付款" ? "bg-sky-100 text-sky-800" : "bg-amber-100 text-amber-800"} text-xs px-1.5 py-0`}>{s.paymentStatus}</Badge>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-gray-400">售后:</span>
                            <Badge className={`${s.afterSalesStatus === "无售后" ? "bg-gray-100 text-gray-500" : "bg-orange-100 text-orange-800"} text-xs px-1.5 py-0`}>{s.afterSalesStatus}</Badge>
                          </div>
                        </div>
                        {s.paymentDueDate && (
                          <div className="mt-2 text-xs">
                            <span className="text-gray-400">付款到期日:</span>
                            <span className={`ml-1 font-medium ${new Date(s.paymentDueDate) < new Date() ? "text-red-600" : "text-amber-700"}`}>
                              {new Date(s.paymentDueDate).toLocaleDateString()}
                              {new Date(s.paymentDueDate) < new Date() && " (已逾期)"}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 回款记录 */}
              <div className="border rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">回款记录</h4>
                {(() => {
                  const orderPayments = paymentsData?.items?.filter((p: any) => p.orderId === detailData.id) ?? [];
                  return orderPayments.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50">
                          <TableHead className="text-xs">金额</TableHead>
                          <TableHead className="text-xs">方式</TableHead>
                          <TableHead className="text-xs">日期</TableHead>
                          <TableHead className="text-xs">付款人</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orderPayments.map((p: any) => (
                          <TableRow key={p.id}>
                            <TableCell className="text-sm text-green-600 font-medium">{privacyMode ? "****" : `¥${Number(p.amount).toLocaleString()}`}</TableCell>
                            <TableCell className="text-sm">{p.paymentMethod}</TableCell>
                            <TableCell className="text-sm">{new Date(p.paymentDate).toLocaleDateString()}</TableCell>
                            <TableCell className="text-sm">{p.payerName || "-"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-xs text-gray-400 text-center py-4">暂无回款记录</p>
                  );
                })()}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
