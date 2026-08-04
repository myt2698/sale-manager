import { useState, useContext } from "react";
import { useMockTrpc } from "@/mock/useMockData";
import { PrivacyContext } from "@/components/Layout";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import {
  Search, Plus, Eye, Pencil, Trash2, X,
  Package, ClipboardCheck, Truck, FileText,
  RotateCcw, Clock, AlertTriangle, CheckCircle,
  CreditCard, Bell, History,
} from "lucide-react";

const statusColors: Record<string, string> = {
  待排产: "bg-blue-100 text-blue-800", 生产中: "bg-orange-100 text-orange-800",
  部分待签收: "bg-pink-50 text-pink-600 border border-pink-200", 待签收: "bg-pink-100 text-pink-800",
  待对账: "bg-purple-100 text-purple-800", 待开票: "bg-sky-100 text-sky-800",
  待付款: "bg-amber-100 text-amber-800", 退货中: "bg-red-100 text-red-800",
  已完成: "bg-green-100 text-green-800",
};
// 五维状态体系 - 根据付款条件分两种流程
// 现款(先款后货): 付款→开票→发货→签收→对账
// 账期(先货后款): 发货→签收→对账→开票→付款
const dimensionLabels: Record<string, string> = {
  paymentStatus: "付款", invoiceStatus: "开票", shippingStatus: "发货",
  receivingStatus: "签收", reconciliationStatus: "对账",
};
const dimensionCompleteValue: Record<string, string> = {
  paymentStatus: "已支付", invoiceStatus: "已开票", shippingStatus: "已发货",
  receivingStatus: "已签收", reconciliationStatus: "已对账",
};
const dimensionInitValue: Record<string, string> = {
  paymentStatus: "待支付", invoiceStatus: "待开票", shippingStatus: "待发货",
  receivingStatus: "待签收", reconciliationStatus: "未对账",
};
const dimColors: Record<string, Record<string, string>> = {
  paymentStatus: { 待支付: "bg-amber-100 text-amber-800", 部分付款: "bg-sky-100 text-sky-800", 已支付: "bg-green-100 text-green-800", 支付失败: "bg-red-100 text-red-800" },
  invoiceStatus: { 待开票: "bg-gray-100 text-gray-500", 已开票: "bg-blue-100 text-blue-800" },
  shippingStatus: { 待发货: "bg-yellow-100 text-yellow-800", 已发货: "bg-indigo-100 text-indigo-800" },
  receivingStatus: { 待签收: "bg-pink-100 text-pink-800", 已签收: "bg-teal-100 text-teal-800", 拒收: "bg-red-100 text-red-800" },
  reconciliationStatus: { 未对账: "bg-gray-100 text-gray-500", 已对账: "bg-purple-100 text-purple-800" },
};
// 现款(先款后货)发货批次流程：发货→签收（签收即完成，无需对账）
// 付款和票据在订单级独立处理
const cashDimensionOrder = ["shippingStatus", "receivingStatus"];
// 账期(先货后款)发货批次流程
const creditDimensionOrder = ["shippingStatus", "receivingStatus", "reconciliationStatus", "invoiceStatus", "paymentStatus"];
const sampleDimensionOrder = ["shippingStatus", "receivingStatus"];
// 获取流程类型对应的维度顺序
function getDimensionOrder(flowType: string) {
  if (flowType === "sample") return sampleDimensionOrder;
  return flowType === "cash" ? cashDimensionOrder : creditDimensionOrder;
}

function toLocalDateTimeInput(value?: string | Date | null) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "";
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toIsoDateTime(value?: string) {
  if (!value) return new Date().toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}
const afterSalesStatusColors: Record<string, string> = {
  无售后: "bg-gray-100 text-gray-500", 售后申请中: "bg-yellow-100 text-yellow-800",
  退货中: "bg-orange-100 text-orange-800", 售后完成: "bg-green-100 text-green-800", 售后关闭: "bg-gray-100 text-gray-500",
};

// ===== Product Line Item =====
interface ProductItem {
  productId: number | null;
  productName: string;
  productCode: string;
  productModel: string;
  quantity: string;
  unitPrice: string;
  subTotal: string;
}

function calcSubTotal(qty: string, price: string): string {
  const q = parseFloat(qty) || 0;
  const p = parseFloat(price) || 0;
  return (q * p).toFixed(2);
}

export default function SalesOrders({ mode = "sales" }: { mode?: "sales" | "sample" }) {
  const trpc = useMockTrpc();
  const isSample = mode === "sample";
  const orderKind = isSample ? "样品订单" : "销售订单";
  const orderApi: any = isSample ? trpc.sampleOrder : trpc.salesOrder;
  const reminderApi: any = isSample ? trpc.sampleReminder : trpc.reminder;
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [dueStartDate, setDueStartDate] = useState("");
  const [dueEndDate, setDueEndDate] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<number | null>(null);
  const [openDetail, setOpenDetail] = useState(false);
  const [openShippingForm, setOpenShippingForm] = useState(false);
  const [shippingForm, setShippingForm] = useState({ shippedQty: "", productName: "", productionTime: toLocalDateTimeInput() });
  const [shipmentNotes, setShipmentNotes] = useState<Record<number, string>>({});
  const [processAction, setProcessAction] = useState<{
    shipmentId: number;
    dimension: string;
    value: string;
    time: string;
    action: "advance" | "rollback";
  } | null>(null);
  const [openReturnForm, setOpenReturnForm] = useState(false);
  const [returnShipmentId, setReturnShipmentId] = useState<number | null>(null);
  const [returnForm, setReturnForm] = useState({ quantity: "", reason: "" });
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showPaymentPage, setShowPaymentPage] = useState(false);
  const [paymentPageOrderId, setPaymentPageOrderId] = useState<number | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    orderId: 0, amount: "", paymentMethod: "银行转账",
    paymentDate: new Date().toISOString().split("T")[0], payerName: "", notes: "",
  });

  const { data, refetch } = orderApi.list.useQuery({
    search: search || undefined, status: statusFilter === "all" ? undefined : statusFilter,
    startDate: startDate || undefined, endDate: endDate || undefined,
    dueStartDate: !isSample ? dueStartDate || undefined : undefined,
    dueEndDate: !isSample ? dueEndDate || undefined : undefined, page, pageSize,
  });
  // 获取全部数据用于导出
  const { data: allData } = orderApi.list.useQuery({
    search: search || undefined, status: statusFilter === "all" ? undefined : statusFilter,
    startDate: startDate || undefined, endDate: endDate || undefined,
    dueStartDate: !isSample ? dueStartDate || undefined : undefined,
    dueEndDate: !isSample ? dueEndDate || undefined : undefined, page: 1, pageSize: 9999,
  });
  const { data: detailData } = orderApi.getById.useQuery(
    { id: selectedOrder! }, { enabled: !!selectedOrder }
  );
  const { data: productsData } = trpc.product.list.useQuery({});
  const { data: paymentsData, refetch: refetchPayments } = trpc.finance.listPayments.useQuery(
    { orderId: paymentPageOrderId ?? undefined, page: 1, pageSize: 200 },
    { enabled: !isSample && showPaymentPage }
  );

  // 根据 productId 实时查询产品信息（产品修改后订单显示同步更新）
  const resolveProduct = (productId: number | null | undefined) => {
    if (!productId) return null;
    return productsData?.items?.find((p: any) => p.id === productId) ?? null;
  };
  const { data: customersData } = trpc.customer.list.useQuery({ pageSize: 100 });

  const createMutation = orderApi.create.useMutation({ onSuccess: () => { toast.success(`${orderKind}创建成功`); closeForm(); refetch(); } });
  const updateMutation = orderApi.update.useMutation({ onSuccess: () => { toast.success(`${orderKind}更新成功`); closeForm(); refetch(); } });
  const deleteMutation = orderApi.delete.useMutation({ onSuccess: () => { toast.success(`${orderKind}删除成功`); refetch(); } });
  const recordShipmentMutation = orderApi.recordShipment.useMutation({
    onSuccess: () => { toast.success("生产数量已安排"); setOpenShippingForm(false); setShippingForm({ shippedQty: "", productName: "", productionTime: toLocalDateTimeInput() }); refetch(); },
    onError: (err: any) => toast.error(err.message),
  });
  const updateShipmentStatusMutation = orderApi.updateShipmentStatus.useMutation({
    onSuccess: () => { toast.success("状态已更新"); setProcessAction(null); refetch(); }, onError: (err: any) => toast.error(err.message),
  });
  const recordReturnMutation = orderApi.recordReturn.useMutation({
    onSuccess: () => { toast.success("退货申请已提交"); setOpenReturnForm(false); setReturnForm({ quantity: "", reason: "" }); setReturnShipmentId(null); refetch(); },
    onError: (err: any) => toast.error(err.message),
  });
  const updateAfterSalesMutation = orderApi.updateAfterSales.useMutation({
    onSuccess: () => { toast.success("售后状态已更新"); refetch(); },
    onError: (err: any) => toast.error(err.message),
  });
  const updatePaymentDueDateMutation = orderApi.updatePaymentDueDate.useMutation({
    onSuccess: () => { toast.success("付款到期日已更新"); refetch(); },
    onError: (err: any) => toast.error(err.message),
  });
  const updateShipmentNoteMutation = orderApi.updateShipmentNote.useMutation({
    onSuccess: () => { toast.success("批次备注已保存"); refetch(); },
    onError: (err: any) => toast.error(err.message),
  });
  const recordPaymentMutation = trpc.finance.recordPayment.useMutation({
    onSuccess: () => {
      toast.success("回款登记成功");
      setShowPaymentForm(false);
      refetchPayments();
      refetch();
    },
    onError: (err: any) => toast.error(err.message),
  });
  const deletePaymentMutation = trpc.finance.deletePayment.useMutation({
    onSuccess: () => { toast.success("回款记录已删除"); refetchPayments(); refetch(); },
    onError: (err: any) => toast.error(err.message),
  });
  // 提醒
  const { data: remindersData, refetch: refetchReminders } = reminderApi.list.useQuery(
    { orderId: selectedOrder ?? 0 }, { enabled: !!selectedOrder }
  );
  const createReminderMutation = reminderApi.create.useMutation({
    onSuccess: () => { toast.success("提醒已创建"); refetchReminders(); },
    onError: (err: any) => toast.error(err.message),
  });
  const updateReminderMutation = reminderApi.update.useMutation({
    onSuccess: () => { toast.success("提醒已更新"); refetchReminders(); },
    onError: (err: any) => toast.error(err.message),
  });
  const deleteReminderMutation = reminderApi.delete.useMutation({
    onSuccess: () => { toast.success("提醒已删除"); refetchReminders(); },
    onError: (err: any) => toast.error(err.message),
  });
  const [showReminderForm, setShowReminderForm] = useState(false);
  const [timelineShipment, setTimelineShipment] = useState<any>(null);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const { privacyMode } = useContext(PrivacyContext);

  // 导出字段配置
  const exportFields = [
    { key: "orderNo", label: "订单号", checked: true },
    { key: "orderDate", label: "订单日期", checked: true },
    { key: "customerName", label: "客户名称", checked: true },
    { key: "customerOrderNo", label: "客户订单号", checked: false },
    { key: "productName", label: "产品名称", checked: true },
    { key: "productCode", label: "产品编号", checked: false },
    { key: "productModel", label: "产品型号", checked: false },
    { key: "quantity", label: "数量", checked: true },
    { key: "unitPrice", label: "单价", checked: false },
    { key: "totalAmount", label: "订单金额", checked: true },
    { key: "orderStatus", label: "订单状态", checked: true },
    { key: "paymentTerms", label: "账期", checked: false },
    { key: "shippingAddress", label: "收货地址", checked: false },
    { key: "notes", label: "备注", checked: false },
    { key: "receivedAmount", label: "已收金额", checked: false },
    { key: "balance", label: "未收金额", checked: false },
    { key: "createdAt", label: "创建时间", checked: false },
  ].filter(field => !isSample || !["unitPrice", "totalAmount", "paymentTerms", "receivedAmount", "balance"].includes(field.key));
  const [selectedFields, setSelectedFields] = useState<string[]>(
    exportFields.filter(f => f.checked).map(f => f.key)
  );
  const [reminderForm, setReminderForm] = useState({ content: "", remindDate: "", priority: "high", type: isSample ? "发货提醒" : "对账提醒" });

  // Form state
  const [formData, setFormData] = useState({
    orderNo: "", customerId: 0, customerOrderNo: "",
    shippingAddress: "", notes: "", orderDate: new Date().toISOString().split("T")[0],
    paymentTerms: "0", contractReviewed: false, hasShippingInfo: false, hasSpecialRequirements: false,
  });
  const [items, setItems] = useState<ProductItem[]>([
    { productId: null, productName: "", productCode: "", productModel: "", quantity: "", unitPrice: "", subTotal: "" },
  ]);
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [customerPickerSearch, setCustomerPickerSearch] = useState("");

  const resetForm = () => {
    setFormData({ orderNo: "", customerId: 0, customerOrderNo: "", shippingAddress: "", notes: "", orderDate: new Date().toISOString().split("T")[0], paymentTerms: "0", contractReviewed: false, hasShippingInfo: false, hasSpecialRequirements: false });
    setItems([{ productId: null, productName: "", productCode: "", productModel: "", quantity: "", unitPrice: "", subTotal: "" }]);
    setShowCustomerPicker(false);
    setCustomerPickerSearch("");
  };
  const closeForm = () => { setShowForm(false); setIsEditing(false); setEditId(null); resetForm(); };

  const addItem = () => {
    setItems(prev => [...prev, { productId: null, productName: "", productCode: "", productModel: "", quantity: "", unitPrice: "", subTotal: "" }]);
  };
  const removeItem = (idx: number) => {
    setItems(prev => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev);
  };
  const updateItem = (idx: number, field: keyof ProductItem, value: string) => {
    setItems(prev => prev.map((it, i) => {
      if (i !== idx) return it;
      const updated = { ...it, [field]: value };
      if (field === "quantity" || field === "unitPrice") {
        updated.subTotal = calcSubTotal(updated.quantity, updated.unitPrice);
      }
      return updated;
    }));
  };
  const selectProductForItem = (idx: number, productId: string) => {
    const p = productsData?.items?.find((x: any) => x.id.toString() === productId);
    if (p) {
      setItems(prev => prev.map((it, i) => i === idx ? { ...it, productId: p.id, productName: p.productName, categoryName: p.categoryName ?? "", productCode: p.productCode ?? "", productModel: p.productModel ?? "", subTotal: calcSubTotal(it.quantity, it.unitPrice) } : it));
    }
  };

  const totalAmount = items.reduce((sum, it) => sum + (parseFloat(it.subTotal) || 0), 0);
  const totalQty = items.reduce((sum, it) => sum + (parseFloat(it.quantity) || 0), 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.contractReviewed) { toast.error("请先完成合同评审"); return; }
    if (!formData.orderNo.trim()) { toast.error("请填写订单编号"); return; }
    if (!formData.customerId) { toast.error("请选择客户"); return; }
    const validItems = items.filter(it => it.productName.trim() && it.productCode.trim() && parseFloat(it.quantity) > 0);
    if (validItems.length === 0) { toast.error("请至少添加一个有效的产品明细"); return; }
    const submitItems = validItems.map(it => isSample
      ? { productId: it.productId, productName: it.productName, productCode: it.productCode, productModel: it.productModel, quantity: it.quantity }
      : { ...it, subTotal: calcSubTotal(it.quantity, it.unitPrice) });
    const payload = isSample
      ? { ...formData, paymentTerms: undefined, items: submitItems }
      : { ...formData, items: submitItems };
    if (isEditing && editId) updateMutation.mutate({ id: editId, data: payload });
    else createMutation.mutate(payload);
  };

  // 导出 Excel（导出所有数据，不分页）
  const handleExport = () => {
    const items = allData?.items ?? [];
    if (items.length === 0) { toast.error("没有可导出的订单"); return; }
    const rows = items.map((o: any) => {
      const row: Record<string, any> = {};
      if (selectedFields.includes("orderNo")) row["订单号"] = o.orderNo;
      if (selectedFields.includes("orderDate")) row["订单日期"] = o.orderDate ? new Date(o.orderDate).toLocaleDateString() : "";
      if (selectedFields.includes("customerName")) row["客户名称"] = o.customerName;
      if (selectedFields.includes("customerOrderNo")) row["客户订单号"] = o.customerOrderNo ?? "";
      if (selectedFields.includes("productName")) row["产品名称"] = (o.items ?? []).map((it: any) => { const lp = resolveProduct(it.productId); const cn = lp?.categoryName ?? it.categoryName ?? ""; const pn = lp?.productName ?? it.productName ?? ""; return (cn ? `${cn}/` : "") + pn; }).join(", ") || o.productName;
      if (selectedFields.includes("productCode")) row["产品编号"] = (o.items ?? []).map((it: any) => it.productCode).join(", ") || o.productCode;
      if (selectedFields.includes("productModel")) row["产品型号"] = (o.items ?? []).map((it: any) => it.productModel).join(", ") || o.productModel;
      if (selectedFields.includes("quantity")) row["数量"] = Number(o.quantity).toFixed(0) + " kg";
      if (selectedFields.includes("unitPrice")) row["单价"] = o.unitPrice;
      if (selectedFields.includes("totalAmount")) row["订单金额"] = Number(o.totalAmount);
      if (selectedFields.includes("orderStatus")) row["订单状态"] = o.orderStatus;
      if (selectedFields.includes("paymentTerms")) row["账期"] = o.paymentTerms === "0" || o.paymentTerms === 0 ? "现款" : `${o.paymentTerms}天`;
      if (selectedFields.includes("shippingAddress")) row["收货地址"] = o.shippingAddress ?? "";
      if (selectedFields.includes("notes")) row["备注"] = o.notes ?? "";
      if (selectedFields.includes("receivedAmount")) row["已收金额"] = Number(o.receivedAmount ?? 0);
      if (selectedFields.includes("balance")) row["未收金额"] = Number(o.balance ?? 0);
      if (selectedFields.includes("createdAt")) row["创建时间"] = o.createdAt ? new Date(o.createdAt).toLocaleString() : "";
      return row;
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "订单列表");
    const now = new Date().toISOString().split("T")[0];
    XLSX.writeFile(wb, `${orderKind}_${now}.xlsx`);
    setShowExportDialog(false);
    toast.success(`已导出 ${items.length} 条订单`);
  };

  const openEditDialog = (order: any) => {
    setEditId(order.id); setIsEditing(true);
    setFormData({ orderNo: order.orderNo, customerId: order.customerId, customerOrderNo: order.customerOrderNo ?? "", shippingAddress: order.shippingAddress ?? "", notes: order.notes ?? "", orderDate: order.orderDate ? order.orderDate.split("T")[0] : new Date().toISOString().split("T")[0], paymentTerms: String(order.paymentTerms ?? "0"), contractReviewed: order.contractReviewed ?? false, hasShippingInfo: order.hasShippingInfo ?? false, hasSpecialRequirements: order.hasSpecialRequirements ?? false });
    const orderItems = order.items ?? [{
      productId: order.productId ?? null, productName: order.productName ?? "", productCode: order.productCode ?? "",
      productModel: order.productModel ?? "", quantity: String(order.quantity ?? ""), unitPrice: String(order.unitPrice ?? ""), subTotal: String(order.totalAmount ?? ""),
    }];
    setItems(orderItems.map((it: any) => ({ productId: it.productId ?? null, productName: it.productName ?? "", productCode: it.productCode ?? "", productModel: it.productModel ?? "", quantity: String(it.quantity ?? ""), unitPrice: String(it.unitPrice ?? ""), subTotal: String(it.subTotal ?? calcSubTotal(it.quantity, it.unitPrice)) })));
    setShowForm(true);
  };

  // 从发货记录或订单推断 flowType
  const inferFlowType = (shipment: any) => isSample ? "sample" : shipment.flowType ?? (detailData?.paymentTerms === "0" || detailData?.paymentTerms === 0 ? "cash" : "credit");
  const getCurrentStep = (shipment: any): number => {
    const dims = getDimensionOrder(inferFlowType(shipment));
    for (let i = 0; i < dims.length; i++) { if (shipment[dims[i]] !== dimensionCompleteValue[dims[i]]) return i; }
    return -1;
  };
  const openProcessAction = (shipment: any, dimension: string, value: string, action: "advance" | "rollback" = "advance") => {
    setProcessAction({ shipmentId: shipment.id, dimension, value, time: toLocalDateTimeInput(), action });
  };
  const confirmProcessAction = () => {
    if (!processAction) return;
    updateShipmentStatusMutation.mutate({
      orderId: detailData!.id,
      shipmentId: processAction.shipmentId,
      dimension: processAction.dimension,
      value: processAction.value,
      occurredAt: toIsoDateTime(processAction.time),
    });
  };
  const handleNext = (shipment: any) => {
    const step = getCurrentStep(shipment); if (step === -1) return;
    const dims = getDimensionOrder(inferFlowType(shipment));
    const dim = dims[step];
    openProcessAction(shipment, dim, dimensionCompleteValue[dim]);
  };
  const handlePrev = (shipment: any) => {
    const dims = getDimensionOrder(inferFlowType(shipment));
    let lastCompleted = -1;
    for (let i = 0; i < dims.length; i++) { if (shipment[dims[i]] === dimensionCompleteValue[dims[i]]) lastCompleted = i; }
    if (lastCompleted === -1) return;
    const dim = dims[lastCompleted];
    openProcessAction(shipment, dim, dimensionInitValue[dim], "rollback");
  };
  const handleProductionConfirm = () => {
    if (!shippingForm.shippedQty || parseFloat(shippingForm.shippedQty) <= 0) { toast.error("请填写安排生产数量"); return; }
    const remaining = Number(detailData!.quantity) - Number(detailData!.shippedTotal ?? 0);
    if (parseFloat(shippingForm.shippedQty) > remaining) { toast.error(`安排生产数量不能超过剩余 ${remaining} kg`); return; }
    recordShipmentMutation.mutate({ orderId: detailData!.id, quantity: shippingForm.shippedQty, productName: shippingForm.productName, logisticsCompany: "", logisticsNo: "", productionTime: toIsoDateTime(shippingForm.productionTime) });
  };

  const openPaymentPage = (orderId?: number) => {
    setPaymentPageOrderId(orderId ?? null);
    setShowPaymentForm(false);
    setShowPaymentPage(true);
  };
  const openPaymentRegistration = (orderId?: number) => {
    const targetId = orderId ?? paymentPageOrderId ?? detailData?.id ?? (allData?.items?.[0]?.id ?? 0);
    const order = targetId === detailData?.id ? detailData : (allData?.items ?? []).find((item: any) => item.id === targetId);
    if (!order) { toast.error("请先选择销售订单"); return; }
    setPaymentForm({
      orderId: order.id,
      amount: Number(order.balance) > 0 ? Number(order.balance).toFixed(2) : "",
      paymentMethod: "银行转账",
      paymentDate: new Date().toISOString().split("T")[0],
      payerName: order.customerName || "",
      notes: "",
    });
    setShowPaymentForm(true);
  };
  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentForm.amount || Number(paymentForm.amount) <= 0) { toast.error("请填写回款金额"); return; }
    recordPaymentMutation.mutate(paymentForm);
  };

  const totalPages = Math.ceil((data?.total ?? 0) / (data?.pageSize ?? 10));
  const salesSummary = (allData?.items ?? []).reduce((summary: any, order: any) => ({
    receivable: summary.receivable + Number(order.totalAmount ?? 0),
    received: summary.received + Number(order.receivedAmount ?? 0),
    balance: summary.balance + Number(order.balance ?? 0),
    overdue: summary.overdue + (order.isOverdue ? 1 : 0),
  }), { receivable: 0, received: 0, balance: 0, overdue: 0 });

  return (
    <div className="space-y-4">
      {!isSample && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            ["应收总额", salesSummary.receivable, "text-gray-800"],
            ["已回款", salesSummary.received, "text-green-600"],
            ["待回款", salesSummary.balance, "text-red-600"],
            ["逾期订单", salesSummary.overdue, "text-orange-600"],
          ].map(([label, value, color], index) => (
            <Card key={String(label)}><CardContent className="p-3">
              <div className="text-xs text-gray-400">{label}</div>
              <div className={`mt-1 text-lg font-semibold ${color}`}>
                {index === 3 ? `${value} 单` : privacyMode ? "****" : `¥${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              </div>
            </CardContent></Card>
          ))}
        </div>
      )}
      {/* Toolbar */}
      <Card><CardContent className="p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[160px]">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-gray-400"
              size={18}
              aria-hidden="true"
            />
            <Input
              type="search"
              placeholder="模糊搜索订单号或客户名称..."
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="relative z-0 pl-10"
            />
          </div>
          <div className="flex items-center gap-1">
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-9 border rounded-md px-2 text-sm" />
            <span className="text-gray-400">-</span>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-9 border rounded-md px-2 text-sm" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部状态</SelectItem>
              {Object.keys(statusColors).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          {!isSample && <Button size="sm" variant="outline" onClick={() => openPaymentPage()}><CreditCard size={16} className="mr-1" />回款记录</Button>}
          <Button size="sm" variant="outline" onClick={() => setShowExportDialog(true)}><FileText size={16} className="mr-1" />导出</Button>
          <Button size="sm" onClick={() => { resetForm(); setIsEditing(false); setShowForm(true); }}><Plus size={16} className="mr-1" />新建</Button>
        </div>
        {!isSample && (
          <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t">
            <span className="text-xs font-medium text-gray-500">回款到期日</span>
            <input type="date" value={dueStartDate} onChange={e => { setDueStartDate(e.target.value); setPage(1); }} className="h-8 border rounded-md px-2 text-sm" />
            <span className="text-gray-400">-</span>
            <input type="date" value={dueEndDate} onChange={e => { setDueEndDate(e.target.value); setPage(1); }} className="h-8 border rounded-md px-2 text-sm" />
            {(dueStartDate || dueEndDate) && <Button size="sm" variant="ghost" onClick={() => { setDueStartDate(""); setDueEndDate(""); setPage(1); }}>清除到期日</Button>}
            <span className="text-xs text-gray-400">仅查询尚未回款的到期批次</span>
          </div>
        )}
      </CardContent></Card>

      {/* Order List */}
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50 hover:bg-gray-50">
              <TableHead className="text-xs font-semibold text-gray-500">客户</TableHead>
              <TableHead className="text-xs font-semibold text-gray-500">产品明细</TableHead>
              <TableHead className="text-xs font-semibold text-gray-500 text-right">数量</TableHead>
              {!isSample && <TableHead className="text-xs font-semibold text-gray-500 text-right">金额</TableHead>}
              <TableHead className="text-xs font-semibold text-gray-500 text-center">状态</TableHead>
              <TableHead className="text-xs font-semibold text-gray-500 text-right w-[120px]">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.items.map((order: any) => (
              <TableRow key={order.id} className="hover:bg-blue-50/40 transition-colors group border-b border-gray-50">
                <TableCell className="py-3">
                  <div className="flex items-center gap-1.5">
                    <div className="text-sm font-medium text-gray-900">{order.customerName}</div>
                    {order.overdueReminderCount > 0 && <span className="min-w-[16px] h-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">{order.overdueReminderCount > 99 ? "99+" : order.overdueReminderCount}</span>}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">{order.orderDate ? new Date(order.orderDate).toLocaleDateString() : "-"}</div>
                </TableCell>
                <TableCell className="py-3">
                  {(order.items ?? []).slice(0, 2).map((it: any, i: number) => {
                    const liveProduct = resolveProduct(it.productId);
                    const categoryName = liveProduct?.categoryName ?? it.categoryName ?? "";
                    const productName = liveProduct?.productName ?? it.productName ?? "";
                    const productModel = liveProduct?.productModel ?? it.productModel ?? "";
                    return (
                      <div key={i} className="text-xs text-gray-700 truncate max-w-[200px]">{categoryName ? `${categoryName}/` : ""}{productName} {productModel && `(${productModel})`}</div>
                    );
                  })}
                  {(order.items ?? []).length > 2 && <div className="text-xs text-gray-400">等{(order.items ?? []).length}种产品</div>}
                  {!(order.items ?? []).length && <div className="text-xs text-gray-500">{order.productName}</div>}
                </TableCell>
                <TableCell className="py-3 text-right"><span className="text-sm font-medium text-gray-700">{order.quantity}</span><span className="text-xs text-gray-400 ml-1">kg</span></TableCell>
                {!isSample && <TableCell className="py-3 text-right">{privacyMode ? <span className="text-sm text-gray-300 tracking-widest">****</span> : <div><div className="text-sm font-semibold text-gray-900">¥{Number(order.totalAmount).toLocaleString()}</div><div className="text-[10px] text-red-500">未收 ¥{Number(order.balance).toLocaleString()}</div></div>}</TableCell>}
                <TableCell className="py-3 text-center"><Badge className={`${statusColors[order.orderStatus] ?? ""} text-xs px-2.5 py-0.5 rounded-full`}>{order.orderStatus}</Badge></TableCell>
                <TableCell className="py-3 text-right">
                  <div className="flex justify-end gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => { setSelectedOrder(order.id); setOpenDetail(true); }}><Eye size={15} className="text-gray-500" /></Button>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEditDialog(order)}><Pencil size={15} className="text-gray-500" /></Button>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => { if (confirm("确定删除？")) deleteMutation.mutate({ id: order.id }); }}><Trash2 size={15} className="text-red-400" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {(!data || data.items.length === 0) && <TableRow><TableCell colSpan={6} className="text-center py-16 text-gray-300"><Package size={40} className="mx-auto mb-2" /><p className="text-sm">暂无{orderKind}</p></TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent></Card>

      <div className="flex items-center justify-center gap-4">
        <div className="flex items-center gap-1 text-sm text-gray-500">
          <span>每页</span>
          <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }} className="h-8 border rounded-md px-2 text-sm bg-white">
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <span>条</span>
        </div>
        {totalPages > 1 && (
          <div className="flex justify-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1}>上一页</Button>
            <span className="text-sm text-gray-500 py-2">第 {page} / {totalPages} 页（共{data?.total ?? 0}条）</span>
            <Button variant="outline" size="sm" onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages}>下一页</Button>
          </div>
        )}
      </div>

      {/* Inline Form */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-3xl max-h-[92vh] overflow-y-auto m-4">
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold flex items-center gap-2"><Package size={20} />{isEditing ? `编辑${orderKind}` : `新建${orderKind}`}</h3>
                <Button variant="ghost" size="sm" onClick={closeForm}><X size={18} /></Button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Contract Review */}
                <div className={`rounded-lg p-3 border ${formData.contractReviewed ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2"><FileText size={16} className={formData.contractReviewed ? "text-green-600" : "text-red-500"} /><h4 className="text-sm font-semibold">合同评审</h4></div>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => setFormData(p => ({ ...p, contractReviewed: !p.contractReviewed }))} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${formData.contractReviewed ? "bg-green-500" : "bg-gray-300"}`}><span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${formData.contractReviewed ? "translate-x-5" : "translate-x-0.5"}`} /></button>
                      <span className={`text-xs font-medium ${formData.contractReviewed ? "text-green-700" : "text-red-600"}`}>{formData.contractReviewed ? "已评审" : "未评审"}</span>
                    </div>
                  </div>
                </div>

                {/* Basic Info */}
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5"><Package size={15} className="text-blue-500" />基本信息</h4>
                  <div className="grid grid-cols-3 gap-3">
                    <div><Label className="text-xs text-gray-500">订单编号 *</Label><Input className="mt-1" value={formData.orderNo} onChange={e => setFormData({ ...formData, orderNo: e.target.value })} placeholder={isSample ? "SP-2026-001" : "SO-2026-001"} /></div>
                    <div><Label className="text-xs text-gray-500">客户订单号</Label><Input className="mt-1" value={formData.customerOrderNo} onChange={e => setFormData({ ...formData, customerOrderNo: e.target.value })} /></div>
                    <div><Label className="text-xs text-gray-500">订单日期 *</Label><Input className="mt-1" type="date" value={formData.orderDate} onChange={e => setFormData({ ...formData, orderDate: e.target.value })} /></div>
                  </div>
                </div>

                {/* Customer */}
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5"><Search size={15} className="text-blue-500" />客户信息 *</h4>
                  <div className="flex gap-2 items-center">
                    <div className={`flex-1 min-h-[36px] border rounded-md px-3 text-sm flex items-center ${formData.customerId ? "bg-blue-50 border-blue-200 text-blue-800" : "bg-white border-gray-200 text-gray-400"}`}>
                      {formData.customerId
                        ? (() => { const c = (customersData?.items ?? []).find((x: any) => x.id === formData.customerId); return c ? <span><span className="font-medium">{c.companyName}</span> <span className="text-xs text-gray-400 ml-1">{c.contactName}</span></span> : "请选择客户"; })()
                        : "请选择客户"}
                    </div>
                    <Button type="button" size="sm" onClick={() => { setShowCustomerPicker(true); setCustomerPickerSearch(""); }}>{formData.customerId ? "更换" : "选择"}</Button>
                  </div>
                  {showCustomerPicker && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
                      <div className="bg-white rounded-lg shadow-lg w-full max-w-md m-4 flex flex-col" style={{ maxHeight: "80vh" }}>
                        <div className="p-4 border-b flex items-center justify-between"><h4 className="font-semibold">选择客户</h4><Button variant="ghost" size="sm" onClick={() => setShowCustomerPicker(false)}><X size={16} /></Button></div>
                        <div className="p-4"><input type="text" className="w-full h-9 border rounded-md px-3 text-sm" placeholder="搜索..." value={customerPickerSearch} onChange={e => setCustomerPickerSearch(e.target.value)} autoFocus /></div>
                        <div className="flex-1 overflow-y-auto px-4 pb-4">
                          {(customersData?.items ?? []).filter((c: any) => !customerPickerSearch || c.companyName.toLowerCase().includes(customerPickerSearch.toLowerCase())).map((c: any) => (
                            <div key={c.id} className={`px-4 py-3 border-b cursor-pointer hover:bg-blue-50 ${formData.customerId === c.id ? "bg-blue-50 text-blue-700" : ""}`} onClick={() => { setFormData({ ...formData, customerId: c.id }); setShowCustomerPicker(false); }}>
                              <div className="font-medium text-sm">{c.companyName}</div><div className="text-xs text-gray-400">{c.contactName} | {c.contactPhone}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Product Items */}
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5"><ClipboardCheck size={15} className="text-indigo-500" />产品明细</h4>
                    <span className="text-xs text-gray-400">共 {items.length} 行{!isSample && ` | 合计 ¥${totalAmount.toLocaleString()}`}</span>
                  </div>
                  {/* Header */}
                  <div className={`grid ${isSample ? "grid-cols-[1fr_80px_1fr_1fr_100px_40px]" : "grid-cols-[1fr_80px_1fr_1fr_100px_100px_100px_40px]"} gap-2 text-[10px] text-gray-400 font-medium uppercase`}>
                    <span>产品名称</span><span></span><span>料号</span><span>型号</span><span className="text-right">数量(kg)</span>{!isSample && <><span className="text-right">单价</span><span className="text-right">小计</span></>}<span></span>
                  </div>
                  {items.map((it, idx) => (
                    <div key={idx} className={`grid ${isSample ? "grid-cols-[1fr_80px_1fr_1fr_100px_40px]" : "grid-cols-[1fr_80px_1fr_1fr_100px_100px_100px_40px]"} gap-2 items-start`}>
                      <Input className="text-xs" value={it.productName} onChange={e => updateItem(idx, "productName", e.target.value)} placeholder="产品名称" />
                      <select className="text-xs h-9 border rounded-md px-1 bg-white cursor-pointer" value={it.productId ?? ""} onChange={e => { if (e.target.value) selectProductForItem(idx, e.target.value); }}>
                        <option value="">选择产品</option>
                        {(productsData?.items ?? []).map((p: any) => (
                          <option key={p.id} value={p.id}>
                            {p.productName} ｜ 料号：{p.productCode || "-"} ｜ 型号：{p.productModel || "-"}
                          </option>
                        ))}
                      </select>
                      <Input className="text-xs" value={it.productCode} onChange={e => updateItem(idx, "productCode", e.target.value)} placeholder="料号" />
                      <Input className="text-xs" value={it.productModel} onChange={e => updateItem(idx, "productModel", e.target.value)} placeholder="型号" />
                      <Input className="text-xs text-right" type="number" step="0.01" value={it.quantity} onChange={e => updateItem(idx, "quantity", e.target.value)} />
                      {!isSample && <><Input className="text-xs text-right" type="number" step="0.0001" value={it.unitPrice} onChange={e => updateItem(idx, "unitPrice", e.target.value)} />
                      <Input className="text-xs text-right bg-emerald-50 font-semibold text-emerald-700" value={it.subTotal ? `¥${it.subTotal}` : "--"} readOnly /></>}
                      <button type="button" className="text-gray-300 hover:text-red-400 transition-colors pt-2" onClick={() => removeItem(idx)}><X size={14} /></button>
                    </div>
                  ))}
                  <Button type="button" size="sm" variant="outline" onClick={addItem} className="w-full text-xs"><Plus size={14} className="mr-1" />添加产品</Button>
                </div>

                {/* Additional Info */}
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5"><Truck size={15} className="text-orange-500" />附加信息</h4>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="flex items-center gap-2 p-2 border rounded-md"><input type="checkbox" id="hsi" className="w-4 h-4" checked={formData.hasShippingInfo} onChange={e => setFormData(p => ({ ...p, hasShippingInfo: e.target.checked }))} /><label htmlFor="hsi" className="text-xs cursor-pointer"><span className="font-medium">已核对收货信息</span></label></div>
                    <div className="flex items-center gap-2 p-2 border rounded-md"><input type="checkbox" id="hsr" className="w-4 h-4" checked={formData.hasSpecialRequirements} onChange={e => setFormData(p => ({ ...p, hasSpecialRequirements: e.target.checked }))} /><label htmlFor="hsr" className="text-xs cursor-pointer"><span className="font-medium">已核对特殊签收要求</span></label></div>
                    {!isSample && <div><Label className="text-xs text-gray-500">账期</Label><Select value={formData.paymentTerms} onValueChange={v => setFormData(p => ({ ...p, paymentTerms: v }))}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="0">现款</SelectItem><SelectItem value="30">30天</SelectItem><SelectItem value="60">60天</SelectItem><SelectItem value="90">90天</SelectItem></SelectContent></Select></div>}
                  </div>
                  <div><Label className="text-xs text-gray-500">备注</Label><textarea className="w-full border rounded-md p-2 text-sm mt-1" rows={2} value={formData.notes} onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))} /></div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <div className="flex-1 text-sm text-gray-500 flex items-center">{isSample ? "总数量:" : "合计:"} {!isSample && <span className="font-bold text-gray-800 ml-1">¥{totalAmount.toLocaleString()}</span>} <span className="ml-3">{totalQty} kg</span></div>
                  <Button type="button" variant="outline" onClick={closeForm}>取消</Button>
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>{isEditing ? "保存" : "创建"}</Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Payment Records Subpage */}
      {!isSample && showPaymentPage && (
        <div className="fixed inset-0 z-[70] bg-gray-50 overflow-y-auto">
          <div className="max-w-6xl mx-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold flex items-center gap-2"><CreditCard size={20} />回款记录</h2>
                <p className="text-xs text-gray-400 mt-1">{paymentPageOrderId ? `当前订单：${(allData?.items ?? []).find((o: any) => o.id === paymentPageOrderId)?.orderNo ?? detailData?.orderNo ?? "-"}` : "全部销售订单回款记录"}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => openPaymentRegistration(paymentPageOrderId ?? undefined)}><Plus size={14} className="mr-1" />登记回款</Button>
                <Button size="sm" variant="outline" onClick={() => { setShowPaymentPage(false); setShowPaymentForm(false); }}><X size={14} className="mr-1" />返回</Button>
              </div>
            </div>

            <Card><CardContent className="p-4">
              <div className="flex flex-wrap items-center gap-3">
                <Label className="text-xs text-gray-500">订单范围</Label>
                <Select value={paymentPageOrderId ? String(paymentPageOrderId) : "all"} onValueChange={value => { setPaymentPageOrderId(value === "all" ? null : Number(value)); setShowPaymentForm(false); }}>
                  <SelectTrigger className="w-[320px]"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="all">全部销售订单</SelectItem>{(allData?.items ?? []).map((order: any) => <SelectItem key={order.id} value={String(order.id)}>{order.orderNo} ｜ {order.customerName}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </CardContent></Card>

            {showPaymentForm && (
              <Card><CardContent className="p-4">
                <form onSubmit={handlePaymentSubmit} className="space-y-3">
                  <div className="flex items-center justify-between"><h3 className="text-sm font-semibold">登记回款</h3><Button type="button" variant="ghost" size="sm" onClick={() => setShowPaymentForm(false)}><X size={14} /></Button></div>
                  <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                    <div><Label className="text-xs">销售订单 *</Label><Select value={paymentForm.orderId ? String(paymentForm.orderId) : ""} onValueChange={value => openPaymentRegistration(Number(value))}><SelectTrigger><SelectValue placeholder="选择订单" /></SelectTrigger><SelectContent>{(allData?.items ?? []).map((order: any) => <SelectItem key={order.id} value={String(order.id)}>{order.orderNo} ｜ {order.customerName}</SelectItem>)}</SelectContent></Select></div>
                    <div><Label className="text-xs">回款金额 *</Label><Input type="number" min="0.01" step="0.01" value={paymentForm.amount} onChange={e => setPaymentForm(p => ({ ...p, amount: e.target.value }))} /></div>
                    <div><Label className="text-xs">回款日期 *</Label><Input type="date" value={paymentForm.paymentDate} onChange={e => setPaymentForm(p => ({ ...p, paymentDate: e.target.value }))} /></div>
                    <div><Label className="text-xs">回款方式</Label><Select value={paymentForm.paymentMethod} onValueChange={v => setPaymentForm(p => ({ ...p, paymentMethod: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["银行转账", "承兑汇票", "支票", "现金", "其他"].map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></div>
                    <div><Label className="text-xs">付款方</Label><Input value={paymentForm.payerName} onChange={e => setPaymentForm(p => ({ ...p, payerName: e.target.value }))} /></div>
                  </div>
                  <div><Label className="text-xs">备注</Label><Input value={paymentForm.notes} onChange={e => setPaymentForm(p => ({ ...p, notes: e.target.value }))} placeholder="填写本次回款备注" /></div>
                  <div className="flex justify-end"><Button type="submit" size="sm" disabled={recordPaymentMutation.isPending}>保存回款</Button></div>
                </form>
              </CardContent></Card>
            )}

            <Card><CardContent className="p-0">
              {(paymentsData?.items ?? []).length > 0 ? <Table>
                <TableHeader><TableRow><TableHead>订单号</TableHead><TableHead>客户</TableHead><TableHead>日期</TableHead><TableHead className="text-right">金额</TableHead><TableHead>方式</TableHead><TableHead>付款方 / 备注</TableHead><TableHead className="w-12" /></TableRow></TableHeader>
                <TableBody>{(paymentsData?.items ?? []).map((payment: any) => <TableRow key={payment.id}><TableCell className="font-medium">{payment.orderNo || "-"}</TableCell><TableCell>{payment.customerName || "-"}</TableCell><TableCell>{payment.paymentDate || "-"}</TableCell><TableCell className="text-right font-semibold text-green-600">{privacyMode ? "****" : `¥${Number(payment.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</TableCell><TableCell>{payment.paymentMethod || "-"}</TableCell><TableCell><div>{payment.payerName || "-"}</div>{payment.notes && <div className="text-xs text-gray-400 mt-0.5">{payment.notes}</div>}</TableCell><TableCell><Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => { if (confirm("确定删除这条回款记录？")) deletePaymentMutation.mutate({ id: payment.id }); }}><Trash2 size={14} className="text-red-400" /></Button></TableCell></TableRow>)}</TableBody>
              </Table> : <div className="py-16 text-center text-sm text-gray-400">暂无回款记录</div>}
            </CardContent></Card>
          </div>
        </div>
      )}

      {/* Detail Dialog */}
      {openDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-3xl max-h-[92vh] overflow-y-auto m-4">
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold flex items-center gap-2"><Package size={20} /> 订单详情 - {detailData?.orderNo}</h3>
                <Button variant="ghost" size="sm" onClick={() => setOpenDetail(false)}><X size={18} /></Button>
              </div>
          {detailData && (
            <div className="space-y-4">
              {/* Overview */}
              <div className="border rounded-lg p-3 bg-white">
                <div className="flex items-center justify-between mb-2"><span className="text-xs text-gray-400">{isSample ? "订单进度" : "财务概览"}</span><span className="text-xs text-gray-400">{Number(detailData.shippedTotal ?? 0).toFixed(2)} / {detailData.quantity} kg 已发</span></div>
                {!isSample && Number(detailData.actualShippedQty ?? 0) > 0 && !privacyMode && (
                  <div className="mb-2 text-sm"><span className="text-gray-400 text-xs">已发货金额:</span> <span className="font-semibold text-blue-600">¥{(Number(detailData.actualShippedQty ?? 0) * Number(detailData.unitPrice ?? 0)).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span></div>
                )}
                {!isSample && <div className="flex items-center gap-3 text-sm">
                  <div className="flex items-center gap-1"><span className="text-gray-400 text-xs">订单</span>{privacyMode ? <span className="text-sm text-gray-300 tracking-widest">****</span> : <span className="font-semibold">¥{Number(detailData.totalAmount).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>}</div>
                  <div className="w-px h-3 bg-gray-200" />
                  <div className="flex items-center gap-1"><span className="text-gray-400 text-xs">已收</span>{privacyMode ? <span className="text-sm text-gray-300 tracking-widest">****</span> : <span className="font-semibold text-green-600">¥{Number(detailData.receivedAmount).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>}</div>
                  <div className="w-px h-3 bg-gray-200" />
                  <div className="w-px h-3 bg-gray-200" />
                  <div className="flex items-center gap-1"><span className="text-gray-400 text-xs">未收</span>{privacyMode ? <span className="text-sm text-gray-300 tracking-widest">****</span> : <span className="font-semibold text-red-600">¥{Number(detailData.balance).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>}</div>
                  {(Number(detailData.refundedAmount ?? 0) > 0) && (
                    <><div className="w-px h-3 bg-gray-200" /><div className="flex items-center gap-1"><span className="text-gray-400 text-xs">退款</span>{privacyMode ? <span className="text-sm text-gray-300 tracking-widest">****</span> : <span className="font-semibold text-orange-600">¥{Number(detailData.refundedAmount).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>}</div></>
                  )}
                </div>}
              </div>

              {!isSample && (
                <div className="border rounded-lg p-3 flex items-center justify-between bg-blue-50/40">
                  <div><div className="text-sm font-medium text-gray-700 flex items-center gap-1.5"><CreditCard size={15} />回款记录</div><div className="text-xs text-gray-400 mt-1">查看历史回款或登记新的回款</div></div>
                  <Button size="sm" variant="outline" onClick={() => openPaymentPage(detailData.id)}>进入回款记录</Button>
                </div>
              )}

              {/* Product Items */}
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 text-xs font-semibold text-gray-500">产品明细</div>
                <table className="w-full text-sm whitespace-nowrap">
                  <thead><tr className="border-b"><th className="text-left px-4 py-2 text-xs text-gray-400 w-full">产品</th><th className="text-right px-3 py-2 text-xs text-gray-400">数量</th>{!isSample && !privacyMode && <><th className="text-right px-3 py-2 text-xs text-gray-400">单价</th><th className="text-right px-4 py-2 text-xs text-gray-400">小计</th></>}</tr></thead>
                  <tbody>
                    {(detailData.items ?? []).map((it: any, i: number) => {
                      const liveProduct = resolveProduct(it.productId);
                      const categoryName = liveProduct?.categoryName ?? it.categoryName ?? "";
                      const productName = liveProduct?.productName ?? it.productName ?? "";
                      const productCode = liveProduct?.productCode ?? it.productCode ?? "";
                      const productModel = liveProduct?.productModel ?? it.productModel ?? "";
                      return (
                        <tr key={i} className="border-b last:border-b-0"><td className="px-4 py-2"><div className="font-medium text-gray-800 text-sm">{categoryName ? `${categoryName}/` : ""}{productName}</div><div className="text-[10px] text-gray-400">{productCode} {productModel}</div></td><td className="px-3 py-2 text-right text-sm">{it.quantity} <span className="text-gray-400 text-xs">kg</span></td>{!isSample && !privacyMode && <><td className="px-3 py-2 text-right text-sm">¥{Number(it.unitPrice).toLocaleString()}</td><td className="px-4 py-2 text-right font-semibold text-sm">¥{Number(it.subTotal ?? it.quantity * it.unitPrice).toLocaleString()}</td></>}</tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-gray-400">客户:</span> {detailData.customerName}</div>
                <div><span className="text-gray-400">客户订单号:</span> {detailData.customerOrderNo || "-"}</div>
                <div><span className="text-gray-400">订单日期:</span> {detailData.orderDate ? new Date(detailData.orderDate).toLocaleDateString() : "-"}</div>
                {!isSample && <div><span className="text-gray-400">账期:</span> {detailData.paymentTerms === "0" || detailData.paymentTerms === 0 ? "现款" : `${detailData.paymentTerms}天`}</div>}
                <div className="col-span-2"><span className="text-gray-400">状态:</span> <Badge className={statusColors[detailData.orderStatus] ?? ""}>{detailData.orderStatus}</Badge></div>
                {detailData.notes && (
                  <div className="col-span-2 mt-1"><span className="text-gray-400">备注:</span> <span className="text-sm text-gray-600">{detailData.notes}</span></div>
                )}
              </div>

              {/* Shipments */}
              {(detailData.shipments ?? []).length > 0 && (
                <div className="space-y-3">
                  {(detailData.shipments ?? []).map((s: any, idx: number) => (
                    <div key={s.id} className="border rounded-lg bg-white">
                      <div className="flex items-center justify-between p-3 border-b bg-gray-50">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-gray-400">批次 #{idx + 1}</span>
                          <span className="font-semibold text-gray-900">{Number(s.quantity).toFixed(2)} kg</span>
                          {s.productName && <><span className="text-gray-300">|</span><span className="text-xs text-blue-600">{s.productName}</span></>}
                          {!isSample && !privacyMode && detailData.unitPrice && s.shippingStatus === "已发货" && (
                            <><span className="text-gray-300">|</span><span className="text-xs font-semibold text-emerald-600">¥{(Number(s.quantity) * Number(detailData.unitPrice)).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span></>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button className="text-gray-400 hover:text-blue-500 transition-colors" title="操作记录" onClick={() => setTimelineShipment(s)}>
                            <History size={14} />
                          </button>
                          <span className="text-xs text-gray-400">{new Date(s.shippedDate).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="p-3">
                        <div className="flex items-center gap-1 mb-3">
                          {(() => {
                            const flowType = inferFlowType(s);
                            const dims = getDimensionOrder(flowType);
                            return dims.map((dim, di) => {
                              const isComplete = s[dim] === dimensionCompleteValue[dim];
                              const currentStep = getCurrentStep(s);
                              const isCurrent = currentStep === di;
                              return (
                                <div key={dim} className="flex items-center flex-1">
                                  <div className={`flex-1 text-center py-1.5 rounded text-xs font-medium ${isComplete ? "bg-green-100 text-green-800" : isCurrent ? "bg-blue-100 text-blue-800 ring-1 ring-blue-300" : "bg-gray-100 text-gray-400"}`}>{dimensionLabels[dim]}</div>
                                  {di < dims.length - 1 && <div className={`w-4 h-0.5 flex-shrink-0 ${isComplete ? "bg-green-400" : "bg-gray-200"}`} />}
                                </div>
                              );
                            });
                          })()}
                        </div>
                        <div className="flex flex-wrap gap-2 mb-3">
                          {/* 流程维度（发货→签收） */}
                          {getDimensionOrder(inferFlowType(s)).map(dim => (
                            <div key={dim} className="flex items-center gap-1">
                              <span className="text-xs text-gray-400">{dimensionLabels[dim]}:</span>
                              <Badge className={`${dimColors[dim]?.[s[dim]] ?? "bg-gray-100 text-gray-500"} text-xs px-1.5 py-0`}>{s[dim]}</Badge>
                            </div>
                          ))}
                          {/* 售后状态 */}
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-gray-400">售后:</span>
                            <Badge className={`${afterSalesStatusColors[s.afterSalesStatus] ?? ""} text-xs px-1.5 py-0`}>{s.afterSalesStatus}</Badge>
                          </div>
                          {/* 现款订单额外显示付款/票据状态，支持独立切换 */}
                          {/* 判断是否为现款：优先用发货记录的 flowType，否则从订单 paymentTerms 推断 */}
                          {!isSample && ((s.flowType ?? (detailData.paymentTerms === "0" || detailData.paymentTerms === 0 ? "cash" : "credit")) === "cash") && (
                            <>
                              <div className="flex items-center gap-1">
                                <span className="text-xs text-gray-400">付款:</span>
                                <Button
                                  size="sm"
                                  variant={s.paymentStatus === "已支付" ? "default" : "default"}
                                  className={`h-7 text-xs px-3 py-0 rounded-full font-semibold shadow-sm transition-all ${s.paymentStatus === "已支付" ? "bg-green-600 hover:bg-green-700 text-white" : "bg-amber-500 hover:bg-amber-600 text-white animate-pulse"}`}
                                  onClick={() => openProcessAction(s, "paymentStatus", s.paymentStatus === "已支付" ? "待支付" : "已支付", s.paymentStatus === "已支付" ? "rollback" : "advance")}
                                >
                                  {s.paymentStatus === "已支付" ? "✓ 已支付" : "⚠ 待支付"}
                                </Button>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="text-xs text-gray-400">开票:</span>
                                <Button
                                  size="sm"
                                  variant={s.invoiceStatus === "已开票" ? "default" : "default"}
                                  className={`h-7 text-xs px-3 py-0 rounded-full font-semibold shadow-sm transition-all ${s.invoiceStatus === "已开票" ? "bg-blue-600 hover:bg-blue-700 text-white" : "bg-sky-500 hover:bg-sky-600 text-white animate-pulse"}`}
                                  onClick={() => openProcessAction(s, "invoiceStatus", s.invoiceStatus === "已开票" ? "待开票" : "已开票", s.invoiceStatus === "已开票" ? "rollback" : "advance")}
                                >
                                  {s.invoiceStatus === "已开票" ? "✓ 已开票" : "⚠ 待开票"}
                                </Button>
                              </div>
                            </>
                          )}
                        </div>
                        {/* 付款到期日设置 */}
                        {!isSample && <div className="flex items-center gap-2 mb-3 p-2 bg-amber-50/50 rounded-md">
                          <Clock size={12} className="text-amber-500 flex-shrink-0" />
                          <span className="text-xs text-gray-500 flex-shrink-0">付款到期日:</span>
                          {s.paymentStatus === "待支付" || s.paymentStatus === "部分付款" ? (
                            <>
                              <input
                                type="date"
                                className="h-6 w-[132px] flex-shrink-0 border rounded px-2 text-xs bg-white"
                                value={s.paymentDueDate ?? ""}
                                onChange={e => updatePaymentDueDateMutation.mutate({ orderId: detailData!.id, shipmentId: s.id, paymentDueDate: e.target.value })}
                              />
                              {s.paymentDueDate && (
                                <>
                                  {new Date(s.paymentDueDate) < new Date() ? (
                                    <Badge className="bg-red-100 text-red-600 text-[9px] px-1 py-0">已逾期</Badge>
                                  ) : (
                                    <Badge className="bg-amber-100 text-amber-600 text-[9px] px-1 py-0">
                                      剩{Math.ceil((new Date(s.paymentDueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))}天
                                    </Badge>
                                  )}
                                </>
                              )}
                            </>
                          ) : (
                            <span className="w-[132px] flex-shrink-0 text-xs text-gray-400">{s.paymentDueDate ? new Date(s.paymentDueDate).toLocaleDateString() + " (已付)" : "—"}</span>
                          )}
                        </div>}
                        <div className="flex items-center gap-2 mb-3 p-2 bg-slate-50 rounded-md">
                          <FileText size={12} className="text-slate-500 flex-shrink-0" />
                          <span className="text-xs text-gray-500 flex-shrink-0">批次备注:</span>
                          <input
                            type="text"
                            className="h-7 min-w-0 flex-1 rounded border bg-white px-2 text-xs cursor-text"
                            placeholder="填写该批次的备注，已完成批次也可以修改..."
                            value={shipmentNotes[s.id] ?? s.batchNote ?? ""}
                            onChange={event => setShipmentNotes(current => ({ ...current, [s.id]: event.target.value }))}
                            onBlur={event => {
                              const note = event.target.value.trim();
                              if (note !== (s.batchNote ?? "")) updateShipmentNoteMutation.mutate({ orderId: detailData!.id, shipmentId: s.id, note });
                            }}
                          />
                        </div>
                        <div className="flex items-center gap-2 pt-2 border-t">
                          {(() => {
                            const flowType = inferFlowType(s);
                            const dims = getDimensionOrder(flowType);
                            const step = getCurrentStep(s);
                            return (<>
                              <Button size="sm" variant="outline" className="h-7 text-xs flex-1" onClick={() => handlePrev(s)} disabled={step === 0 && s[dims[0]] === dimensionInitValue[dims[0]]}>回退</Button>
                              <Button size="sm" className="h-7 text-xs flex-1" onClick={() => handleNext(s)} disabled={step === -1}>{step === -1 ? "已完成" : `推进「${dimensionLabels[dims[step]]}」`}</Button>
                            </>);
                          })()}
                        </div>
                        {s.afterSalesStatus === "无售后" ? (
                          <button className="mt-2 text-xs text-gray-400 hover:text-red-500 transition-colors flex items-center gap-0.5" onClick={() => { setReturnShipmentId(s.id); setReturnForm({ quantity: String(s.quantity), reason: "" }); setOpenReturnForm(true); }}><RotateCcw size={11} />退货</button>
                        ) : (
                          <div className="mt-2 space-y-2">
                            <div className="p-2 bg-red-50 rounded text-xs text-red-700"><span className="font-medium">售后:</span> {s.afterSalesStatus} {s.returnQuantity && `| 退货${s.returnQuantity}kg`} {s.returnReason && `| ${s.returnReason}`}</div>
                            {/* 售后状态推进 */}
                            <div className="flex items-center gap-2">
                              {s.afterSalesStatus !== "售后申请中" && (
                                <Button size="sm" variant="outline" className="h-6 text-[10px] flex-1" onClick={() => {
                                  const prevMap: Record<string, string> = { "售后完成": "退货中", "退货中": "售后申请中" };
                                  if (prevMap[s.afterSalesStatus]) updateAfterSalesMutation.mutate({ orderId: detailData!.id, shipmentId: s.id, afterSalesStatus: prevMap[s.afterSalesStatus] });
                                }}>回退</Button>
                              )}
                              {s.afterSalesStatus !== "售后完成" && s.afterSalesStatus !== "售后关闭" && (
                                <Button size="sm" variant="outline" className="h-6 text-[10px] flex-1 border-orange-300 text-orange-600 hover:bg-orange-50" onClick={() => {
                                  const nextMap: Record<string, string> = { "售后申请中": "退货中", "退货中": "售后完成" };
                                  if (nextMap[s.afterSalesStatus]) updateAfterSalesMutation.mutate({ orderId: detailData!.id, shipmentId: s.id, afterSalesStatus: nextMap[s.afterSalesStatus] });
                                }}>
                                  {s.afterSalesStatus === "售后申请中" ? "推进「退货中」" : "推进「售后完成」"}
                                </Button>
                              )}
                              {(s.afterSalesStatus === "售后完成" || s.afterSalesStatus === "售后关闭") && (
                                <span className="text-[10px] text-green-600 flex-1 text-center">售后已完结</span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Continue Ship */}
              {Number(detailData.shippedTotal ?? 0) < Number(detailData.quantity) && (
                <Button onClick={() => { setShippingForm({ shippedQty: String(Number(detailData.quantity) - Number(detailData.shippedTotal ?? 0)), productName: (detailData.items?.[0]?.productName) ?? "", productionTime: toLocalDateTimeInput() }); setOpenShippingForm(true); }} variant="secondary" className="w-full"><ClipboardCheck size={14} className="mr-1" />安排生产数量 (剩{(Number(detailData.quantity) - Number(detailData.shippedTotal ?? 0)).toFixed(2)}kg)</Button>
              )}

              {/* 提醒面板 */}
              <div className="border rounded-lg bg-white">
                <div className="flex items-center justify-between px-4 py-2 border-b bg-amber-50">
                  <div className="flex items-center gap-2">
                    <Bell size={14} className="text-amber-600" />
                    <span className="text-xs font-semibold text-amber-700">提醒事项</span>
                    <Badge className="bg-amber-100 text-amber-700 text-[10px]">{(remindersData?.items ?? []).length}条</Badge>
                  </div>
                  <Button size="sm" variant="outline" className="h-6 text-[11px] px-2" onClick={() => { setReminderForm({ content: "", remindDate: new Date().toISOString().split("T")[0], priority: "high", type: isSample ? "发货提醒" : "对账提醒" }); setShowReminderForm(true); }}>
                    <Plus size={12} className="mr-1" />添加
                  </Button>
                </div>
                {/* 添加提醒表单 */}
                {showReminderForm && (
                  <div className="p-3 border-b bg-gray-50 space-y-2">
                    <div className="flex gap-2">
                      {/* 提醒类型下拉选择框 */}
                      <select className="h-7 border rounded-md px-2 text-xs bg-white flex-shrink-0" value={reminderForm.type} onChange={e => setReminderForm(f => ({ ...f, type: e.target.value }))}>
                        {!isSample && <option value="对账提醒">对账提醒</option>}
                        {!isSample && <option value="付款提醒">付款提醒</option>}
                        <option value="发货提醒">发货提醒</option>
                        <option value="签收提醒">签收提醒</option>
                        {!isSample && <option value="开票提醒">开票提醒</option>}
                        <option value="其他提醒">其他提醒</option>
                      </select>
                      <input type="date" className="h-7 border rounded-md px-2 text-xs flex-shrink-0" value={reminderForm.remindDate} onChange={e => setReminderForm(f => ({ ...f, remindDate: e.target.value }))} />
                    </div>
                    <textarea className="w-full border rounded-md p-2 text-xs" rows={2} placeholder="提醒内容..." value={reminderForm.content} onChange={e => setReminderForm(f => ({ ...f, content: e.target.value }))} />
                    <div className="flex gap-2">
                      <Button size="sm" className="h-7 text-[11px] px-2" onClick={() => {
                        if (!reminderForm.remindDate) { toast.error("请选择提醒日期"); return; }
                        createReminderMutation.mutate({ orderId: detailData!.id, content: reminderForm.content, remindDate: reminderForm.remindDate, priority: reminderForm.priority, type: reminderForm.type });
                        setShowReminderForm(false);
                        setReminderForm({ content: "", remindDate: "", priority: "high", type: isSample ? "发货提醒" : "对账提醒" });
                      }}>保存</Button>
                      <Button size="sm" variant="outline" className="h-7 text-[11px] px-2" onClick={() => setShowReminderForm(false)}>取消</Button>
                    </div>
                  </div>
                )}
                {/* 提醒列表 */}
                <div className="divide-y divide-gray-50">
                  {(remindersData?.items ?? []).length === 0 && (
                    <div className="text-center py-4 text-gray-300 text-xs">暂无提醒</div>
                  )}
                  {(remindersData?.items ?? []).map((r: any) => (
                    <div key={r.id} className={`flex items-start gap-2 px-4 py-2.5 ${r.isHandled ? "opacity-50" : r.isOverdue ? "bg-red-50/50" : ""}`}>
                      <button
                        className={`mt-0.5 w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${r.isHandled ? "bg-green-500 border-green-500" : "border-gray-300 hover:border-green-400"}`}
                        onClick={() => updateReminderMutation.mutate({ id: r.id, isHandled: !r.isHandled })}
                      >
                        {r.isHandled && <CheckCircle size={10} className="text-white" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          {r.type && <Badge className="bg-amber-100 text-amber-700 text-[9px] px-1 py-0">{r.type}</Badge>}
                          <p className={`text-xs ${r.isHandled ? "line-through text-gray-400" : "text-gray-700"}`}>{r.content}</p>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-gray-400">{new Date(r.remindDate).toLocaleDateString()}</span>
                          {r.isOverdue && !r.isHandled && <Badge className="bg-red-100 text-red-600 text-[9px] px-1 py-0">已逾期</Badge>}
                        </div>
                      </div>
                      <button className="text-gray-300 hover:text-red-400 transition-colors flex-shrink-0" onClick={() => { if (confirm("确定删除？")) deleteReminderMutation.mutate({ id: r.id }); }}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
            </div>
          </div>
        </div>
      )}

      {/* Production Arrangement Form */}
      <Dialog open={openShippingForm} onOpenChange={setOpenShippingForm}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><ClipboardCheck size={18} className="text-blue-500" />安排生产数量</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="bg-gray-50 rounded-lg p-3 grid grid-cols-3 gap-2 text-center">
              <div><p className="text-xs text-gray-400">订单总量</p><p className="text-sm font-bold">{detailData?.quantity} kg</p></div>
              <div><p className="text-xs text-gray-400">已安排生产</p><p className="text-sm font-bold text-green-600">{Number(detailData?.shippedTotal ?? 0).toFixed(2)} kg</p></div>
              <div><p className="text-xs text-gray-400">剩余</p><p className="text-sm font-bold text-red-600">{Number(detailData?.remainingQty ?? detailData?.quantity).toFixed(2)} kg</p></div>
            </div>
            <div>
              <Label className="text-xs text-gray-500">生产产品</Label>
              <select className="mt-1 w-full h-9 border rounded-md px-2 text-sm" value={shippingForm.productName} onChange={e => setShippingForm(p => ({ ...p, productName: e.target.value }))}>
                <option value="">选择产品</option>
                {(detailData?.items ?? []).map((it: any, i: number) => <option key={i} value={it.productName}>{it.productName} ({it.productCode})</option>)}
              </select>
            </div>
            <div><Label className="text-xs text-gray-500">本次安排生产数量 (kg) *</Label><Input className="mt-1" type="number" step="0.01" min="0.01" value={shippingForm.shippedQty} onChange={e => setShippingForm(p => ({ ...p, shippedQty: e.target.value }))} /></div>
            <div><Label className="text-xs text-gray-500">安排生产时间 *</Label><Input className="mt-1" type="datetime-local" value={shippingForm.productionTime} onChange={e => setShippingForm(p => ({ ...p, productionTime: e.target.value }))} /></div>
            <div className="flex justify-end gap-2 pt-2"><Button variant="outline" onClick={() => setOpenShippingForm(false)}>取消</Button><Button onClick={handleProductionConfirm} disabled={recordShipmentMutation.isPending}>确认安排</Button></div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Process Time Confirmation */}
      <Dialog open={!!processAction} onOpenChange={open => { if (!open && !updateShipmentStatusMutation.isPending) setProcessAction(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {processAction?.action === "rollback" ? "确认回退" : "确认流程时间"}
            </DialogTitle>
          </DialogHeader>
          {processAction && (
            <div className="space-y-4 mt-2">
              <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800">
                {processAction.action === "rollback" ? "回退" : "推进"}「{dimensionLabels[processAction.dimension]}」
                <span className="ml-2 text-xs text-blue-500">状态：{processAction.value}</span>
              </div>
              <div>
                <Label className="text-xs text-gray-500">
                  {dimensionLabels[processAction.dimension]}时间 *
                </Label>
                <Input
                  className="mt-1"
                  type="datetime-local"
                  value={processAction.time}
                  onChange={event => setProcessAction(current => current ? { ...current, time: event.target.value } : current)}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setProcessAction(null)} disabled={updateShipmentStatusMutation.isPending}>取消</Button>
                <Button onClick={confirmProcessAction} disabled={!processAction.time || updateShipmentStatusMutation.isPending}>确认</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Return Form */}
      <Dialog open={openReturnForm} onOpenChange={setOpenReturnForm}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><RotateCcw size={18} className="text-red-500" />退货</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div><Label className="text-xs text-gray-500">退货数量 (kg) *</Label><Input className="mt-1" type="number" step="0.01" value={returnForm.quantity} onChange={e => setReturnForm(p => ({ ...p, quantity: e.target.value }))} /></div>
            <div><Label className="text-xs text-gray-500">退货原因 *</Label><textarea className="w-full border rounded-md p-2 text-sm mt-1" rows={3} value={returnForm.reason} onChange={e => setReturnForm(p => ({ ...p, reason: e.target.value }))} /></div>
            <div className="flex justify-end gap-2 pt-2"><Button variant="outline" onClick={() => setOpenReturnForm(false)}>取消</Button><Button variant="destructive" onClick={() => { if (!returnForm.quantity || parseFloat(returnForm.quantity) <= 0 || !returnForm.reason.trim()) { toast.error("请填写完整"); return; } recordReturnMutation.mutate({ orderId: detailData!.id, shipmentId: returnShipmentId!, quantity: returnForm.quantity, reason: returnForm.reason }); }}>确认退货</Button></div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 导出字段选择弹窗 */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <FileText size={16} className="text-blue-500" />
              导出订单
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <p className="text-xs text-gray-400 mb-3">请选择要导出的字段（共 {data?.items?.length ?? 0} 条订单）</p>
            <div className="grid grid-cols-2 gap-2 max-h-[320px] overflow-y-auto pr-1">
              {exportFields.map(f => (
                <label key={f.key} className="flex items-center gap-2 px-3 py-2 rounded-md border hover:bg-gray-50 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={selectedFields.includes(f.key)}
                    onChange={e => {
                      if (e.target.checked) setSelectedFields(prev => [...prev, f.key]);
                      else setSelectedFields(prev => prev.filter(k => k !== f.key));
                    }}
                    className="w-4 h-4 rounded border-gray-300"
                  />
                  <span className="text-sm text-gray-700">{f.label}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-2 border-t">
            <Button size="sm" variant="outline" onClick={() => setShowExportDialog(false)}>取消</Button>
            <Button size="sm" onClick={handleExport} disabled={selectedFields.length === 0}>导出 Excel</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 批次操作时间线弹窗 */}
      <Dialog open={!!timelineShipment} onOpenChange={() => setTimelineShipment(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <History size={16} className="text-blue-500" />
              批次 #{timelineShipment ? (detailData?.shipments ?? []).findIndex((x: any) => x.id === timelineShipment.id) + 1 : ""} 操作记录
            </DialogTitle>
          </DialogHeader>
          {timelineShipment && (
            <div className="space-y-3 py-2">
              {(() => {
                const records = [
                  { label: "安排生产", date: timelineShipment.productionDate ?? timelineShipment.shippedDate },
                  { label: "发货", date: timelineShipment.shippingDate },
                  { label: "签收", date: timelineShipment.receivingDate },
                  ...(!isSample ? [
                    { label: "对账", date: timelineShipment.reconciliationDate },
                    { label: "开票", date: timelineShipment.invoiceDate },
                    { label: "付款", date: timelineShipment.paymentDate },
                  ] : []),
                ].filter(r => r.date);
                if (records.length === 0) return <div className="text-center text-gray-400 text-xs py-4">暂无操作记录</div>;
                return records.map((r, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs bg-green-100 text-green-600">
                        {i + 1}
                      </div>
                      {i < records.length - 1 && <div className="w-0.5 h-6 bg-gray-200" />}
                    </div>
                    <div className="flex-1 pb-2">
                      <span className="text-sm font-medium text-gray-700">{r.label}</span>
                      <div className="text-xs text-gray-400">{new Date(r.date).toLocaleString()}</div>
                    </div>
                  </div>
                ));
              })()}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
