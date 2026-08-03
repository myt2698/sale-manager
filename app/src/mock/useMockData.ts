import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import {
  mockCustomers,
  mockSampleOrders,
  mockSalesOrders,
  mockChecklists,
  mockPayments,
  mockDashboardStats,
  mockARAging,
  mockProducts,
  mockProductCategories,
  mockQuotationRules,
} from "./data";

// LocalStorage persistence helpers
const LS_KEYS = {
  customers: "sales-sys-customers",
  sampleOrders: "sales-sys-sampleOrders",
  salesOrders: "sales-sys-salesOrders",
  payments: "sales-sys-payments",
  checklists: "sales-sys-checklists",
  products: "sales-sys-products",
  productCategories: "sales-sys-productCategories",
  shipments: "sales-sys-shipments",
  returns: "sales-sys-returns",
  sampleShipments: "sales-sys-sampleShipments",
  sampleReturns: "sales-sys-sampleReturns",
  sampleReminders: "sales-sys-sampleReminders",
  quotationRules: "sales-sys-quotationRules",
  quotationRecords: "sales-sys-quotationRecords",
  reminders: "sales-sys-reminders",
  nextId: "sales-sys-nextId",
  initialized: "sales-sys-initialized",
};

function loadFromLS<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch { /* ignore */ }
  return fallback;
}

function saveToLS(key: string, value: any) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch { /* ignore */ }
}

function snapshotDesktopState(): Record<string, string> {
  const state: Record<string, string> = {};
  for (let index = 0; index < localStorage.length; index++) {
    const key = localStorage.key(index);
    if (key && (key.startsWith("sales-sys-") || key === "filename-generator-history")) {
      const value = localStorage.getItem(key);
      if (value !== null) state[key] = value;
    }
  }
  return state;
}

function syncDesktopState() {
  if (window.desktopAPI) {
    void window.desktopAPI.saveState(snapshotDesktopState()).catch((error) => {
      console.error("保存桌面数据失败", error);
    });
  }
}

// Initialize from LocalStorage or use mock data (only first time)
const isInit = loadFromLS<boolean>(LS_KEYS.initialized, false);

let customers = isInit ? loadFromLS(LS_KEYS.customers, mockCustomers) : [...mockCustomers];
let sampleOrders: any[] = isInit ? loadFromLS<any[]>(LS_KEYS.sampleOrders, mockSampleOrders as any[]) : [...mockSampleOrders];
let salesOrders = isInit ? loadFromLS(LS_KEYS.salesOrders, mockSalesOrders) : [...mockSalesOrders];
let payments = isInit ? loadFromLS(LS_KEYS.payments, mockPayments) : [...mockPayments];
let checklists: Record<number, any> = isInit ? loadFromLS(LS_KEYS.checklists, mockChecklists) : { ...mockChecklists };
let products = isInit ? loadFromLS(LS_KEYS.products, mockProducts) : [...mockProducts];
let productCategories = isInit ? loadFromLS(LS_KEYS.productCategories, mockProductCategories) : [...mockProductCategories];
let shipments: Record<number, any[]> = isInit ? loadFromLS(LS_KEYS.shipments, {}) : {};
let returns: Record<number, any[]> = isInit ? loadFromLS(LS_KEYS.returns, {}) : {};
let sampleShipments: Record<number, any[]> = isInit ? loadFromLS(LS_KEYS.sampleShipments, {}) : {};
let sampleReturns: Record<number, any[]> = isInit ? loadFromLS(LS_KEYS.sampleReturns, {}) : {};
let quotationRules = isInit ? loadFromLS(LS_KEYS.quotationRules, mockQuotationRules) : [...mockQuotationRules];
// Ensure "按总价报" special rule always exists
if (!quotationRules.some((r: any) => r.id === 0)) {
  quotationRules.unshift({
    id: 0, customerId: 0, customerName: "", productId: 0,
    ruleName: "按总价报", productName: "", productCode: "", productModel: "", productType: "",
    alloyFormula: [] as any[],
    pricePercent: 100, fixedPrice: 0, unit: "kg",
    notes: "直接输入总价，不计算合金价", createdAt: "1970-01-01T00:00:00.000Z",
  });
}
let quotationRecords: any[] = isInit ? loadFromLS(LS_KEYS.quotationRecords, []) : [];
let reminders: any[] = isInit ? loadFromLS(LS_KEYS.reminders, []) : [];
let sampleReminders: any[] = isInit ? loadFromLS(LS_KEYS.sampleReminders, []) : [];

// 订单搜索统一规范化：忽略大小写、全角/半角、空格和常见名称分隔符。
function normalizeOrderSearchText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("zh-CN")
    .replace(/[\s·•\-—_()（）\[\]【】《》<>,，。.、]/g, "");
}

function resolveOrderCustomerName(order: any): string {
  const customer = customers.find((item: any) => Number(item.id) === Number(order.customerId));
  return String(customer?.companyName ?? order.customerName ?? "").trim();
}

function matchesOrderSearch(order: any, search: unknown): boolean {
  const keyword = normalizeOrderSearchText(search);
  if (!keyword) return true;
  return [order.orderNo, resolveOrderCustomerName(order), order.customerName]
    .some(value => normalizeOrderSearchText(value).includes(keyword));
}

// Clean up any corrupted shipment/return records with NaN ids (from old data)
for (const key of Object.keys(shipments)) { shipments[Number(key)] = (shipments[Number(key)] ?? []).filter((s: any) => !isNaN(Number(s.id))); }
for (const key of Object.keys(returns)) { returns[Number(key)] = (returns[Number(key)] ?? []).filter((r: any) => !isNaN(Number(r.id))); }
for (const key of Object.keys(sampleShipments)) { sampleShipments[Number(key)] = (sampleShipments[Number(key)] ?? []).filter((s: any) => !isNaN(Number(s.id))); }
for (const key of Object.keys(sampleReturns)) { sampleReturns[Number(key)] = (sampleReturns[Number(key)] ?? []).filter((r: any) => !isNaN(Number(r.id))); }
// Clean up corrupted quotation records
quotationRecords = quotationRecords.filter((r: any) => !isNaN(Number(r.id)));
// Backward compat: migrate old sales orders (single product) to items array
salesOrders.forEach((o: any) => {
  if (!o.items || !Array.isArray(o.items) || o.items.length === 0) {
    o.items = [{
      productId: o.productId ?? null,
      productName: o.productName ?? "",
      productCode: o.productCode ?? "",
      productModel: o.productModel ?? "",
      quantity: Number(o.quantity ?? 0),
      unitPrice: Number(o.unitPrice ?? 0),
      subTotal: Number(o.totalAmount ?? 0),
    }];
  }
  // Ensure quantity and totalAmount are derived from items
  o.quantity = o.items.reduce((sum: number, it: any) => sum + Number(it.quantity), 0);
  o.totalAmount = o.items.reduce((sum: number, it: any) => sum + Number(it.subTotal ?? it.quantity * it.unitPrice), 0).toFixed(2);
});

// Sample orders only track products, quantities and fulfillment. Remove legacy
// pricing, payment, invoice, reconciliation and credit-term fields.
sampleOrders.forEach((o: any) => {
  if (!o.items || !Array.isArray(o.items) || o.items.length === 0) {
    o.items = [{
      productId: o.productId ?? null,
      productName: o.productName ?? "",
      productCode: o.productCode ?? "",
      productModel: o.productModel ?? "",
      quantity: Number(o.quantity ?? 0),
    }];
  }
  o.items = o.items.map((item: any) => {
    const sampleItem = { ...item };
    delete sampleItem.unitPrice;
    delete sampleItem.subTotal;
    return sampleItem;
  });
  const customer = customers.find((c: any) => c.id === o.customerId);
  o.customerName = o.customerName || customer?.companyName || "";
  o.orderDate = o.orderDate || o.createdAt || new Date().toISOString();
  o.orderStatus = o.orderStatus || o.status || "待排产";
  o.status = o.orderStatus;
  o.quantity = o.items.reduce((sum: number, it: any) => sum + Number(it.quantity ?? 0), 0);
  delete o.unitPrice;
  delete o.totalAmount;
  delete o.receivedAmount;
  delete o.invoicedAmount;
  delete o.balance;
  delete o.paymentTerms;
  o.contractReviewed = o.contractReviewed ?? true;
  o.statusHistory = Array.isArray(o.statusHistory) && o.statusHistory.length > 0
    ? o.statusHistory.map((h: any) => ({ ...h, status: h.status === "待处理" ? "待排产" : h.status }))
    : [{ status: o.orderStatus, timestamp: o.createdAt || new Date().toISOString() }];
});
Object.values(sampleShipments).flat().forEach((shipment: any) => {
  delete shipment.paymentStatus;
  delete shipment.paymentDate;
  delete shipment.paymentDueDate;
  delete shipment.receivedAmount;
  delete shipment.refundedAmount;
  delete shipment.invoiceStatus;
  delete shipment.invoiceDate;
  delete shipment.reconciliationStatus;
  delete shipment.reconciliationDate;
  delete shipment.flowType;
});
if (isInit) saveToLS(LS_KEYS.sampleOrders, sampleOrders);
// Fix: 补全所有 customerName 为空的订单（兼容历史数据）
let needsSave = false;
salesOrders.forEach((o: any) => {
  if (!o.customerName && o.customerId) {
    const customer = customers.find((c: any) => c.id === o.customerId);
    if (customer) { o.customerName = customer.companyName; needsSave = true; }
  }
  // 自动修复：旧订单没有 items 数组时，从 mock 数据补充
  if (!o.items || o.items.length === 0) {
    const mockOrder = mockSalesOrders.find((mo: any) => mo.id === o.id);
    if (mockOrder?.items) {
      o.items = mockOrder.items;
      needsSave = true;
    }
  }
});
if (needsSave) saveToLS(LS_KEYS.salesOrders, salesOrders);
// Add a cash order for testing if not exists
if (!salesOrders.some((o: any) => o.paymentTerms === "0" || o.paymentTerms === 0)) {
  salesOrders.unshift({
    id: 999,
    orderNo: "SO-CASH-001",
    customerId: 1,
    customerName: "华为技术有限公司",
    customerOrderNo: "HW-CASH-001",
    items: [
      { productId: 1, productName: "高精度传感器模块", productCode: "SENSOR-A", productModel: "A型-工业级", quantity: 1000, unitPrice: 100, subTotal: 100000 },
    ],
    quantity: 1000,
    totalAmount: "100000.00",
    productId: 1,
    productName: "高精度传感器模块",
    productCode: "SENSOR-A",
    productModel: "A型-工业级",
    unitPrice: 100,
    orderStatus: "进行中",
    paymentTerms: "0",
    contractReviewed: true,
    hasShippingInfo: true,
    hasSpecialRequirements: false,
    shippingAddress: "深圳市南山区",
    orderDate: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    invoicedAmount: "0.00",
    receivedAmount: "0.00",
    balance: 100000,
    isOverdue: false,
    overdueDays: 0,
    statusHistory: [{ status: "进行中", timestamp: new Date().toISOString() }],
  });
  // 为现款订单创建两批测试发货（第一批已付款，第二批未付款）
  shipments[999] = [
    {
      id: 9901, orderId: 999, quantity: "300", productName: "高精度传感器模块",
      logisticsCompany: "顺丰", logisticsNo: "SF001",
      shippedDate: new Date(Date.now() - 3 * 86400000).toISOString(),
      shippingStatus: "已发货", receivingStatus: "已签收",
      paymentStatus: "已支付", afterSalesStatus: "无售后",
      invoiceStatus: "已开票", reconciliationStatus: "已对账",
      flowType: "cash",
      receivedAmount: "30000.00", refundedAmount: "0.00",
      paymentDueDate: null,
    },
    {
      id: 9902, orderId: 999, quantity: "200", productName: "高精度传感器模块",
      logisticsCompany: "顺丰", logisticsNo: "SF002",
      shippedDate: new Date(Date.now() - 1 * 86400000).toISOString(),
      shippingStatus: "已发货", receivingStatus: "待签收",
      paymentStatus: "待支付", afterSalesStatus: "无售后",
      invoiceStatus: "待开票", reconciliationStatus: "已对账",
      flowType: "cash",
      receivedAmount: "0.00", refundedAmount: "0.00",
      paymentDueDate: null,
    },
  ];
}
// Backward compat: fill productName and fix pricePercent from rule for old records
quotationRecords.forEach((r: any) => {
  if (r.ruleId) {
    const rule = quotationRules.find((rule: any) => rule.id === r.ruleId);
    if (rule) {
      // Fill product info if missing
      if (!r.productName) {
        r.productName = rule.productName ?? "";
        r.productCode = rule.productCode ?? "";
        r.productModel = rule.productModel ?? "";
        r.productId = rule.productId ?? null;
      }
      // Fix pricePercent if incorrect (default 100 vs actual rule value)
      const rulePct = rule.pricePercent ?? 100;
      const recordPct = r.pricePercent ?? 100;
      if (recordPct !== rulePct) {
        r.pricePercent = rulePct;
        // Recalculate unitPrice and total with correct coefficient
        const pct = rulePct / 100;
        const alloyPrice = Number(r.alloyPrice);
        const fixedPrice = Number(r.fixedPrice);
        const quantity = Number(r.quantity);
        r.unitPrice = Math.round((alloyPrice * pct + fixedPrice) * 100) / 100;
        r.total = Math.round(r.unitPrice * quantity * 100) / 100;
      }
    }
  }
});
// Ensure nextId has all required fields (backward compatible with old data)
const defaultNextId = { customer: 100, sampleOrder: 100, salesOrder: 100, payment: 100, product: 100, shipment: 100, return: 100, sampleShipment: 100, sampleReturn: 100, quotationRule: 100, quotationRecord: 100, reminder: 100, sampleReminder: 100 };
let nextId = isInit ? { ...defaultNextId, ...loadFromLS(LS_KEYS.nextId, defaultNextId) } : { ...defaultNextId };
// Fix any NaN values caused by old data
for (const key of Object.keys(defaultNextId)) { if (typeof (nextId as any)[key] !== "number" || isNaN((nextId as any)[key])) (nextId as any)[key] = (defaultNextId as any)[key]; }

// Save initial data on first load
if (!isInit) {
  saveToLS(LS_KEYS.customers, customers);
  saveToLS(LS_KEYS.sampleOrders, sampleOrders);
  saveToLS(LS_KEYS.salesOrders, salesOrders);
  saveToLS(LS_KEYS.payments, payments);
  saveToLS(LS_KEYS.checklists, checklists);
  saveToLS(LS_KEYS.products, products);
  saveToLS(LS_KEYS.productCategories, productCategories);
  saveToLS(LS_KEYS.shipments, shipments);
  saveToLS(LS_KEYS.returns, returns);
  saveToLS(LS_KEYS.sampleShipments, sampleShipments);
  saveToLS(LS_KEYS.sampleReturns, sampleReturns);
  saveToLS(LS_KEYS.quotationRules, quotationRules);
  saveToLS(LS_KEYS.quotationRecords, quotationRecords);
  saveToLS(LS_KEYS.reminders, reminders);
  saveToLS(LS_KEYS.sampleReminders, sampleReminders);
  saveToLS(LS_KEYS.nextId, nextId);
  saveToLS(LS_KEYS.initialized, true);
}

function persistAll() {
  saveToLS(LS_KEYS.customers, customers);
  saveToLS(LS_KEYS.sampleOrders, sampleOrders);
  saveToLS(LS_KEYS.salesOrders, salesOrders);
  saveToLS(LS_KEYS.payments, payments);
  saveToLS(LS_KEYS.checklists, checklists);
  saveToLS(LS_KEYS.products, products);
  saveToLS(LS_KEYS.productCategories, productCategories);
  saveToLS(LS_KEYS.shipments, shipments);
  saveToLS(LS_KEYS.returns, returns);
  saveToLS(LS_KEYS.sampleShipments, sampleShipments);
  saveToLS(LS_KEYS.sampleReturns, sampleReturns);
  saveToLS(LS_KEYS.quotationRules, quotationRules);
  saveToLS(LS_KEYS.quotationRecords, quotationRecords);
  saveToLS(LS_KEYS.reminders, reminders);
  saveToLS(LS_KEYS.sampleReminders, sampleReminders);
  saveToLS(LS_KEYS.nextId, nextId);
  syncDesktopState();
}

// Simple wrapper for static query results (backward compat)
function queryResult<T>(data: T) {
  return { data, isLoading: false, error: null, refetch: () => {} };
}

// Force-update hook for manual refresh
function useRefresh() {
  const [, setTick] = useState(0);
  return useCallback(() => setTick((t) => t + 1), []);
}

// ===== Global refresh system =====
let globalTick = 0;
const globalListeners = new Set<() => void>();
function subscribeGlobal(listener: () => void) { globalListeners.add(listener); return () => globalListeners.delete(listener); }
export function triggerGlobal() { globalTick++; globalListeners.forEach((l) => l()); }

// Query hook that subscribes to global tick
function useMockQuery(executor: any, input?: any, opts?: any) {
  const [tick, setTick] = useState(globalTick);
  useEffect(() => { return subscribeGlobal(() => setTick(globalTick)); }, []);
  // Use refs to avoid stale closures
  const executorRef = useRef(executor);
  const inputRef = useRef(input);
  const optsRef = useRef(opts);
  executorRef.current = executor;
  inputRef.current = input;
  optsRef.current = opts;
  // Stable key for input changes
  const inputKey = JSON.stringify(input);
  const result = useMemo(() => {
    // Handle enabled option
    if (optsRef.current?.enabled === false) {
      return { data: undefined, isLoading: false, error: null, refetch: triggerGlobal };
    }
    const data = executorRef.current(inputRef.current);
    return { data, isLoading: false, error: null, refetch: triggerGlobal };
  }, [tick, inputKey]); // Re-run when global tick or input changes
  return result;
}

// Mutation hook
function useMockMutation<T = any>(
  executor: (data: T) => void,
  opts?: { onSuccess?: (data: any) => void; onError?: (err: { message: string }) => void }
) {
  const [isPending, setIsPending] = useState(false);
  const mutate = useCallback(
    (data: T) => {
      setIsPending(true);
      try { executor(data); persistAll(); triggerGlobal(); opts?.onSuccess?.({ success: true }); }
      catch (e: any) { opts?.onError?.(e); }
      finally { setTimeout(() => setIsPending(false), 100); }
    },
    [executor, opts]
  );
  return { mutate, mutateAsync: mutate, isPending, isError: false, error: null };
}

export function useMockTrpc() {
  const refresh = useRefresh();

  // --- utils ---
  const utils = {
    salesOrder: { getById: { invalidate: () => window.dispatchEvent(new CustomEvent("mock-refresh")) }, list: { invalidate: () => window.dispatchEvent(new CustomEvent("mock-refresh")) } },
    sampleOrder: { getById: { invalidate: () => window.dispatchEvent(new CustomEvent("mock-refresh")) }, list: { invalidate: () => window.dispatchEvent(new CustomEvent("mock-refresh")) } },
    customer: { list: { invalidate: () => window.dispatchEvent(new CustomEvent("mock-refresh")) } },
    finance: { listPayments: { invalidate: () => window.dispatchEvent(new CustomEvent("mock-refresh")) } },
    dashboard: { stats: { invalidate: () => window.dispatchEvent(new CustomEvent("mock-refresh")) } },
    reminder: { list: { invalidate: () => window.dispatchEvent(new CustomEvent("mock-refresh")) } },
  };

  // --- Dashboard ---
  // Shared dynamic status calculator (same logic as salesOrderList)
  function calcOrderStatus(order: any, shipmentStore: Record<number, any[]> = shipments): string {
    if (order.manualCompleted === true) return "已完成";
    const orderShipments = (shipmentStore[order.id] ?? []).map((s: any) => ({
      ...s,
      receivingStatus: s.receivingStatus ?? (s.status === "已签收" ? "已签收" : "待签收"),
      paymentStatus: s.paymentStatus ?? (s.status === "全部付款" ? "已支付" : "待支付"),
      afterSalesStatus: s.afterSalesStatus ?? "无售后",
      reconciliationStatus: s.reconciliationStatus ?? "未对账",
    }));
    const shippedTotal = orderShipments.reduce((sum: number, s: any) => sum + Number(s.quantity), 0);
    const actualShippedQty = orderShipments.filter((s: any) => s.shippingStatus === "已发货").reduce((sum: number, s: any) => sum + Number(s.quantity), 0);
    const totalQty = Number(order.quantity);
    const allShipped = shippedTotal >= totalQty;
    const hasActiveAfterSales = orderShipments.some((s: any) => s.afterSalesStatus === "售后申请中" || s.afterSalesStatus === "退货中");
    // 只有 shippingStatus="已发货" 的批次才需要判断签收状态
    const shippedOut = orderShipments.filter((s: any) => s.shippingStatus === "已发货");
    const allShippedOut = allShipped && orderShipments.every((s: any) => s.shippingStatus === "已发货");
    const anyPendingReceipt = allShippedOut && shippedOut.some((s: any) => s.receivingStatus !== "已签收");
    const allReceived = allShippedOut && shippedOut.every((s: any) => s.receivingStatus === "已签收");
    const allReconciled = allReceived && orderShipments.every((s: any) => s.reconciliationStatus === "已对账");
    const anyPendingReconciliation = allReceived && orderShipments.some((s: any) => s.reconciliationStatus !== "已对账");
    const allInvoiced = allReconciled && orderShipments.every((s: any) => s.invoiceStatus === "已开票");
    const anyPendingInvoice = allReconciled && orderShipments.some((s: any) => s.invoiceStatus !== "已开票");
    const allPaid = allInvoiced && orderShipments.every((s: any) => s.paymentStatus === "已支付");
    const anyPendingPayment = allInvoiced && orderShipments.some((s: any) => s.paymentStatus !== "已支付");
    // 有发货记录但所有批次都还未发货（shippingStatus=待发货）→ 生产中
    const hasShipments = orderShipments.length > 0;
    const allPendingShip = hasShipments && orderShipments.every((s: any) => s.shippingStatus === "待发货");
    // 部分状态判断：批次状态不一致时
    const someShippedOut = shippedOut.length > 0; // 至少有一个已发货
    const somePendingShip = orderShipments.some((s: any) => s.shippingStatus === "待发货"); // 至少有一个待发货
    const partialPendingReceipt = someShippedOut && somePendingShip; // 部分已发货 + 部分待发货 → 部分待签收
    const result = hasActiveAfterSales ? "退货中" : allPaid ? "已完成" : anyPendingReceipt ? "待签收" : anyPendingReconciliation ? "待对账" : anyPendingInvoice ? "待开票" : anyPendingPayment ? "待付款" : partialPendingReceipt ? "部分待签收" : allPendingShip ? "生产中" : "待排产";
    return result;
  }

  function calcSampleOrderStatus(order: any): string {
    if (order.manualCompleted === true) return "已完成";
    const orderShipments = (sampleShipments[order.id] ?? []).map((shipment: any) => ({
      ...shipment,
      shippingStatus: shipment.shippingStatus ?? "待发货",
      receivingStatus: shipment.receivingStatus ?? "待签收",
      afterSalesStatus: shipment.afterSalesStatus ?? "无售后",
    }));
    if (orderShipments.some((shipment: any) => shipment.afterSalesStatus === "售后申请中" || shipment.afterSalesStatus === "退货中")) return "退货中";
    if (orderShipments.length === 0) return "待排产";
    const arrangedTotal = orderShipments.reduce((sum: number, shipment: any) => sum + Number(shipment.quantity ?? 0), 0);
    const fullyArranged = arrangedTotal >= Number(order.quantity ?? 0);
    const allShipped = fullyArranged && orderShipments.every((shipment: any) => shipment.shippingStatus === "已发货");
    const allReceived = allShipped && orderShipments.every((shipment: any) => shipment.receivingStatus === "已签收");
    if (allReceived) return "已完成";
    if (allShipped) return "待签收";
    if (orderShipments.some((shipment: any) => shipment.shippingStatus === "已发货")) return "部分待签收";
    return "生产中";
  }

  const dashboardStats = {
    useQuery: (_input?: any, opts?: any) =>
      useMockQuery(() => {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        // 客户统计
        const totalCustomers = customers.length;
        const activeCustomers = customers.filter((c: any) => {
          const cl = c.checklist as any;
          if (!cl) return false;
          return Object.values(cl).every((v: any) => v === true);
        }).length;

        // 销售订单统计 - 使用动态状态计算（与订单列表一致）
        const dynamicStatuses = salesOrders.map((o: any) => calcOrderStatus(o));
        const totalOrders = salesOrders.length;
        const inProgressOrders = dynamicStatuses.filter((s: string) => s === "待排产").length;
        const pendingReceiptOrders = dynamicStatuses.filter((s: string) => s === "待签收").length;
        const pendingReconciliationOrders = dynamicStatuses.filter((s: string) => s === "待对账").length;
        const pendingPaymentOrders = dynamicStatuses.filter((s: string) => s === "待付款").length;
        const completedOrders = dynamicStatuses.filter((s: string) => s === "已完成").length;
        const afterSalesOrders = dynamicStatuses.filter((s: string) => s === "退货中").length;
        // 逾期：有 shipment 付款到期日已过且未支付，或有未处理提醒
        const nowStr = now.toISOString();
        const overdueOrders = salesOrders.filter((o: any, i: number) => {
          const orderShipments = (shipments[o.id] ?? []).map((s: any) => ({
            ...s,
            paymentStatus: s.paymentStatus ?? (s.status === "全部付款" ? "已支付" : "待支付"),
            paymentDueDate: s.paymentDueDate ?? null,
          }));
          // 逾期判断：到了付款日还未付款（只判断付款逾期，提醒逾期不算）
          const hasOverduePayment = orderShipments.some((s: any) => {
            if (s.paymentStatus !== "待支付") return false;
            if (s.paymentDueDate) return s.paymentDueDate < nowStr;
            return o.dueDate && o.dueDate < nowStr;
          });
          return hasOverduePayment;
        }).length;
        const totalAmount = salesOrders.reduce((sum: number, o: any) => sum + Number(o.totalAmount), 0);
        const receivedAmount = salesOrders.reduce((sum: number, o: any) => sum + Number(o.receivedAmount), 0);

        // 本月回款统计
        const monthPayments = payments.filter((p: any) => new Date(p.paymentDate) >= monthStart);
        const monthTotal = monthPayments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
        const sampleStatuses = sampleOrders.map((o: any) => calcSampleOrderStatus(o));

        return {
          orders: {
            total: totalOrders,
            inProgress: inProgressOrders,
            pendingReceipt: pendingReceiptOrders,
            pendingReconciliation: pendingReconciliationOrders,
            pendingPayment: pendingPaymentOrders,
            completed: completedOrders,
            afterSales: afterSalesOrders,
            overdue: overdueOrders,
            totalAmount: String(totalAmount.toFixed(2)),
            receivedAmount: String(receivedAmount.toFixed(2)),
          },
          customers: {
            total: totalCustomers,
            active: activeCustomers,
            potential: totalCustomers - activeCustomers,
          },
          payments: {
            monthTotal: String(monthTotal.toFixed(2)),
            monthCount: monthPayments.length,
          },
          sampleOrders: {
            total: sampleOrders.length,
            inProgress: sampleStatuses.filter((s: string) => ["待排产", "生产中"].includes(s)).length,
            pendingReceipt: sampleStatuses.filter((s: string) => ["待签收", "部分待签收"].includes(s)).length,
            completed: sampleStatuses.filter((s: string) => s === "已完成").length,
          },
        };
      }),
  };
  const dashboardArAging = {
    useQuery: (_input?: any, opts?: any) =>
      useMockQuery(() => {
        const now = new Date();
        const nowMs = now.getTime();
        const result = { current: { count: 0, amount: 0 }, d30: { count: 0, amount: 0 }, d60: { count: 0, amount: 0 }, d90: { count: 0, amount: 0 }, over90: { count: 0, amount: 0 } };
        salesOrders.forEach((o: any) => {
          const orderShipments = (shipments[o.id] ?? []).map((s: any) => ({
            paymentStatus: s.paymentStatus ?? (s.status === "全部付款" ? "已支付" : "待支付"),
            paymentDueDate: s.paymentDueDate ?? null,
          }));
          // 只统计待支付的 shipment
          const pendingShipments = orderShipments.filter((s: any) => s.paymentStatus === "待支付");
          if (pendingShipments.length === 0) return;
          // 计算该订单的待支付金额比例
          const totalQty = Number(o.quantity);
          const pendingQty = pendingShipments.reduce((sum: number, s: any) => {
            // 按 shipment 数量比例分配金额（简化处理）
            return sum + Number(o.totalAmount) / totalQty;
          }, 0);
          const pendingAmount = Number(o.totalAmount) - Number(o.receivedAmount ?? 0);
          if (pendingAmount <= 0) return;
          // 计算逾期天数
          let overdueDays = 0;
          const hasDueDate = pendingShipments.some((s: any) => s.paymentDueDate);
          if (hasDueDate) {
            // 取最早过期的 paymentDueDate
            const dueDates = pendingShipments
              .filter((s: any) => s.paymentDueDate)
              .map((s: any) => new Date(s.paymentDueDate).getTime());
            if (dueDates.length > 0) {
              const earliest = Math.min(...dueDates);
              overdueDays = Math.max(0, Math.ceil((nowMs - earliest) / (1000 * 60 * 60 * 24)));
            }
          } else if (o.dueDate) {
            overdueDays = Math.max(0, Math.ceil((nowMs - new Date(o.dueDate).getTime()) / (1000 * 60 * 60 * 24)));
          }
          // 归类到对应区间
          if (overdueDays <= 0) {
            result.current.count++;
            result.current.amount += pendingAmount;
          } else if (overdueDays <= 30) {
            result.d30.count++;
            result.d30.amount += pendingAmount;
          } else if (overdueDays <= 60) {
            result.d60.count++;
            result.d60.amount += pendingAmount;
          } else if (overdueDays <= 90) {
            result.d90.count++;
            result.d90.amount += pendingAmount;
          } else {
            result.over90.count++;
            result.over90.amount += pendingAmount;
          }
        });
        return result;
      }, undefined, opts),
  };
  const dashboardRecentOrders = {
    useQuery: (_input?: any, opts?: any) =>
      useMockQuery(() =>
        salesOrders.slice(0, 10).map((o) => ({
          id: o.id,
          orderNo: o.orderNo,
          orderStatus: calcOrderStatus(o),
          totalAmount: o.totalAmount,
          receivedAmount: o.receivedAmount,
          createdAt: o.createdAt,
          customerName: o.customerName,
        }))
      , undefined, opts),
  };
  const dashboardOverdueOrders = {
    useQuery: (_input?: any, opts?: any) =>
      useMockQuery(() => {
        const now = new Date();
        const nowStr = now.toISOString();
        return salesOrders
          .map((o) => ({ ...o, dynamicStatus: calcOrderStatus(o) }))
          .filter((o) => {
            const orderShipments = (shipments[o.id] ?? []).map((s: any) => ({
              paymentStatus: s.paymentStatus ?? (s.status === "全部付款" ? "已支付" : "待支付"),
              paymentDueDate: s.paymentDueDate ?? null,
            }));
            // 逾期判断：优先 paymentDueDate，未设置时回退到订单 dueDate
            const hasOverduePayment = orderShipments.some((s: any) => {
              if (s.paymentStatus !== "待支付") return false;
              if (s.paymentDueDate) return s.paymentDueDate < nowStr;
              return o.dueDate && o.dueDate < nowStr;
            });
            const orderReminders = reminders.filter((r: any) => r.orderId === o.id && !r.isHandled && r.remindDate < nowStr);
            return hasOverduePayment;
          })
          .map((o) => {
            // 计算逾期天数：取最早过期的 paymentDueDate 或 dueDate
            const orderShipments = (shipments[o.id] ?? []).map((s: any) => ({
              paymentStatus: s.paymentStatus ?? (s.status === "全部付款" ? "已支付" : "待支付"),
              paymentDueDate: s.paymentDueDate ?? null,
            }));
            const overdueDates: number[] = [];
            orderShipments.forEach((s: any) => {
              if (s.paymentStatus !== "待支付") return;
              if (s.paymentDueDate && s.paymentDueDate < nowStr) {
                overdueDates.push(new Date(s.paymentDueDate).getTime());
              } else if (!s.paymentDueDate && o.dueDate && o.dueDate < nowStr) {
                overdueDates.push(new Date(o.dueDate).getTime());
              }
            });
            const earliestOverdue = overdueDates.length > 0 ? Math.min(...overdueDates) : now.getTime();
            const overdueDays = Math.max(0, Math.ceil((now.getTime() - earliestOverdue) / (1000 * 60 * 60 * 24)));
            return {
              id: o.id,
              orderNo: o.orderNo,
              totalAmount: o.totalAmount,
              receivedAmount: o.receivedAmount,
              dueDate: o.dueDate,
              overdueDays,
              createdAt: o.createdAt,
              customerName: o.customerName,
              orderStatus: o.dynamicStatus,
            };
          });
      }, undefined, opts),
  };

  // --- Customer ---
  const customerList = {
    useQuery: (input?: any, opts?: any) =>
      useMockQuery((input?: any) => {
        const page = input?.page ?? 1;
        const pageSize = input?.pageSize ?? 20;
        let items = [...customers];
        if (input?.search) {
          items = items.filter((c: any) =>
            c.companyName.toLowerCase().includes(input.search.toLowerCase())
          );
        }
        // 按创建时间降序排列（最新的在前）
        items.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        const offset = (page - 1) * pageSize;
        return {
          items: items.slice(offset, offset + pageSize),
          total: items.length,
          page,
          pageSize,
        };
      }, input, opts),
  };

  const customerGetById = {
    useQuery: (input: { id: number }, opts?: any) =>
      useMockQuery((input: { id: number }) => {
        const c = customers.find((c: any) => c.id === input.id);
        return c ?? null;
      }, input, opts),
  };

  const customerCreate = {
    useMutation: (opts?: any) =>
      useMockMutation((data: any) => {
        const newC = {
          ...data,
          id: nextId.customer++,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        customers.push(newC as any);
// refresh removed - triggerGlobal handles it
      }, opts),
  };

  const customerUpdate = {
    useMutation: (opts?: any) =>
      useMockMutation((data: { id: number; data: any }) => {
        const idx = customers.findIndex((c: any) => c.id === data.id);
        if (idx >= 0) {
          const oldName = customers[idx].companyName;
          customers[idx] = { ...customers[idx], ...data.data, updatedAt: new Date().toISOString() } as any;
          // 如果公司名称变了，同步更新所有关联订单的 customerName
          if (data.data.companyName && data.data.companyName !== oldName) {
            salesOrders.forEach((o: any) => { if (o.customerId === data.id) o.customerName = data.data.companyName; });
            persistAll();
          }
  // refresh removed - triggerGlobal handles it
        }
      }, opts),
  };

  const customerDelete = {
    useMutation: (opts?: any) =>
      useMockMutation((data: { id: number }) => {
        customers = customers.filter((c: any) => c.id !== data.id);
// refresh removed - triggerGlobal handles it
      }, opts),
  };

  // --- Sample Order ---
  const enrichSampleOrder = (o: any) => {
    const orderShipments = sampleShipments[o.id] ?? [];
    const shippedTotal = orderShipments.reduce((sum: number, s: any) => sum + Number(s.quantity ?? 0), 0);
    const actualShippedQty = orderShipments
      .filter((s: any) => s.shippingStatus === "已发货")
      .reduce((sum: number, s: any) => sum + Number(s.quantity ?? 0), 0);
    const returnedQty = orderShipments.reduce(
      (sum: number, s: any) => sum + Number(s.returnQuantity ?? 0),
      0,
    );
    return {
      ...o,
      customerName: resolveOrderCustomerName(o) || "未知客户",
      orderStatus: calcSampleOrderStatus(o),
      status: calcSampleOrderStatus(o),
      shippedTotal: shippedTotal.toFixed(2),
      actualShippedQty: actualShippedQty.toFixed(2),
      returnedQty: returnedQty.toFixed(2),
      remainingQty: Math.max(0, Number(o.quantity ?? 0) - shippedTotal).toFixed(2),
      overdueReminderCount: sampleReminders.filter((r: any) => r.orderId === o.id && !r.isHandled && r.remindDate < new Date().toISOString()).length,
      isOverdue: false,
    };
  };

  const sampleOrderList = {
    useQuery: (input?: any, opts?: any) =>
      useMockQuery((input?: any) => {
        const page = input?.page ?? 1;
        const pageSize = input?.pageSize ?? 20;
        let items = sampleOrders.map(enrichSampleOrder);
        if (input?.search) {
          items = items.filter((o: any) => matchesOrderSearch(o, input.search));
        }
        if (input?.status) items = items.filter((o: any) => o.orderStatus === input.status);
        if (input?.customerId) items = items.filter((o: any) => o.customerId === input.customerId);
        if (input?.isOverdue !== undefined) items = items.filter((o: any) => o.isOverdue === input.isOverdue);
        if (input?.startDate) {
          const start = new Date(input.startDate).getTime();
          items = items.filter((o: any) => {
            const d = o.orderDate ? new Date(o.orderDate).getTime() : new Date(o.createdAt ?? 0).getTime();
            return d >= start;
          });
        }
        if (input?.endDate) {
          const end = new Date(input.endDate + "T23:59:59").getTime();
          items = items.filter((o: any) => {
            const d = o.orderDate ? new Date(o.orderDate).getTime() : new Date(o.createdAt ?? 0).getTime();
            return d <= end;
          });
        }
        items.sort((a: any, b: any) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
        const offset = (page - 1) * pageSize;
        return {
          items: items.slice(offset, offset + pageSize),
          total: items.length,
          page,
          pageSize,
        };
      }, input, opts),
  };

  const sampleOrderGetById = {
    useQuery: (input: { id: number }, opts?: any) =>
      useMockQuery((input: { id: number }) => {
        const order = sampleOrders.find((o) => o.id === input.id);
        if (!order) return null;
        const enriched = enrichSampleOrder(order);
        const orderShipments = (sampleShipments[input.id] ?? []).map((s: any) => ({
          ...s,
          shippingStatus: s.shippingStatus ?? "待发货",
          receivingStatus: s.receivingStatus ?? "待签收",
          afterSalesStatus: s.afterSalesStatus ?? "无售后",
        }));
        const receivedTotal = orderShipments
          .filter((s: any) => s.receivingStatus === "已签收")
          .reduce((sum: number, s: any) => sum + Number(s.quantity ?? 0), 0);
        return {
          ...enriched,
          shipments: orderShipments,
          receivedTotal: receivedTotal.toFixed(2),
          logistics: null,
          receipt: null,
          productionConfirmations: [],
        };
      }, input, opts),
  };

  const sampleOrderCreate = {
    useMutation: (opts?: any) =>
      useMockMutation((data: any) => {
        const id = nextId.sampleOrder++;
        const customer = customers.find((c: any) => c.id === data.customerId);
        const items = (data.items ?? []).map((item: any) => ({
          productId: item.productId ?? null,
          productName: item.productName ?? "",
          productCode: item.productCode ?? "",
          productModel: item.productModel ?? "",
          quantity: item.quantity,
        }));
        const firstItem = items[0] ?? {};
        const quantity = items.reduce((sum: number, it: any) => sum + Number(it.quantity ?? 0), 0);
        const now = new Date().toISOString();
        const sampleData = { ...data };
        delete sampleData.paymentTerms;
        sampleOrders.unshift({
          ...sampleData,
          id,
          items,
          quantity,
          productId: firstItem.productId ?? null,
          productName: firstItem.productName ?? "",
          productCode: firstItem.productCode ?? "",
          productModel: firstItem.productModel ?? "",
          customerName: customer?.companyName ?? data.customerName ?? "",
          orderStatus: "待排产",
          status: "待排产",
          isOverdue: false,
          overdueDays: 0,
          statusHistory: [{ status: "待排产", timestamp: now }],
          createdAt: now,
          updatedAt: now,
        } as any);
        return { id };
      }, opts),
  };

  const sampleOrderUpdate = {
    useMutation: (opts?: any) =>
      useMockMutation((data: { id: number; data: any }) => {
        const idx = sampleOrders.findIndex((o) => o.id === data.id);
        if (idx >= 0) {
          const current = sampleOrders[idx] as any;
          const update = { ...data.data };
          delete update.paymentTerms;
          delete update.unitPrice;
          delete update.totalAmount;
          delete update.receivedAmount;
          delete update.invoicedAmount;
          delete update.balance;
          if (Array.isArray(update.items)) {
            update.items = update.items.map((item: any) => ({
              productId: item.productId ?? null,
              productName: item.productName ?? "",
              productCode: item.productCode ?? "",
              productModel: item.productModel ?? "",
              quantity: item.quantity,
            }));
            const firstItem = update.items[0] ?? {};
            update.quantity = update.items.reduce((sum: number, it: any) => sum + Number(it.quantity ?? 0), 0);
            update.productId = firstItem.productId ?? null;
            update.productName = firstItem.productName ?? "";
            update.productCode = firstItem.productCode ?? "";
            update.productModel = firstItem.productModel ?? "";
          }
          if (update.customerId !== undefined) {
            update.customerName = customers.find((c: any) => c.id === update.customerId)?.companyName ?? current.customerName;
          }
          sampleOrders[idx] = { ...current, ...update, updatedAt: new Date().toISOString() } as any;
        }
      }, opts),
  };

  const sampleOrderDelete = {
    useMutation: (opts?: any) =>
      useMockMutation((data: { id: number }) => {
        sampleOrders = sampleOrders.filter((o) => o.id !== data.id);
        delete sampleShipments[data.id];
        delete sampleReturns[data.id];
        sampleReminders = sampleReminders.filter((r: any) => r.orderId !== data.id);
      }, opts),
  };

  const sampleOrderUpdateStatus = {
    useMutation: (opts?: any) =>
      useMockMutation((data: { id: number; orderStatus?: string; status?: string; logisticsCompany?: string; logisticsNo?: string; shippedDate?: string; deliveryDate?: string }) => {
        const idx = sampleOrders.findIndex((o) => o.id === data.id);
        if (idx >= 0) {
          const order = sampleOrders[idx] as any;
          const status = data.orderStatus ?? data.status ?? order.orderStatus;
          order.status = status;
          order.orderStatus = status;
          order.manualCompleted = status === "已完成";
          if (!order.statusHistory) order.statusHistory = [];
          order.statusHistory.push({ status, timestamp: new Date().toISOString() });
          if (data.logisticsCompany) order.logisticsCompany = data.logisticsCompany;
          if (data.logisticsNo) order.logisticsNo = data.logisticsNo;
          if (data.shippedDate || data.deliveryDate) order.shippedDate = data.shippedDate ?? data.deliveryDate;
        }
      }, opts),
  };

  const sampleOrderRecordShipment = {
    useMutation: (opts?: any) =>
      useMockMutation((data: { orderId: number; quantity: string; productName?: string; logisticsCompany: string; logisticsNo: string; productionTime?: string }) => {
        const order = sampleOrders.find((o: any) => o.id === data.orderId);
        if (!order) throw new Error("样品订单不存在");
        const orderShipments = sampleShipments[data.orderId] ?? [];
        const qty = Number(data.quantity);
        const shippedTotal = orderShipments.reduce((sum: number, s: any) => sum + Number(s.quantity ?? 0), 0);
        if (!Number.isFinite(qty) || qty <= 0) throw new Error("发货数量必须大于 0");
        if (shippedTotal + qty > Number(order.quantity)) throw new Error("发货数量超过样品订单剩余数量");
        order.manualCompleted = false;
        const now = data.productionTime ?? new Date().toISOString();
        const shipment = {
          id: nextId.sampleShipment++,
          orderId: data.orderId,
          quantity: qty.toFixed(2),
          productName: data.productName ?? "",
          logisticsCompany: data.logisticsCompany,
          logisticsNo: data.logisticsNo,
          shippedDate: now,
          productionDate: now,
          shippingStatus: "待发货",
          receivingStatus: "待签收",
          afterSalesStatus: "无售后",
        };
        sampleShipments[data.orderId] = [...orderShipments, shipment];
        order.logisticsCompany = data.logisticsCompany;
        order.logisticsNo = data.logisticsNo;
        return { success: true, shipment };
      }, opts),
  };

  const sampleOrderUpdateShipmentStatus = {
    useMutation: (opts?: any) =>
      useMockMutation((data: { orderId: number; shipmentId: number; dimension: string; value: string; amount?: string; occurredAt?: string }) => {
        const shipment = (sampleShipments[data.orderId] ?? []).find((s: any) => Number(s.id) === Number(data.shipmentId));
        if (!shipment) throw new Error("样品发货记录不存在");
        shipment[data.dimension] = data.value;
        shipment[data.dimension.replace("Status", "Date")] = data.occurredAt ?? new Date().toISOString();
        if (data.amount !== undefined && data.dimension === "paymentStatus") {
          shipment.receivedAmount = Number(data.amount).toFixed(2);
        }
      }, opts),
  };

  const sampleOrderRecordReturn = {
    useMutation: (opts?: any) =>
      useMockMutation((data: { orderId: number; shipmentId: number; quantity: string; reason: string }) => {
        const order = sampleOrders.find((o: any) => o.id === data.orderId);
        const shipment = (sampleShipments[data.orderId] ?? []).find((s: any) => Number(s.id) === Number(data.shipmentId));
        if (!order) throw new Error("样品订单不存在");
        if (!shipment) throw new Error("样品发货记录不存在");
        if (Number(data.quantity) > Number(shipment.quantity)) throw new Error(`退货数量不能超过该批次发货数量 ${shipment.quantity} kg`);
        shipment.afterSalesStatus = "售后申请中";
        shipment.returnQuantity = data.quantity;
        shipment.returnReason = data.reason;
        shipment.returnDate = new Date().toISOString();
        order.orderStatus = "退货中";
        order.status = "退货中";
        sampleReturns[data.orderId] = [...(sampleReturns[data.orderId] ?? []), {
          id: nextId.sampleReturn++, orderId: data.orderId, shipmentId: data.shipmentId,
          quantity: data.quantity, reason: data.reason, createdAt: new Date().toISOString(),
        }];
      }, opts),
  };

  const sampleOrderUpdateAfterSales = {
    useMutation: (opts?: any) =>
      useMockMutation((data: { orderId: number; shipmentId: number; afterSalesStatus: string }) => {
        const order = sampleOrders.find((o: any) => o.id === data.orderId);
        const orderShipments = sampleShipments[data.orderId] ?? [];
        const shipment = orderShipments.find((s: any) => Number(s.id) === Number(data.shipmentId));
        if (!shipment) throw new Error("样品发货记录不存在");
        shipment.afterSalesStatus = data.afterSalesStatus;
        if (order && orderShipments.every((s: any) => ["无售后", "售后完成", "售后关闭"].includes(s.afterSalesStatus))) {
          order.orderStatus = calcSampleOrderStatus(order);
          order.status = order.orderStatus;
        }
      }, opts),
  };

  const sampleOrderUpdatePaymentDueDate = {
    useMutation: (opts?: any) =>
      useMockMutation((data: { orderId: number; shipmentId: number; paymentDueDate: string }) => {
        const shipment = (sampleShipments[data.orderId] ?? []).find((s: any) => Number(s.id) === Number(data.shipmentId));
        if (!shipment) throw new Error("样品发货记录不存在");
        shipment.paymentDueDate = data.paymentDueDate;
      }, opts),
  };

  const sampleOrderUpdateShipmentNote = {
    useMutation: (opts?: any) =>
      useMockMutation((data: { orderId: number; shipmentId: number; note: string }) => {
        const shipment = (sampleShipments[data.orderId] ?? []).find((item: any) => Number(item.id) === Number(data.shipmentId));
        if (!shipment) throw new Error("样品发货记录不存在");
        shipment.batchNote = data.note;
      }, opts),
  };

  // --- Sales Order ---
  const salesOrderList = {
    useQuery: (input?: any, opts?: any) =>
      useMockQuery((input?: any) => {
        const page = input?.page ?? 1;
        const pageSize = input?.pageSize ?? 20;
        // 复用全局 calcOrderStatus 确保与订单详情状态一致
        const now = new Date().toISOString();
        let items = [...salesOrders].map((o: any) => {
          // 计算该订单的到期未处理提醒数量
          const overdueReminderCount = reminders.filter(
            (r: any) => r.orderId === o.id && !r.isHandled && r.remindDate < now
          ).length;
          // 计算是否有逾期付款（到了付款日还未付款）
          const orderShipments = shipments[o.id] ?? [];
          const nowMs = new Date().getTime();
          const isOverdue = orderShipments.some((s: any) => {
            const ps = s.paymentStatus ?? (s.status === "全部付款" ? "已支付" : "待支付");
            if (ps !== "待支付") return false;
            const due = s.paymentDueDate ?? o.dueDate ?? null;
            if (!due) return false;
            return new Date(due).getTime() < nowMs;
          });
          // 计算退款金额 + 从 payments 读取已收金额
          const orderRefundedAmount = orderShipments.reduce((sum: number, s: any) => sum + Number(s.refundedAmount ?? 0), 0);
          const orderPaymentsReceived = payments.filter((p) => p.orderId === o.id).reduce((s, p) => s + Number(p.amount), 0);
          const itemsTotal = (o.items ?? []).reduce((sum: number, it: any) => sum + Number(it.subTotal ?? it.quantity * it.unitPrice), 0);
          const originalTotalAmount = itemsTotal > 0 ? itemsTotal : Math.max(0, Number(o.totalAmount));
          const adjustedReceivedAmount = Math.max(0, orderPaymentsReceived - orderRefundedAmount);
          const customerName = resolveOrderCustomerName(o);
          const orderShipments2 = shipments[o.id] ?? [];
          const actualShippedQty2 = orderShipments2.filter((s: any) => s.shippingStatus === "已发货").reduce((sum: number, s: any) => sum + Number(s.quantity), 0);
          const returnedQty2 = orderShipments2.reduce((sum: number, s: any) => sum + Number(s.returnQuantity ?? 0), 0);
          return {
            ...o,
            customerName: customerName || "未知客户",
            totalAmount: String(originalTotalAmount.toFixed(2)),
            receivedAmount: String(adjustedReceivedAmount.toFixed(2)),
            refundedAmount: String(orderRefundedAmount.toFixed(2)),
            balance: Math.max(0, originalTotalAmount - orderRefundedAmount - orderPaymentsReceived),
            shippedTotal: orderShipments2.reduce((sum: number, s: any) => sum + Number(s.quantity), 0).toFixed(2),
            actualShippedQty: actualShippedQty2.toFixed(2),
            returnedQty: returnedQty2.toFixed(2),
            orderStatus: calcOrderStatus(o),
            overdueReminderCount,
            isOverdue,
          };
        });
        if (input?.search) {
          items = items.filter((o: any) => matchesOrderSearch(o, input.search));
        }
        if (input?.status) items = items.filter((o: any) => o.orderStatus === input.status);
        if (input?.customerId) items = items.filter((o: any) => o.customerId === input.customerId);
        if (input?.isOverdue !== undefined) items = items.filter((o: any) => o.isOverdue === input.isOverdue);
        if (input?.startDate) {
          const start = new Date(input.startDate).getTime();
          items = items.filter((o: any) => {
            const d = o.orderDate ? new Date(o.orderDate).getTime() : new Date(o.createdAt ?? 0).getTime();
            return d >= start;
          });
        }
        if (input?.endDate) {
          const end = new Date(input.endDate + "T23:59:59").getTime();
          items = items.filter((o: any) => {
            const d = o.orderDate ? new Date(o.orderDate).getTime() : new Date(o.createdAt ?? 0).getTime();
            return d <= end;
          });
        }
        // 按订单日期降序排列（最新的在前）
        items.sort((a: any, b: any) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
        const offset = (page - 1) * pageSize;
        return {
          items: items.slice(offset, offset + pageSize),
          total: items.length,
          page,
          pageSize,
        };
      }, input),
  };

  const salesOrderGetById = {
    useQuery: (input: { id: number }, opts?: any) =>
      useMockQuery((input: { id: number }) => {
        const order = salesOrders.find((o) => o.id === input.id);
        if (!order) return null;
        const orderShipments = (shipments[input.id] ?? []).map((s: any) => ({
          ...s,
          // 为旧数据添加五维状态默认值
          shippingStatus: s.shippingStatus ?? "已发货",
          receivingStatus: s.receivingStatus ?? (s.status === "已签收" ? "已签收" : "待签收"),
          paymentStatus: s.paymentStatus ?? (s.status === "全部付款" ? "已支付" : "待支付"),
          afterSalesStatus: s.afterSalesStatus ?? "无售后",
          invoiceStatus: s.invoiceStatus ?? "待开票",
          reconciliationStatus: s.reconciliationStatus ?? "未对账",
          receivedAmount: s.receivedAmount ?? "0.00",
          refundedAmount: s.refundedAmount ?? "0.00",
          paymentDueDate: s.paymentDueDate ?? null,
        }));
        const shippedTotal = orderShipments.reduce((sum: number, s: any) => sum + Number(s.quantity), 0);
        const actualShippedQty = orderShipments.filter((s: any) => s.shippingStatus === "已发货").reduce((sum: number, s: any) => sum + Number(s.quantity), 0);
        const returnedQty = orderShipments.reduce((sum: number, s: any) => sum + Number(s.returnQuantity ?? 0), 0);
        const orderPaymentsReceived = payments.filter((p) => p.orderId === input.id).reduce((s, p) => s + Number(p.amount), 0);
        const orderRefundedAmount = orderShipments.reduce((sum: number, s: any) => sum + Number(s.refundedAmount ?? 0), 0);
        const receivedTotal = orderShipments
          .filter((s: any) => s.receivingStatus === "已签收")
          .reduce((sum: number, s: any) => sum + Number(s.quantity), 0);

        // 复用全局 calcOrderStatus 确保与订单列表状态一致
        const orderStatus = calcOrderStatus(order);

        // 映射 statusHistory 中的旧状态
        const statusLabelMap: Record<string, string> = {
          "待排产": "待排产", "退货中": "退货中", "已完成": "已完成",
          "待签收": "待签收", "待对账": "待对账", "待开票": "待开票", "待付款": "待付款",
          "待预审": "待排产", "预审通过": "待排产", "待签约": "待排产",
          "已签约": "待排产", "生产中": "生产中", "待出库": "生产中",
          "待发货": "生产中", "已发货": "生产中",
          "已收货": "生产中", "部分付款": "生产中",
          "全部付款": "已完成", "已完结": "已完成", "已取消": "已完成", "已关闭": "已完成",
        };
        const mappedHistory = ((order as any).statusHistory ?? []).map((h: any) => ({
          ...h,
          status: statusLabelMap[h.status] ?? h.status,
        }));
        // 以 items 总金额作为原始订单金额基准
        const itemsTotal = (order.items ?? []).reduce((sum: number, it: any) => sum + Number(it.subTotal ?? it.quantity * it.unitPrice), 0);
        const originalTotalAmount = itemsTotal > 0 ? itemsTotal : Math.max(0, Number(order.totalAmount));
        const adjustedReceivedAmount = Math.max(0, orderPaymentsReceived - orderRefundedAmount);
        // 如果 customerName 为空，根据 customerId 重新查询
        let customerName = order.customerName;
        if (!customerName && order.customerId) {
          const customer = customers.find((c: any) => c.id === order.customerId);
          customerName = customer?.companyName ?? "";
        }
        return {
          ...order,
          customerName: customerName || "未知客户",
          orderStatus,
          statusHistory: mappedHistory,
          checklist: checklists[input.id] ?? null,
          logistics: null,
          receipt: null,
          productionConfirmations: [],
          totalAmount: String(originalTotalAmount.toFixed(2)),
          receivedAmount: String(adjustedReceivedAmount.toFixed(2)),
          refundedAmount: String(orderRefundedAmount.toFixed(2)),
          balance: Math.max(0, originalTotalAmount - orderRefundedAmount - orderPaymentsReceived),
          shipments: orderShipments,
          shippedTotal: shippedTotal.toFixed(2),
          actualShippedQty: actualShippedQty.toFixed(2),
          returnedQty: returnedQty.toFixed(2),
          remainingQty: (Number(order.quantity) - shippedTotal).toFixed(2),
          receivedTotal: receivedTotal.toFixed(2),
        };
      }, input),
  };

  const salesOrderCreate = {
    useMutation: (opts?: any) =>
      useMockMutation((data: any) => {
        const id = nextId.salesOrder++;
        let customerId = data.customerId;
        // 如果 customerId 为 0 或无效，使用第一个客户
        if (!customerId || customerId === 0) {
          customerId = customers[0]?.id ?? 0;
        }
        const customer = customers.find((c) => c.id === customerId);
        // items array: [{productId, productName, productCode, productModel, quantity, unitPrice, subTotal}]
        const items = data.items ?? [];
        const totalQty = items.reduce((sum: number, it: any) => sum + Number(it.quantity), 0);
        const totalAmount = items.reduce((sum: number, it: any) => sum + Number(it.subTotal), 0);
        // Backward compat: also set single-product fields from first item
        const firstItem = items[0] ?? {};
        const isCash = data.paymentTerms === "0" || data.paymentTerms === 0;
        const newOrder = {
          ...data,
          id,
          customerId,
          items,
          quantity: totalQty,
          totalAmount: totalAmount.toFixed(2),
          productId: firstItem.productId ?? null,
          productName: firstItem.productName ?? "",
          productCode: firstItem.productCode ?? "",
          productModel: firstItem.productModel ?? "",
          unitPrice: firstItem.unitPrice ?? 0,
          orderStatus: "待排产",
          invoicedAmount: "0.00",
          receivedAmount: "0.00",
          // 现款订单：订单级收款/票据状态（独立于发货批次）
          orderPaymentStatus: isCash ? "待支付" : undefined,
          orderInvoiceStatus: isCash ? "待开票" : undefined,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          customerName: customer?.companyName ?? (data.customerName || ""),
          balance: totalAmount,
          isOverdue: false,
          overdueDays: 0,
          statusHistory: [{ status: "待排产", timestamp: new Date().toISOString() }],
        };
        salesOrders.unshift(newOrder as any);
        checklists[id] = {
          orderId: id,
          quoteConfirmed: false,
          productNameChecked: false,
          productCodeChecked: false,
          quantityChecked: false,
          priceChecked: false,
          shippingAddressChecked: false,
          companyNameChecked: false,
          customerOrderNoChecked: false,
          paymentTermsChecked: false,
          financialInfoChecked: false,
          allChecked: false,
        };
        return { id };
      }, opts),
  };

  const salesOrderUpdate = {
    useMutation: (opts?: any) =>
      useMockMutation((data: { id: number; data: any }) => {
        const idx = salesOrders.findIndex((o) => o.id === data.id);
        if (idx >= 0) {
          const order = salesOrders[idx] as any;
          let updateData = { ...data.data };
          // If items provided, recalculate totals
          if (data.data.items && Array.isArray(data.data.items)) {
            const totalQty = data.data.items.reduce((sum: number, it: any) => sum + Number(it.quantity), 0);
            const totalAmount = data.data.items.reduce((sum: number, it: any) => sum + Number(it.subTotal), 0);
            const firstItem = data.data.items[0] ?? {};
            updateData.quantity = totalQty;
            updateData.totalAmount = totalAmount.toFixed(2);
            updateData.productId = firstItem.productId ?? order.productId;
            updateData.productName = firstItem.productName ?? order.productName;
            updateData.productCode = firstItem.productCode ?? order.productCode;
            updateData.productModel = firstItem.productModel ?? order.productModel;
            updateData.unitPrice = firstItem.unitPrice ?? order.unitPrice;
          }
          // 如果 customerId 变更，同步更新 customerName
          let customerName = order.customerName;
          if (data.data.customerId !== undefined && data.data.customerId !== order.customerId) {
            const customer = customers.find((c: any) => c.id === data.data.customerId);
            customerName = customer?.companyName ?? "";
          }
          // 如果更新 orderPaymentStatus/orderInvoiceStatus（现款订单收款流程）
          if (data.data.orderPaymentStatus !== undefined) {
            (salesOrders[idx] as any).orderPaymentStatus = data.data.orderPaymentStatus;
          }
          if (data.data.orderInvoiceStatus !== undefined) {
            (salesOrders[idx] as any).orderInvoiceStatus = data.data.orderInvoiceStatus;
          }
          salesOrders[idx] = { ...salesOrders[idx], ...updateData, customerName, updatedAt: new Date().toISOString() } as any;
        }
      }, opts),
  };

  const salesOrderDelete = {
    useMutation: (opts?: any) =>
      useMockMutation((data: { id: number }) => {
        salesOrders = salesOrders.filter((o) => o.id !== data.id);
// refresh removed - triggerGlobal handles it
      }, opts),
  };

  const salesOrderUpdateStatus = {
    useMutation: (opts?: any) =>
      useMockMutation((data: { id: number; orderStatus: string; logisticsCompany?: string; logisticsNo?: string; shippedDate?: string }) => {
        const idx = salesOrders.findIndex((o) => o.id === data.id);
        if (idx >= 0) {
          const order = salesOrders[idx] as any;
          order.orderStatus = data.orderStatus;
          if (!order.statusHistory) order.statusHistory = [];
          order.statusHistory.push({ status: data.orderStatus, timestamp: new Date().toISOString() });
          if (data.logisticsCompany) order.logisticsCompany = data.logisticsCompany;
          if (data.logisticsNo) order.logisticsNo = data.logisticsNo;
          if (data.shippedDate) order.shippedDate = data.shippedDate;
  // refresh removed - triggerGlobal handles it
        }
      }, opts),
  };

  const salesOrderRecordShipment = {
    useMutation: (opts?: any) =>
      useMockMutation((data: { orderId: number; quantity: string; productName?: string; logisticsCompany: string; logisticsNo: string; productionTime?: string }) => {
        const order = salesOrders.find((o) => o.id === data.orderId);
        if (!order) throw new Error("订单不存在");
        const orderShipments = shipments[data.orderId] ?? [];
        const shippedTotal = orderShipments.reduce((sum: number, s: any) => sum + Number(s.quantity), 0);
        const qty = Number(data.quantity);
        if (shippedTotal + qty > Number(order.quantity)) {
          throw new Error("安排生产数量超过订单剩余数量");
        }
        // 判断订单付款条件：现款(先款后货) vs 账期(先货后款)
        const isCashOrder = order.paymentTerms === "0" || order.paymentTerms === 0;
        // 现款订单：如果订单级付款/票据已完成，发货批次中同步设置为已完成
        const orderPaymentDone = (order as any).orderPaymentStatus === "已支付";
        const orderInvoiceDone = (order as any).orderInvoiceStatus === "已开票";
        const newShipment = {
          id: nextId.shipment++,
          orderId: data.orderId,
          quantity: String(qty.toFixed(2)),
          productName: data.productName ?? "",
          logisticsCompany: data.logisticsCompany,
          logisticsNo: data.logisticsNo,
          shippedDate: data.productionTime ?? new Date().toISOString(),
          productionDate: data.productionTime ?? new Date().toISOString(), // 记录安排生产时间
          // 五维状态体系 - 安排生产数量时统一设为"待发货"（生产中状态）
          // 后续可手动推进到"已发货"
          shippingStatus: "待发货",
          receivingStatus: "待签收",
          paymentStatus: isCashOrder && orderPaymentDone ? "已支付" : "待支付",
          afterSalesStatus: "无售后",
          invoiceStatus: isCashOrder && orderInvoiceDone ? "已开票" : "待开票",
          reconciliationStatus: isCashOrder ? "已对账" : "未对账", // 现款订单无需对账
          // 标识流程类型
          flowType: isCashOrder ? "cash" : "credit",
          // 金额
          receivedAmount: "0.00",
          refundedAmount: "0.00",
          // 付款到期日（待支付状态下设置）
          paymentDueDate: null as string | null,
        };
        shipments[data.orderId] = [...orderShipments, newShipment];
        // Update latest logistics info on order
        (order as any).logisticsCompany = data.logisticsCompany;
        (order as any).logisticsNo = data.logisticsNo;
        return { success: true, shipment: newShipment };
      }, opts),
  };

  // 更新发货批次五维状态（每维独立推进）
  const salesOrderUpdateShipmentStatus = {
    useMutation: (opts?: any) =>
      useMockMutation((data: { orderId: number; shipmentId: number; dimension: string; value: string; amount?: string; occurredAt?: string }) => {
        const orderShipments = shipments[data.orderId] ?? [];
        const shipment = orderShipments.find((s: any) => Number(s.id) === Number(data.shipmentId));
        if (!shipment) throw new Error("发货记录不存在");
        // 更新指定维度的状态
        (shipment as any)[data.dimension] = data.value;
        // 记录时间戳
        const tsKey = data.dimension.replace("Status", "Date");
        (shipment as any)[tsKey] = data.occurredAt ?? new Date().toISOString();
        // 回款金额更新
        if (data.amount !== undefined && data.dimension === "paymentStatus") {
          shipment.receivedAmount = String(Number(data.amount).toFixed(2));
        }
        // 每次推进任一流程维度后，都同步订单主状态。
        // 之前只有付款和售后会写回主状态，导致开票完成后订单仍停留在“待开票”。
        const order = salesOrders.find((o) => o.id === data.orderId);
        if (order) {
          const previousStatus = (order as any).orderStatus;
          const nextStatus = calcOrderStatus(order);
          (order as any).orderStatus = nextStatus;
          (order as any).status = nextStatus;
          if (previousStatus !== nextStatus) {
            if (!(order as any).statusHistory) (order as any).statusHistory = [];
            (order as any).statusHistory.push({
              status: nextStatus,
              timestamp: new Date().toISOString(),
            });
          }
        }
        // 支付维度更新时自动管理订单主状态
        if (data.dimension === "paymentStatus") {
          if (order) {
            const shippedTotal = orderShipments.reduce((sum: number, s: any) => sum + Number(s.quantity), 0);
            const fullyShipped = shippedTotal >= Number(order.quantity);
            const hasAfterSales = orderShipments.some((s: any) => s.afterSalesStatus !== "无售后" && s.afterSalesStatus !== "售后关闭");
            // 有未关闭的售后 → 订单变为进行中
            if (hasAfterSales) {
              (order as any).orderStatus = "待排产";
            } else if (data.value === "已支付" && fullyShipped) {
              // 全部发完且全部支付 → 已完成
              const allPaid = orderShipments.every((s: any) => s.paymentStatus === "已支付");
              if (allPaid) {
                (order as any).orderStatus = "已完成";
              }
            }
          }
        }
        // 售后维度更新时自动管理订单主状态
        if (data.dimension === "afterSalesStatus" && data.value === "售后完成") {
          const order = salesOrders.find((o) => o.id === data.orderId);
          if (order) {
            const hasActiveAfterSales = orderShipments.some((s: any) => s.afterSalesStatus === "售后申请中" || s.afterSalesStatus === "退货中");
            const shippedTotal = orderShipments.reduce((sum: number, s: any) => sum + Number(s.quantity), 0);
            const fullyShipped = shippedTotal >= Number(order.quantity);
            const allReceived = fullyShipped && orderShipments.every((s: any) => s.receivingStatus === "已签收");
            const allPaid = fullyShipped && orderShipments.every((s: any) => s.paymentStatus === "已支付");
            const allReconciled = allReceived && orderShipments.every((s: any) => s.reconciliationStatus === "已对账");
            if (!hasActiveAfterSales) {
              if (fullyShipped && allReceived && allPaid && allReconciled) {
                (order as any).orderStatus = "已完成";
              } else if (allReceived && !allReconciled) {
                (order as any).orderStatus = "待对账";
              } else if (fullyShipped && !allPaid) {
                (order as any).orderStatus = "待付款";
              } else if (fullyShipped && !allReceived) {
                (order as any).orderStatus = "待签收";
              } else {
                (order as any).orderStatus = "待排产";
              }
            }
          }
        }
// refresh removed - triggerGlobal handles it
        return { success: true };
      }, opts),
  };

  // --- Returns (整合到 shipment 的五维状态中) ---
  // 退货不再创建独立记录，而是更新 shipment 的 afterSalesStatus
  const salesOrderRecordReturn = {
    useMutation: (opts?: any) =>
      useMockMutation((data: { orderId: number; shipmentId: number; quantity: string; reason: string }) => {
        const order = salesOrders.find((o) => o.id === data.orderId);
        if (!order) throw new Error("订单不存在");
        const orderShipments = shipments[data.orderId] ?? [];
        const shipment = orderShipments.find((s: any) => Number(s.id) === Number(data.shipmentId));
        if (!shipment) throw new Error("发货记录不存在");
        if (Number(data.quantity) > Number(shipment.quantity)) {
          throw new Error(`退货数量不能超过该批次发货数量 ${shipment.quantity} kg`);
        }
        // 更新售后维度状态
        shipment.afterSalesStatus = "售后申请中";
        shipment.returnQuantity = data.quantity;
        shipment.returnReason = data.reason;
        shipment.returnDate = new Date().toISOString();
        // 有退货发生时，订单状态变为退货中
        (order as any).orderStatus = "退货中";
// refresh removed - triggerGlobal handles it
        return { success: true };
      }, opts),
  };

  // 更新发货批次售后状态
  const salesOrderUpdateAfterSales = {
    useMutation: (opts?: any) =>
      useMockMutation((data: { orderId: number; shipmentId: number; afterSalesStatus: string }) => {
        const orderShipments = shipments[data.orderId] ?? [];
        const shipment = orderShipments.find((s: any) => Number(s.id) === Number(data.shipmentId));
        if (!shipment) throw new Error("发货记录不存在");
        shipment.afterSalesStatus = data.afterSalesStatus;
        // 售后完成时，记录退款金额到 shipment
        if (data.afterSalesStatus === "售后完成") {
          const order = salesOrders.find((o) => o.id === data.orderId);
          if (order && shipment.returnQuantity) {
            const unitPrice = Number(order.unitPrice ?? 0);
            const refundAmount = Number(shipment.returnQuantity) * unitPrice;
            if (refundAmount > 0) {
              shipment.refundedAmount = String(refundAmount.toFixed(2));
            }
          }
        }
        // 如果所有售后都已完成，恢复订单状态
        if (data.afterSalesStatus === "售后完成" || data.afterSalesStatus === "售后关闭") {
          const order = salesOrders.find((o) => o.id === data.orderId);
          if (order) {
            const allResolved = orderShipments.every(
              (s: any) => s.afterSalesStatus === "无售后" || s.afterSalesStatus === "售后完成" || s.afterSalesStatus === "售后关闭"
            );
            if (allResolved) {
              (order as any).orderStatus = "已完成";
            }
          }
        }
        return { success: true };
      }, opts),
  };

  // 设置发货批次的付款到期日
  const salesOrderUpdatePaymentDueDate = {
    useMutation: (opts?: any) =>
      useMockMutation((data: { orderId: number; shipmentId: number; paymentDueDate: string }) => {
        const orderShipments = shipments[data.orderId] ?? [];
        const shipment = orderShipments.find((s: any) => Number(s.id) === Number(data.shipmentId));
        if (!shipment) throw new Error("发货记录不存在");
        shipment.paymentDueDate = data.paymentDueDate;
        return { success: true };
      }, opts),
  };

  // --- Finance ---
  const financeListPayments = {
    useQuery: (input?: any, opts?: any) =>
      useMockQuery((input?: any) => {
        let items = [...payments];
        if (input?.orderId) items = items.filter((p) => p.orderId === input.orderId);
        // 关联订单客户名称
        const enrichedItems = items.map((p: any) => {
          const order = salesOrders.find((o: any) => o.id === p.orderId);
          return {
            ...p,
            customerName: order?.customerName ?? "",
            orderNo: order?.orderNo ?? "",
          };
        });
        return { items: enrichedItems, total: enrichedItems.length, page: 1, pageSize: 50 };
      }, input, opts),
  };

  const financeRecordPayment = {
    useMutation: (opts?: any) =>
      useMockMutation((data: any) => {
        const id = nextId.payment++;
        payments.push({ ...data, id } as any);
        const order = salesOrders.find((o) => o.id === data.orderId);
        if (order) {
          const orderPayments = payments.filter((p) => p.orderId === data.orderId);
          const totalReceived = orderPayments.reduce((s, p) => s + Number(p.amount), 0);
          // 计算退款金额
          const orderShipments = shipments[data.orderId] ?? [];
          const orderRefundedAmount = orderShipments.reduce((sum: number, s: any) => sum + Number(s.refundedAmount ?? 0), 0);
          // 以 items 总金额为原始订单金额基准
          const itemsTotal = (order.items ?? []).reduce((sum: number, it: any) => sum + Number(it.subTotal ?? it.quantity * it.unitPrice), 0);
          const originalTotalAmount = itemsTotal > 0 ? itemsTotal : Math.max(0, Number(order.totalAmount));
          let newStatus = "待付款";
          if (totalReceived >= originalTotalAmount - orderRefundedAmount) newStatus = "全部付款";
          else if (totalReceived > 0) newStatus = "部分付款";
          (order as any).receivedAmount = String(Math.max(0, totalReceived - orderRefundedAmount).toFixed(2));
          (order as any).orderStatus = newStatus;
          (order as any).balance = Math.max(0, originalTotalAmount - orderRefundedAmount - totalReceived);
        }
// refresh removed - triggerGlobal handles it
      }, opts),
  };

  const financeDeletePayment = {
    useMutation: (opts?: any) =>
      useMockMutation((data: { id: number }) => {
        const p = payments.find((x) => x.id === data.id);
        payments = payments.filter((x) => x.id !== data.id);
        if (p) {
          const order = salesOrders.find((o) => o.id === p.orderId);
          if (order) {
            const orderPayments = payments.filter((x) => x.orderId === p.orderId);
            const totalReceived = orderPayments.reduce((s, x) => s + Number(x.amount), 0);
            // 计算退款金额
            const orderShipments = shipments[p.orderId] ?? [];
            const orderRefundedAmount = orderShipments.reduce((sum: number, s: any) => sum + Number(s.refundedAmount ?? 0), 0);
            // 以 items 总金额为原始订单金额基准
            const itemsTotal = (order.items ?? []).reduce((sum: number, it: any) => sum + Number(it.subTotal ?? it.quantity * it.unitPrice), 0);
            const originalTotalAmount = itemsTotal > 0 ? itemsTotal : Math.max(0, Number(order.totalAmount));
            let newStatus = "待付款";
            if (totalReceived >= originalTotalAmount - orderRefundedAmount) newStatus = "全部付款";
            else if (totalReceived > 0) newStatus = "部分付款";
            (order as any).receivedAmount = String(Math.max(0, totalReceived - orderRefundedAmount).toFixed(2));
            (order as any).orderStatus = newStatus;
            (order as any).balance = Math.max(0, originalTotalAmount - orderRefundedAmount - totalReceived);
          }
        }
// refresh removed - triggerGlobal handles it
      }, opts),
  };

  // --- Quotation Rules ---
  const quotationRuleList = {
    useQuery: (input?: any, opts?: any) =>
      useMockQuery((input?: any) => {
        let items = [...quotationRules].map((r: any) => ({
          ...r,
          pricePercent: r.pricePercent ?? 100, // 兼容旧数据，默认100%
        }));
        if (input?.search) {
          const q = input.search.toLowerCase();
          items = items.filter((r: any) =>
            r.ruleName.toLowerCase().includes(q) ||
            r.customerName?.toLowerCase().includes(q) ||
            r.metalType?.toLowerCase().includes(q) ||
            r.productType?.toLowerCase().includes(q)
          );
        }
        return { items, total: items.length, page: 1, pageSize: 50 };
      }, input, opts),
  };

  const quotationRuleCreate = {
    useMutation: (opts?: any) =>
      useMockMutation((data: any) => {
        const id = nextId.quotationRule++;
        const customer = customers.find((c: any) => c.id === data.customerId);
        const product = products.find((p: any) => p.id === data.productId);
        const newRule = { ...data, id, customerName: customer?.companyName ?? "", productName: product?.productName ?? data.productName ?? "", productCode: product?.productCode ?? data.productCode ?? "", productModel: product?.productModel ?? data.productModel ?? "", createdAt: new Date().toISOString() };
        quotationRules.push(newRule as any);
// refresh removed - triggerGlobal handles it
        return newRule;
      }, opts),
  };

  const quotationRuleUpdate = {
    useMutation: (opts?: any) =>
      useMockMutation((data: any) => {
        const idx = quotationRules.findIndex((r: any) => r.id === data.id);
        if (idx >= 0) {
          const customer = customers.find((c: any) => c.id === (data.customerId ?? quotationRules[idx].customerId));
          const product = data.productId ? products.find((p: any) => p.id === data.productId) : null;
          quotationRules[idx] = { ...quotationRules[idx], ...data, customerName: customer?.companyName ?? quotationRules[idx].customerName, productName: product?.productName ?? data.productName ?? quotationRules[idx].productName, productCode: product?.productCode ?? data.productCode ?? quotationRules[idx].productCode, productModel: product?.productModel ?? data.productModel ?? quotationRules[idx].productModel, updatedAt: new Date().toISOString() };
  // refresh removed - triggerGlobal handles it
        }
        return { success: true };
      }, opts),
  };

  const quotationRuleDelete = {
    useMutation: (opts?: any) =>
      useMockMutation((data: { id: number }) => {
        quotationRules = quotationRules.filter((r: any) => r.id !== data.id) as any[];
// refresh removed - triggerGlobal handles it
        return { success: true };
      }, opts),
  };

  // --- Quotation Records ---
  const quotationRecordList = {
    useQuery: (input?: any, opts?: any) =>
      useMockQuery((input?: any) => {
        let items = [...quotationRecords];
        if (input?.customerId) items = items.filter((r: any) => r.customerId === input.customerId);
        if (input?.isSuccessful !== undefined) {
          items = items.filter((r: any) => {
            const val = r.isSuccessful ?? true; // undefined defaults to true (成交)
            return val === input.isSuccessful;
          });
        }
        if (input?.search) {
          const q = input.search.toLowerCase();
          items = items.filter((r: any) =>
            r.customerName?.toLowerCase().includes(q) ||
            r.ruleName?.toLowerCase().includes(q)
          );
        }
        items.sort((a: any, b: any) => new Date(b.quotedAt).getTime() - new Date(a.quotedAt).getTime());
        return { items, total: items.length, page: 1, pageSize: 50 };
      }, input, opts),
  };

  const quotationRecordCreate = {
    useMutation: (opts?: any) =>
      useMockMutation((data: any) => {
        const id = nextId.quotationRecord++;
        const rule = quotationRules.find((r: any) => r.id === data.ruleId);
        // For special rules (id=0 "按总价报"), use data.customerId from frontend
        // For normal rules, prefer rule's customerId, fall back to data.customerId
        const effectiveCustomerId = (rule && rule.customerId > 0) ? rule.customerId : data.customerId;
        const customer = customers.find((c: any) => c.id === effectiveCustomerId);
        // Helper: use rule value if non-empty, else fall back to data value
        const pick = (ruleVal: any, dataVal: any) => {
          if (ruleVal !== undefined && ruleVal !== null && ruleVal !== "") return ruleVal;
          if (dataVal !== undefined && dataVal !== null && dataVal !== "") return dataVal;
          return "";
        };
        const newRecord = {
          ...data,
          id,
          customerId: customer?.id ?? data.customerId,
          customerName: customer?.companyName ?? data.customerName ?? "",
          ruleName: rule?.ruleName ?? data.ruleName ?? "",
          productId: pick(rule?.productId, data.productId) || null,
          productName: pick(rule?.productName, data.productName),
          productCode: pick(rule?.productCode, data.productCode),
          productModel: pick(rule?.productModel, data.productModel),
          alloyFormula: rule?.alloyFormula ?? data.alloyFormula ?? [],
          // For "按总价报" (id=0), use frontend's fixedPrice (markup); for normal rules use rule's fixedPrice
          fixedPrice: (rule && rule.id > 0) ? (rule?.fixedPrice ?? data.fixedPrice ?? 0) : (data.fixedPrice ?? 0),
          unit: rule?.unit ?? data.unit ?? "kg",
          quotedAt: new Date().toISOString(),
          editHistory: [] as any[],
          isSuccessful: data.isSuccessful ?? true,
        };
        quotationRecords.unshift(newRecord);
// refresh removed - triggerGlobal handles it
        return newRecord;
      }, opts),
  };

  const quotationRecordUpdate = {
    useMutation: (opts?: any) =>
      useMockMutation((data: { id: number; fixedPrice?: number; total?: number }) => {
        const idx = quotationRecords.findIndex((r: any) => r.id === data.id);
        if (idx < 0) throw new Error("记录不存在");
        const record = quotationRecords[idx];
        const pct = (record.pricePercent ?? 100) / 100;
        const alloyPrice = Number(record.alloyPrice);
        const quantity = Number(record.quantity);
        const oldFixedPrice = Number(record.fixedPrice);
        const oldUnitPrice = record.unitPrice;
        const oldTotal = record.total;
        let newFixedPrice: number;
        let newUnitPrice: number;
        let newTotal: number;
        let editType = "";

        if (data.total !== undefined) {
          // Mode: modify total price directly, reverse-calculate fixedPrice
          editType = "修改总价";
          newTotal = data.total;
          newUnitPrice = Math.round(newTotal / quantity * 100) / 100;
          newFixedPrice = Math.round((newUnitPrice - alloyPrice * pct) * 100) / 100;
        } else if (data.fixedPrice !== undefined) {
          // Mode: modify fixed price
          editType = "修改加价";
          newFixedPrice = data.fixedPrice;
          newUnitPrice = Math.round((alloyPrice * pct + newFixedPrice) * 100) / 100;
          newTotal = Math.round(newUnitPrice * quantity * 100) / 100;
        } else {
          throw new Error("请提供 fixedPrice 或 total");
        }

        // Save edit history
        const historyEntry = {
          id: (record.editHistory?.length ?? 0) + 1,
          editType,
          oldFixedPrice,
          newFixedPrice,
          oldUnitPrice,
          newUnitPrice,
          oldTotal,
          newTotal,
          editedAt: new Date().toISOString(),
        };
        record.fixedPrice = String(newFixedPrice.toFixed(2));
        record.unitPrice = newUnitPrice;
        record.total = newTotal;
        record.editHistory = [...(record.editHistory ?? []), historyEntry];
        record.updatedAt = new Date().toISOString();
// refresh removed - triggerGlobal handles it
        return { success: true };
      }, opts),
  };

  const quotationRecordUpdateStatus = {
    useMutation: (opts?: any) =>
      useMockMutation((data: { id: number; isSuccessful: boolean }) => {
        const idx = quotationRecords.findIndex((r: any) => r.id === data.id);
        if (idx < 0) throw new Error("记录不存在");
        quotationRecords[idx].isSuccessful = data.isSuccessful;
        quotationRecords[idx].updatedAt = new Date().toISOString();
      }, opts),
  };

  const quotationRecordDelete = {
    useMutation: (opts?: any) =>
      useMockMutation((data: { id: number }) => {
        quotationRecords = quotationRecords.filter((r: any) => r.id !== data.id);
// refresh removed - triggerGlobal handles it
        return { success: true };
      }, opts),
  };

  // --- Metal Prices ---
  // 基础金属定义
  const metalNameMap: Record<string, string> = { Sn: "锡", Ag: "银", Cu: "铜", Pb: "铅", Sb: "锑" };
  // 合金定义：名称 -> 成分比例
  const alloyDefinitions: Record<string, Record<string, number>> = {
    "Sn96.5Ag3.0Cu0.5": { Sn: 0.965, Ag: 0.03, Cu: 0.005 },
    "Sn98.5Ag1.0Cu0.5": { Sn: 0.985, Ag: 0.01, Cu: 0.005 },
    "Sn99Ag0.3Cu0.7": { Sn: 0.99, Ag: 0.003, Cu: 0.007 },
    "Sn63Pb37": { Sn: 0.63, Pb: 0.37 },
    "Pb75.5Sn16Sb7.5Ag1": { Pb: 0.755, Sn: 0.16, Sb: 0.075, Ag: 0.01 },
    "Pb92.5Sn5Ag2.5": { Pb: 0.925, Sn: 0.05, Ag: 0.025 },
  };

  let metalPrices: any[] = isInit ? loadFromLS("sales-sys-metalPrices", []) : [];

  function calcAlloyPrice(alloyName: string, metalPricesRecord: Record<string, number>): number {
    const formula = alloyDefinitions[alloyName];
    if (!formula) return 0;
    let total = 0;
    for (const [metal, ratio] of Object.entries(formula)) {
      total += (metalPricesRecord[metal] ?? 0) * ratio;
    }
    return Math.round(total * 100) / 100;
  }

  const metalPriceSave = {
    useMutation: (opts?: any) =>
      useMockMutation((data: { date: string; prices: Record<string, number> }) => {
        const idx = metalPrices.findIndex((m: any) => m.date === data.date);
        const alloyPrices: Record<string, number> = {};
        for (const alloyName of Object.keys(alloyDefinitions)) {
          alloyPrices[alloyName] = calcAlloyPrice(alloyName, data.prices);
        }
        if (idx >= 0) {
          metalPrices[idx] = { ...metalPrices[idx], prices: data.prices, alloyPrices };
        } else {
          metalPrices.push({ date: data.date, prices: data.prices, alloyPrices });
        }
        // Sort by date
        metalPrices.sort((a: any, b: any) => a.date.localeCompare(b.date));
        saveToLS("sales-sys-metalPrices", metalPrices);
        return { success: true };
      }, opts),
  };

  const metalPriceList = {
    useQuery: (input?: any, opts?: any) =>
      useMockQuery((input?: any) => {
        let items = [...metalPrices];
        if (input?.yearMonth) {
          items = items.filter((m: any) => m.date.startsWith(input.yearMonth));
        }
        // Sort desc
        items.sort((a: any, b: any) => b.date.localeCompare(a.date));
        return { items, total: items.length };
      }, input, opts),
  };

  const metalPriceMonthlyAvg = {
    useQuery: (input?: any, opts?: any) =>
      useMockQuery((input?: any) => {
        const targetMonth = input?.yearMonth ?? new Date().toISOString().slice(0, 7);
        const items = metalPrices.filter((m: any) => m.date.startsWith(targetMonth));
        if (items.length === 0) return { month: targetMonth, metalAvgs: {}, alloyAvgs: {}, count: 0 };
        // Avg for each base metal
        const metalSums: Record<string, number> = {};
        const metalCounts: Record<string, number> = {};
        const alloySums: Record<string, number> = {};
        const alloyCounts: Record<string, number> = {};
        items.forEach((m: any) => {
          for (const [metal, price] of Object.entries(m.prices ?? {})) {
            if (typeof price === "number" && price > 0) {
              metalSums[metal] = (metalSums[metal] ?? 0) + price;
              metalCounts[metal] = (metalCounts[metal] ?? 0) + 1;
            }
          }
          for (const [alloy, price] of Object.entries(m.alloyPrices ?? {})) {
            if (typeof price === "number" && price > 0) {
              alloySums[alloy] = (alloySums[alloy] ?? 0) + price;
              alloyCounts[alloy] = (alloyCounts[alloy] ?? 0) + 1;
            }
          }
        });
        const metalAvgs: Record<string, number> = {};
        for (const metal of Object.keys(metalSums)) {
          metalAvgs[metal] = Math.round((metalSums[metal] / metalCounts[metal]) * 100) / 100;
        }
        const alloyAvgs: Record<string, number> = {};
        for (const alloy of Object.keys(alloySums)) {
          alloyAvgs[alloy] = Math.round((alloySums[alloy] / alloyCounts[alloy]) * 100) / 100;
        }
        return { month: targetMonth, metalAvgs, alloyAvgs, count: items.length };
      }, input, opts),
  };

  const metalPriceChartData = {
    useQuery: (input?: any, opts?: any) =>
      useMockQuery((input?: any) => {
        const dimension = input?.dimension ?? "month"; // week | month | year
        const now = new Date();
        const result: any[] = [];

        if (dimension === "week") {
          // 近8周，每天的数据点
          const start = new Date(now.getTime() - 56 * 24 * 60 * 60 * 1000);
          const items = metalPrices.filter((m: any) => m.date >= start.toISOString().slice(0, 10));
          items.forEach((m: any) => {
            const entry: any = { date: m.date.slice(5) }; // MM-DD
            for (const [k, v] of Object.entries(m.prices ?? {})) entry[k] = v;
            for (const [k, v] of Object.entries(m.alloyPrices ?? {})) entry[k] = v;
            result.push(entry);
          });
        } else if (dimension === "month") {
          // 近12个月，每天的数据点
          const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
          const startStr = start.toISOString().slice(0, 10);
          const items = metalPrices.filter((m: any) => m.date >= startStr);
          items.forEach((m: any) => {
            const entry: any = { date: m.date.slice(5) }; // MM-DD
            for (const [k, v] of Object.entries(m.prices ?? {})) entry[k] = v;
            for (const [k, v] of Object.entries(m.alloyPrices ?? {})) entry[k] = v;
            result.push(entry);
          });
        } else if (dimension === "year") {
          // 近5年，每月均价
          const years = input?.years ?? 5;
          for (let i = years - 1; i >= 0; i--) {
            const d = new Date(now.getFullYear() - i, 0, 1);
            for (let month = 0; month < 12; month++) {
              const ym = `${d.getFullYear() + (month === 0 ? 0 : 0)}-${String(month + 1).padStart(2, "0")}`;
              const ymStr = `${d.getFullYear()}-${String(month + 1).padStart(2, "0")}`;
              const yearOffset = d.getFullYear() - now.getFullYear() + i;
              const actualYm = `${now.getFullYear() - i + (month === 0 ? 0 : Math.floor((d.getMonth() + month) / 12))}-${String(((d.getMonth() + month) % 12) + 1).padStart(2, "0")}`;
              // Simple approach
            }
          }
          // Simplified: group by year-month and compute avg
          const monthGroups: Record<string, any[]> = {};
          metalPrices.forEach((m: any) => {
            const ym = m.date.slice(0, 7);
            if (!monthGroups[ym]) monthGroups[ym] = [];
            monthGroups[ym].push(m);
          });
          const sortedMonths = Object.keys(monthGroups).sort();
          const recentMonths = sortedMonths.slice(-(years * 12));
          recentMonths.forEach(ym => {
            const items = monthGroups[ym];
            const entry: any = { date: ym };
            // Avg metals
            for (const metal of ["Sn", "Ag", "Cu", "Pb", "Sb"]) {
              const vals = items.map((m: any) => m.prices?.[metal]).filter((v: any) => typeof v === "number" && v > 0);
              if (vals.length > 0) entry[metal] = Math.round(vals.reduce((a: number, b: number) => a + b, 0) / vals.length * 100) / 100;
            }
            // Avg alloys
            for (const alloy of Object.keys(alloyDefinitions)) {
              const vals = items.map((m: any) => m.alloyPrices?.[alloy]).filter((v: any) => typeof v === "number" && v > 0);
              if (vals.length > 0) entry[alloy] = Math.round(vals.reduce((a: number, b: number) => a + b, 0) / vals.length * 100) / 100;
            }
            result.push(entry);
          });
        }
        return result;
      }, input, opts),
  };

  const metalPriceMonthlyAvgList = {
    useQuery: (_input?: any, opts?: any) =>
      useMockQuery(() => {
        // Group all data by year-month
        const groups: Record<string, any[]> = {};
        metalPrices.forEach((m: any) => {
          const ym = m.date.slice(0, 7);
          if (!groups[ym]) groups[ym] = [];
          groups[ym].push(m);
        });
        const result: any[] = [];
        for (const ym of Object.keys(groups).sort().reverse()) {
          const items = groups[ym];
          const metalAvgs: Record<string, number> = {};
          const alloyAvgs: Record<string, number> = {};
          for (const metal of ["Sn", "Ag", "Cu", "Pb", "Sb"]) {
            const vals = items.map((m: any) => m.prices?.[metal]).filter((v: any) => typeof v === "number" && v > 0);
            if (vals.length > 0) metalAvgs[metal] = Math.round(vals.reduce((a: number, b: number) => a + b, 0) / vals.length * 100) / 100;
          }
          for (const alloy of Object.keys(alloyDefinitions)) {
            const vals = items.map((m: any) => m.alloyPrices?.[alloy]).filter((v: any) => typeof v === "number" && v > 0);
            if (vals.length > 0) alloyAvgs[alloy] = Math.round(vals.reduce((a: number, b: number) => a + b, 0) / vals.length * 100) / 100;
          }
          result.push({ month: ym, metalAvgs, alloyAvgs, count: items.length });
        }
        return result;
      }, undefined, opts),
  };

  const metalPriceAlloys = {
    useQuery: (_input?: any, opts?: any) =>
      useMockQuery(() => {
        return Object.keys(alloyDefinitions).map(name => ({
          name,
          formula: alloyDefinitions[name],
          formulaStr: Object.entries(alloyDefinitions[name]).map(([m, r]) => `${m}×${(r as number).toFixed(4)}`).join(" + "),
        }));
      }, undefined, opts),
  };

  const metalPriceDelete = {
    useMutation: (opts?: any) =>
      useMockMutation((data: { date: string }) => {
        metalPrices = metalPrices.filter((m: any) => m.date !== data.date);
        saveToLS("sales-sys-metalPrices", metalPrices);
      }, opts),
  };

  // --- Reminders ---
  const reminderList = {
    useQuery: (input?: any, opts?: any) =>
      useMockQuery((input?: any) => {
        let items = [...reminders];
        if (input?.orderId) items = items.filter((r: any) => r.orderId === input.orderId);
        if (input?.customerId) items = items.filter((r: any) => r.customerId === input.customerId);
        // Overdue check
        const now = new Date().toISOString();
        items = items.map((r: any) => ({
          ...r,
          isOverdue: !r.isHandled && r.remindDate < now,
        }));
        if (input?.overdueOnly) items = items.filter((r: any) => r.isOverdue);
        if (input?.pendingOnly) items = items.filter((r: any) => !r.isHandled);
        if (input?.global) {
          // Global query: return all pending + count, no filtering by orderId
          items = items.filter((r: any) => !r.isHandled);
        }
        items.sort((a: any, b: any) => new Date(a.remindDate).getTime() - new Date(b.remindDate).getTime());
        return { items, total: items.length, page: 1, pageSize: 100 };
      }, input, opts),
  };

  const reminderCreate = {
    useMutation: (opts?: any) =>
      useMockMutation((data: any) => {
        const id = nextId.reminder++;
        const order = salesOrders.find((o: any) => o.id === data.orderId);
        const customer = customers.find((c: any) => c.id === (order?.customerId ?? data.customerId));
        const newReminder = {
          ...data,
          id,
          customerId: customer?.id ?? data.customerId ?? 0,
          customerName: customer?.companyName ?? data.customerName ?? "",
          orderNo: order?.orderNo ?? data.orderNo ?? "",
          isHandled: false,
          createdAt: new Date().toISOString(),
        };
        reminders.push(newReminder);
// refresh removed - triggerGlobal handles it
        return newReminder;
      }, opts),
  };

  const reminderUpdate = {
    useMutation: (opts?: any) =>
      useMockMutation((data: any) => {
        const idx = reminders.findIndex((r: any) => r.id === data.id);
        if (idx >= 0) {
          reminders[idx] = { ...reminders[idx], ...data };
  // refresh removed - triggerGlobal handles it
        }
        return { success: true };
      }, opts),
  };

  const reminderDelete = {
    useMutation: (opts?: any) =>
      useMockMutation((data: { id: number }) => {
        reminders = reminders.filter((r: any) => r.id !== data.id);
// refresh removed - triggerGlobal handles it
        return { success: true };
      }, opts),
  };

  // 保存销售订单发货批次备注
  const salesOrderUpdateShipmentNote = {
    useMutation: (opts?: any) =>
      useMockMutation((data: { orderId: number; shipmentId: number; note: string }) => {
        const shipment = (shipments[data.orderId] ?? []).find((item: any) => Number(item.id) === Number(data.shipmentId));
        if (!shipment) throw new Error("发货记录不存在");
        shipment.batchNote = data.note;
        return { success: true };
      }, opts),
  };

  const sampleReminderList = {
    useQuery: (input?: any, opts?: any) =>
      useMockQuery((input?: any) => {
        let items = [...sampleReminders];
        if (input?.orderId) items = items.filter((r: any) => r.orderId === input.orderId);
        if (input?.customerId) items = items.filter((r: any) => r.customerId === input.customerId);
        const now = new Date().toISOString();
        items = items.map((r: any) => ({ ...r, isOverdue: !r.isHandled && r.remindDate < now }));
        if (input?.overdueOnly) items = items.filter((r: any) => r.isOverdue);
        if (input?.pendingOnly || input?.global) items = items.filter((r: any) => !r.isHandled);
        items.sort((a: any, b: any) => new Date(a.remindDate).getTime() - new Date(b.remindDate).getTime());
        return { items, total: items.length, page: 1, pageSize: 100 };
      }, input, opts),
  };

  const sampleReminderCreate = {
    useMutation: (opts?: any) =>
      useMockMutation((data: any) => {
        const order = sampleOrders.find((o: any) => o.id === data.orderId);
        const customer = customers.find((c: any) => c.id === (order?.customerId ?? data.customerId));
        const reminder = {
          ...data,
          id: nextId.sampleReminder++,
          customerId: customer?.id ?? data.customerId ?? 0,
          customerName: customer?.companyName ?? data.customerName ?? "",
          orderNo: order?.orderNo ?? data.orderNo ?? "",
          isHandled: false,
          createdAt: new Date().toISOString(),
        };
        sampleReminders.push(reminder);
        return reminder;
      }, opts),
  };

  const sampleReminderUpdate = {
    useMutation: (opts?: any) =>
      useMockMutation((data: any) => {
        const idx = sampleReminders.findIndex((r: any) => r.id === data.id);
        if (idx >= 0) sampleReminders[idx] = { ...sampleReminders[idx], ...data };
      }, opts),
  };

  const sampleReminderDelete = {
    useMutation: (opts?: any) =>
      useMockMutation((data: { id: number }) => {
        sampleReminders = sampleReminders.filter((r: any) => r.id !== data.id);
      }, opts),
  };

  const sampleDashboardStats = {
    useQuery: (_input?: any, opts?: any) =>
      useMockQuery(() => {
        const enriched = sampleOrders.map(enrichSampleOrder);
        const statuses = enriched.map((o: any) => o.orderStatus);
        return {
          orders: {
            total: enriched.length,
            inProgress: statuses.filter((s: string) => ["待排产", "生产中"].includes(s)).length,
            pendingReceipt: statuses.filter((s: string) => ["待签收", "部分待签收"].includes(s)).length,
            pendingReconciliation: 0,
            pendingPayment: 0,
            completed: statuses.filter((s: string) => s === "已完成").length,
            afterSales: statuses.filter((s: string) => s === "退货中").length,
            overdue: enriched.filter((o: any) => o.isOverdue).length,
            totalAmount: "0.00",
            receivedAmount: "0.00",
          },
          customers: { total: 0, active: 0, potential: 0 },
          payments: {
            monthTotal: "0.00",
            monthCount: 0,
          },
        };
      }, undefined, opts),
  };

  const sampleDashboardArAging = {
    useQuery: (_input?: any, opts?: any) =>
      useMockQuery(() => {
        const buckets: any = {
          current: { count: 0, amount: 0 },
          d30: { count: 0, amount: 0 },
          d60: { count: 0, amount: 0 },
          d90: { count: 0, amount: 0 },
          over90: { count: 0, amount: 0 },
        };
        const now = Date.now();
        sampleOrders.map(enrichSampleOrder).forEach((o: any) => {
          const balance = Number(o.balance ?? 0);
          if (balance <= 0) return;
          const dueDates = (sampleShipments[o.id] ?? [])
            .filter((s: any) => s.paymentDueDate && s.paymentStatus !== "已支付")
            .map((s: any) => new Date(s.paymentDueDate).getTime());
          const earliest = dueDates.length ? Math.min(...dueDates) : Number.POSITIVE_INFINITY;
          const days = earliest === Number.POSITIVE_INFINITY ? 0 : Math.max(0, Math.floor((now - earliest) / 86400000));
          const bucket = days <= 0 ? buckets.current : days <= 30 ? buckets.d30 : days <= 60 ? buckets.d60 : days <= 90 ? buckets.d90 : buckets.over90;
          bucket.count += 1;
          bucket.amount += balance;
        });
        return buckets;
      }, undefined, opts),
  };

  const sampleDashboardOverdueOrders = {
    useQuery: (_input?: any, opts?: any) =>
      useMockQuery(() => sampleOrders.map(enrichSampleOrder).filter((o: any) => o.isOverdue).map((o: any) => {
        const dueDates = (sampleShipments[o.id] ?? [])
          .filter((s: any) => s.paymentDueDate && s.paymentStatus !== "已支付")
          .map((s: any) => new Date(s.paymentDueDate).getTime());
        const earliest = dueDates.length ? Math.min(...dueDates) : Date.now();
        return { ...o, overdueDays: Math.max(0, Math.floor((Date.now() - earliest) / 86400000)) };
      }), undefined, opts),
  };

  const sampleFinanceListPayments = {
    useQuery: (_input?: any, opts?: any) =>
      useMockQuery(() => {
        const items = Object.values(sampleShipments).flat()
          .filter((s: any) => Number(s.receivedAmount ?? 0) > 0)
          .map((s: any) => {
            const order = sampleOrders.find((o: any) => o.id === s.orderId);
            return {
              id: s.id,
              paymentNo: `SP-PAY-${s.id}`,
              orderId: s.orderId,
              orderNo: order?.orderNo ?? "",
              customerName: order?.customerName ?? "",
              amount: s.receivedAmount,
              paymentMethod: "批次回款",
              paymentDate: s.paymentDate ?? s.updatedAt ?? s.shippedDate,
            };
          });
        return { items, total: items.length, page: 1, pageSize: 9999 };
      }, undefined, opts),
  };

  // --- Products ---
  const productList = {
    useQuery: (input?: any, opts?: any) =>
      useMockQuery((input?: any) => {
        let items = [...products];
        if (input?.search) {
          const s = input.search.toLowerCase();
          items = items.filter((p: any) =>
            p.productName.toLowerCase().includes(s) ||
            p.productCode.toLowerCase().includes(s) ||
            p.productModel.toLowerCase().includes(s)
          );
        }
        return { items, total: items.length, page: 1, pageSize: items.length };
      }, input, opts),
  };

  const productGetById = {
    useQuery: (input: { id: number }, opts?: any) =>
      useMockQuery((input: { id: number }) =>
        products.find((p) => p.id === input.id) ?? null
      , input, opts),
  };

  const productCreate = {
    useMutation: (opts?: any) =>
      useMockMutation((data: any) => {
        products.unshift({ ...data, id: nextId.product++, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as any);
// refresh removed - triggerGlobal handles it
      }, opts),
  };

  const productUpdate = {
    useMutation: (opts?: any) =>
      useMockMutation((data: { id: number; data: any }) => {
        const idx = products.findIndex((p) => p.id === data.id);
        if (idx >= 0) {
          const oldProduct = { ...products[idx] };
          products[idx] = { ...products[idx], ...data.data, updatedAt: new Date().toISOString() } as any;
          const newProduct = products[idx];

          // 级联更新：报价规则（通过 productId）
          quotationRules.forEach((r: any) => {
            if (r.productId === data.id) {
              r.productName = newProduct.productName;
              r.productCode = newProduct.productCode;
              r.productModel = newProduct.productModel;
              r.ruleName = newProduct.productCode;
            }
          });

          // 级联更新：样品订单（通过旧 productCode 匹配）
          sampleOrders.forEach((o: any) => {
            if (o.productCode === oldProduct.productCode || o.productId === data.id) {
              o.productName = newProduct.productName;
              o.productCode = newProduct.productCode;
              o.productModel = newProduct.productModel;
              o.productId = data.id;
            }
          });

          // 级联更新：销售订单（通过旧 productCode 匹配）
          salesOrders.forEach((o: any) => {
            if (o.productCode === oldProduct.productCode || o.productId === data.id) {
              o.productName = newProduct.productName;
              o.productCode = newProduct.productCode;
              o.productModel = newProduct.productModel;
              o.productId = data.id;
            }
          });

          // 级联更新：历史报价记录（通过旧 productCode 匹配）
          quotationRecords.forEach((r: any) => {
            if (r.productCode === oldProduct.productCode || r.productId === data.id) {
              r.productName = newProduct.productName;
              r.productCode = newProduct.productCode;
              r.productModel = newProduct.productModel;
              r.productId = data.id;
            }
          });
// refresh removed - triggerGlobal handles it
        }
      }, opts),
  };

  const productDelete = {
    useMutation: (opts?: any) =>
      useMockMutation((data: { id: number }) => {
        products = products.filter((p) => p.id !== data.id);
// refresh removed - triggerGlobal handles it
      }, opts),
  };

  // --- Product Categories ---
  const productCategoryList = {
    useQuery: (input?: any, opts?: any) =>
      useMockQuery(() => {
        const items = [...productCategories].sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
        return { items, total: items.length };
      }, input, opts),
  };

  const productCategoryCreate = {
    useMutation: (opts?: any) =>
      useMockMutation((data: { name: string }) => {
        const maxId = productCategories.length > 0 ? Math.max(...productCategories.map((c: any) => c.id)) : 0;
        const maxSort = productCategories.length > 0 ? Math.max(...productCategories.map((c: any) => c.sortOrder ?? 0)) : 0;
        const newCategory = { id: maxId + 1, name: data.name, sortOrder: maxSort + 1, createdAt: new Date().toISOString() };
        productCategories.push(newCategory as any);
        persistAll();
        return newCategory;
      }, opts),
  };

  const productCategoryUpdate = {
    useMutation: (opts?: any) =>
      useMockMutation((data: { id: number; name: string }) => {
        const idx = productCategories.findIndex((c: any) => c.id === data.id);
        if (idx >= 0) {
          productCategories[idx] = { ...productCategories[idx], name: data.name };
          persistAll();
        }
        return { success: true };
      }, opts),
  };

  const productCategoryDelete = {
    useMutation: (opts?: any) =>
      useMockMutation((data: { id: number }) => {
        // Check if any product uses this category
        const inUse = products.some((p: any) => p.categoryId === data.id);
        if (inUse) return { success: false, error: "该分类下还有产品，无法删除" };
        productCategories = productCategories.filter((c: any) => c.id !== data.id) as any[];
        persistAll();
        return { success: true };
      }, opts),
  };

  return {
    dashboard: {
      stats: dashboardStats,
      arAging: dashboardArAging,
      recentOrders: dashboardRecentOrders,
      overdueOrders: dashboardOverdueOrders,
    },
    customer: {
      list: customerList,
      getById: customerGetById,
      create: customerCreate,
      update: customerUpdate,
      delete: customerDelete,
    },
    product: {
      list: productList,
      getById: productGetById,
      create: productCreate,
      update: productUpdate,
      delete: productDelete,
    },
    productCategory: {
      list: productCategoryList,
      create: productCategoryCreate,
      update: productCategoryUpdate,
      delete: productCategoryDelete,
    },
    sampleOrder: {
      list: sampleOrderList,
      getById: sampleOrderGetById,
      create: sampleOrderCreate,
      update: sampleOrderUpdate,
      delete: sampleOrderDelete,
      updateStatus: sampleOrderUpdateStatus,
      recordShipment: sampleOrderRecordShipment,
      updateShipmentStatus: sampleOrderUpdateShipmentStatus,
      recordReturn: sampleOrderRecordReturn,
      updateAfterSales: sampleOrderUpdateAfterSales,
      updatePaymentDueDate: sampleOrderUpdatePaymentDueDate,
      updateShipmentNote: sampleOrderUpdateShipmentNote,
    },
    salesOrder: {
      list: salesOrderList,
      getById: salesOrderGetById,
      create: salesOrderCreate,
      update: salesOrderUpdate,
      delete: salesOrderDelete,
      updateStatus: salesOrderUpdateStatus,
      recordShipment: salesOrderRecordShipment,
      updateShipmentStatus: salesOrderUpdateShipmentStatus,
      recordReturn: salesOrderRecordReturn,
      updateAfterSales: salesOrderUpdateAfterSales,
      updatePaymentDueDate: salesOrderUpdatePaymentDueDate,
      updateShipmentNote: salesOrderUpdateShipmentNote,
    },
    finance: {
      listPayments: financeListPayments,
      recordPayment: financeRecordPayment,
      deletePayment: financeDeletePayment,
    },
    quotationRule: {
      list: quotationRuleList,
      create: quotationRuleCreate,
      update: quotationRuleUpdate,
      delete: quotationRuleDelete,
    },
    quotationRecord: {
      list: quotationRecordList,
      create: quotationRecordCreate,
      update: quotationRecordUpdate,
      updateStatus: quotationRecordUpdateStatus,
      delete: quotationRecordDelete,
    },
    metalPrice: {
      save: metalPriceSave,
      list: metalPriceList,
      monthlyAvg: metalPriceMonthlyAvg,
      chartData: metalPriceChartData,
      monthlyAvgList: metalPriceMonthlyAvgList,
      alloys: metalPriceAlloys,
      delete: metalPriceDelete,
    },
    reminder: {
      list: reminderList,
      create: reminderCreate,
      update: reminderUpdate,
      delete: reminderDelete,
    },
    sampleReminder: {
      list: sampleReminderList,
      create: sampleReminderCreate,
      update: sampleReminderUpdate,
      delete: sampleReminderDelete,
    },
    sampleDashboard: {
      stats: sampleDashboardStats,
      arAging: sampleDashboardArAging,
      overdueOrders: sampleDashboardOverdueOrders,
    },
    sampleFinance: {
      listPayments: sampleFinanceListPayments,
    },
    useUtils: () => utils,
  };
}
