import { useMemo, useState } from "react";
import { useMockTrpc } from "@/mock/useMockData";
import ExcelJS from "exceljs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DollarSign,
  Clock,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Package,
  Wallet,
  CircleDollarSign,
  FileSpreadsheet,
  TrendingUp,
  Receipt,
  Truck,
  ClipboardCheck,
} from "lucide-react";

// 数量最多保留 6 位小数，并去掉无意义的末尾 0；禁止千分位以便导出时安全转回数字。
function formatQuantity(value: unknown): string {
  const quantity = Number(value ?? 0);
  if (!Number.isFinite(quantity)) return "0";
  return quantity.toLocaleString("zh-CN", {
    useGrouping: false,
    minimumFractionDigits: 0,
    maximumFractionDigits: 6,
  });
}

function getOrderQuantityMetrics(order: any) {
  const quantity = Number(order.quantity ?? 0);
  const grossShippedQty = Number(order.actualShippedQty ?? order.shippedTotal ?? 0);
  const returnedQty = Math.min(
    Math.max(0, Number(order.returnedQty ?? order.returnQuantity ?? 0)),
    Math.max(0, grossShippedQty),
  );
  const shippedQty = Math.max(0, grossShippedQty - returnedQty);
  return {
    quantity,
    grossShippedQty: Math.max(0, grossShippedQty),
    shippedQty,
    returnedQty,
    // 退货也代表货物曾经发出，不能重新计入未发货。
    unshippedQty: Math.max(0, quantity - grossShippedQty),
  };
}

function hasShippedOrder(order: any) {
  const shipmentRecords = Array.isArray(order.shipments) ? order.shipments : [];
  if (shipmentRecords.some((shipment: any) => shipment.shippingStatus === "已发货")) {
    return true;
  }
  return Number(order.actualShippedQty ?? order.shippedTotal ?? 0) > 0;
}

// 辅助函数：从订单和全局产品列表中提取产品信息
function resolveProductInfo(o: any, productsList?: any[]) {
  const items = o.items ?? [];
  if (items.length === 0) {
    return {
      categoryName: o.categoryName ?? "",
      productName: o.productName ?? "",
      productCode: o.productCode ?? "",
      productModel: o.productModel ?? "",
    };
  }

  const uniqueValues = (values: unknown[]) =>
    [...new Set(values.map(value => String(value ?? "").trim()).filter(Boolean))].join("、");

  const productInfos = items.map((item: any) => {
    // 优先用 productId，旧数据则用料号/名称回查产品。
    const product = productsList?.find((candidate: any) =>
      (item.productId && candidate.id === item.productId) ||
      (item.productCode && candidate.productCode === item.productCode) ||
      (!item.productCode && item.productName && candidate.productName === item.productName)
    );
    return {
      categoryName: product?.categoryName ?? item.categoryName ?? "",
      productName: product?.productName ?? item.productName ?? "",
      productCode: product?.productCode ?? item.productCode ?? "",
      productModel: product?.productModel ?? item.productModel ?? "",
    };
  });

  return {
    categoryName: uniqueValues(productInfos.map((item: any) => item.categoryName)),
    productName: uniqueValues(productInfos.map((item: any) => item.productName)),
    productCode: uniqueValues(productInfos.map((item: any) => item.productCode)),
    productModel: uniqueValues(productInfos.map((item: any) => item.productModel)),
  };
}

// 辅助函数：将订单转为明细行格式
function toDetailRow(o: any, productsList?: any[]) {
  const { quantity, shippedQty, returnedQty, unshippedQty } = getOrderQuantityMetrics(o);
  const amount = Number(o.totalAmount ?? 0) - Number(o.refundedAmount ?? 0);
  const receivedAmount = Number(o.receivedAmount ?? 0);
  const { categoryName, productName, productCode, productModel } = resolveProductInfo(o, productsList);
  return {
    id: o.id,
    orderNo: o.orderNo,
    customerName: o.customerName,
    categoryName: categoryName,
    productName: productName,
    productCode: productCode,
    productModel: productModel,
    quantity: formatQuantity(quantity),
    shippedQty: formatQuantity(shippedQty),
    returnedQty: formatQuantity(returnedQty),
    unshippedQty: formatQuantity(unshippedQty),
    unitPrice: String(Number(o.unitPrice ?? 0).toFixed(2)),
    orderDate: o.orderDate,
    amount: amount,
    refundedAmount: Number(o.refundedAmount ?? 0),
    receivedAmount: receivedAmount,
    unreceivedAmount: Math.max(0, amount - receivedAmount),
    status: o.orderStatus,
    shippedOrder: hasShippedOrder(o),
  };
}

// 月度报表工具函数
function generateMonthlyReport(orders: any[], productsData?: any) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const months = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];
  const productList = productsData?.items ?? [];

  // 筛选今年的订单
  const yearOrders = orders.filter((o: any) => {
    const d = o.orderDate ? new Date(o.orderDate) : new Date(o.createdAt ?? 0);
    return d.getFullYear() === currentYear;
  });

  // 年度汇总
  const yearTotal = {
    orderCount: yearOrders.length,
    shippedOrderCount: yearOrders.filter((o: any) => hasShippedOrder(o)).length,
    completedCount: yearOrders.filter((o: any) => o.orderStatus === "已完成").length,
    totalAmount: yearOrders.reduce((s: number, o: any) => s + Number(o.totalAmount ?? 0) - Number(o.refundedAmount ?? 0), 0),
    receivedAmount: yearOrders.reduce((s: number, o: any) => s + Number(o.receivedAmount ?? 0), 0),
    shippedQty: yearOrders.reduce((s: number, o: any) => s + getOrderQuantityMetrics(o).shippedQty, 0),
    grossShippedQty: yearOrders.reduce((s: number, o: any) => s + getOrderQuantityMetrics(o).grossShippedQty, 0),
    returnedQty: yearOrders.reduce((s: number, o: any) => s + getOrderQuantityMetrics(o).returnedQty, 0),
    unshippedQty: yearOrders.reduce((s: number, o: any) => s + getOrderQuantityMetrics(o).unshippedQty, 0),
    totalQty: yearOrders.reduce((s: number, o: any) => s + Number(o.quantity ?? 0), 0),
  };
  yearTotal.totalQty = Math.max(yearTotal.totalQty, yearTotal.grossShippedQty);

  // 明细数据：每个指标对应的订单列表（传 productList 解析分类）
  const details = {
    allOrders: yearOrders.map((o: any) => toDetailRow(o, productList)),
    completedOrders: yearOrders.filter((o: any) => o.orderStatus === "已完成").map((o: any) => toDetailRow(o, productList)),
    totalAmountOrders: yearOrders.map((o: any) => toDetailRow(o, productList)),
    receivedAmountOrders: yearOrders.filter((o: any) => Number(o.receivedAmount ?? 0) > 0).map((o: any) => toDetailRow(o, productList)),
    shippedOrders: yearOrders.filter((o: any) => hasShippedOrder(o)).map((o: any) => toDetailRow(o, productList)),
    returnedOrders: yearOrders.filter((o: any) => getOrderQuantityMetrics(o).returnedQty > 0).map((o: any) => toDetailRow(o, productList)),
    receivableOrders: yearOrders.filter((o: any) => Number(o.balance ?? 0) > 0).map((o: any) => toDetailRow(o, productList)),
    unshippedOrders: yearOrders.filter((o: any) => getOrderQuantityMetrics(o).unshippedQty > 0).map((o: any) => toDetailRow(o, productList)),
  };

  // 按月统计（只展示到当前月份）
  const currentMonth = now.getMonth();
  const monthlyData = months.slice(0, currentMonth + 1).map((label, idx) => {
    const monthIdx = idx;
    const monthOrders = yearOrders.filter((o: any) => {
      const d = o.orderDate ? new Date(o.orderDate) : new Date(o.createdAt ?? 0);
      return d.getMonth() === monthIdx;
    });
    return {
      month: label,
      monthIdx,
      orderCount: monthOrders.length,
      shippedOrderCount: monthOrders.filter((o: any) => hasShippedOrder(o)).length,
      completedCount: monthOrders.filter((o: any) => o.orderStatus === "已完成").length,
      totalAmount: monthOrders.reduce((s: number, o: any) => s + Number(o.totalAmount ?? 0) - Number(o.refundedAmount ?? 0), 0),
      receivedAmount: monthOrders.reduce((s: number, o: any) => s + Number(o.receivedAmount ?? 0), 0),
      receivableAmount: monthOrders.reduce((s: number, o: any) => s + Number(o.balance ?? 0), 0),
      shippedQty: monthOrders.reduce((s: number, o: any) => s + getOrderQuantityMetrics(o).shippedQty, 0),
      grossShippedQty: monthOrders.reduce((s: number, o: any) => s + getOrderQuantityMetrics(o).grossShippedQty, 0),
      returnedQty: monthOrders.reduce((s: number, o: any) => s + getOrderQuantityMetrics(o).returnedQty, 0),
      unshippedQty: monthOrders.reduce((s: number, o: any) => s + getOrderQuantityMetrics(o).unshippedQty, 0),
      totalQty: monthOrders.reduce((s: number, o: any) => s + Number(o.quantity ?? 0), 0),
      orders: monthOrders.map((o: any) => toDetailRow(o, productList)),
    };
  });

  return { currentYear, yearTotal, monthlyData, details };
}

// ===== exceljs 样式辅助 =====
const C = {
  blue: "FF4A6080", white: "FFFFFFFF", lightBlue: "FFDBEAFE", altRow: "FFF8FAFC",
  border: "FFD1D5DB", text: "FF374151", gray: "FF6B7280", red: "FFDC2626",
  summaryBg: "FFEFF6FF", summaryBorder: "FF3B82F6", titleBg: "FF1E3A5F",
};

const BORDER = {
  thin: { style: "thin" as const, color: { argb: C.border } },
  mediumBlue: { style: "medium" as const, color: { argb: C.blue } },
  mediumSummary: { style: "medium" as const, color: { argb: C.summaryBorder } },
};

function thinBorder() {
  return { top: BORDER.thin, bottom: BORDER.thin, left: BORDER.thin, right: BORDER.thin };
}

function fmtMoney(n: number): string {
  return `¥${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtCompactMoney(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 100_000_000) {
    return `¥${(n / 100_000_000).toLocaleString(undefined, { maximumFractionDigits: 2 })}亿`;
  }
  if (abs >= 10_000) {
    return `¥${(n / 10_000).toLocaleString(undefined, { maximumFractionDigits: 2 })}万`;
  }
  return fmtMoney(n);
}

function fmtDate(d: string | Date | null): string {
  if (!d) return "-";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" });
}

// 导出月度报表 Excel（exceljs 完整样式版）
async function exportMonthlyReport(data: { currentYear: number; yearTotal: any; monthlyData: any[]; details: any }, categoryName: string = "", reportKind: "销售" | "样品" = "销售") {
  const isSampleReport = reportKind === "样品";
  const suffix = categoryName ? ` [${categoryName}]` : "";
  const wb = new ExcelJS.Workbook();
  wb.creator = "销售管理系统";
  wb.calcProperties.fullCalcOnLoad = true;

  // 为年度/按月汇总提供可交互的分类单选下拉框和公式数据源。
  const exportRows = data.details.allOrders ?? [];
  const hasUncategorizedRows = exportRows.some((row: any) => !String(row.categoryName ?? "").trim());
  const extractedCategories: string[] = exportRows.flatMap((row: any) =>
    String(row.categoryName ?? "")
      .split("、")
      .map((name: string) => name.trim())
      .filter(Boolean)
  );
  const categoryOptions: string[] = [
    "全部",
    ...[...new Set([
      ...extractedCategories,
      ...(hasUncategorizedRows ? ["未分类"] : []),
    ])].sort((a, b) => a.localeCompare(b, "zh-CN")),
  ];
  const selectedCategoryOption = categoryName && categoryOptions.includes(categoryName) ? categoryName : "全部";
  const filterSource = wb.addWorksheet("_筛选数据");
  filterSource.state = "veryHidden";
  filterSource.addRow(["月份", "分类", "状态", "订单金额", "实收金额", "未收金额", "总数量", "净发货量", "退货量", "未发货量", "已发货订单"]);
  exportRows.forEach((row: any) => {
    const date = row.orderDate ? new Date(row.orderDate) : null;
    filterSource.addRow([
      date && !Number.isNaN(date.getTime()) ? `${date.getMonth() + 1}月` : "",
      String(row.categoryName ?? "").trim() || "未分类",
      row.status ?? "",
      Number(row.amount ?? 0),
      Number(row.receivedAmount ?? 0),
      Number(row.unreceivedAmount ?? 0),
      Number(row.quantity ?? 0),
      Number(row.shippedQty ?? 0),
      Number(row.returnedQty ?? 0),
      Number(row.unshippedQty ?? 0),
      row.shippedOrder ? 1 : 0,
    ]);
  });
  categoryOptions.forEach((name, index) => {
    filterSource.getCell(2 + index, 12).value = name;
  });
  wb.definedNames.add(`'_筛选数据'!$L$2:$L$${categoryOptions.length + 1}`, "CategoryFilterOptions");

  // 标题后缀（分类筛选信息）
  const titleSuffix = categoryName ? ` [${categoryName}]` : "";
  const headerStyle = {
    font: { name: "Microsoft YaHei", bold: true, size: 11, color: { argb: C.white } },
    fill: { type: "pattern" as const, pattern: "solid", fgColor: { argb: C.blue } },
    alignment: { horizontal: "center" as const, vertical: "middle" },
    border: { top: BORDER.mediumBlue, bottom: BORDER.mediumBlue, left: BORDER.thin, right: BORDER.thin },
  };
  const dataStyle = (isAlt: boolean) => ({
    font: { name: "Microsoft YaHei", size: 10, color: { argb: C.text } },
    fill: { type: "pattern" as const, pattern: "solid", fgColor: { argb: isAlt ? C.altRow : C.white } },
    alignment: { horizontal: "center" as const, vertical: "middle" },
    border: thinBorder(),
  });
  const dataStyleLeft = (isAlt: boolean) => ({
    ...dataStyle(isAlt), alignment: { horizontal: "left" as const, vertical: "middle" },
  });
  const moneyStyle = (isAlt: boolean, isRed = false) => ({
    font: { name: "Microsoft YaHei", size: 10, color: { argb: isRed ? C.red : C.text } },
    fill: { type: "pattern" as const, pattern: "solid", fgColor: { argb: isAlt ? C.altRow : C.white } },
    alignment: { horizontal: "right" as const, vertical: "middle" },
    border: thinBorder(),
  });
  const statusStyleMap: Record<string, { bg: string; fg: string }> = {
    "已完成": { bg: "D1FAE5", fg: "065F46" },
    "退货中": { bg: "FEE2E2", fg: "991B1B" },
    "待签收": { bg: "DBEAFE", fg: "1E40AF" },
    "待对账": { bg: "FEF3C7", fg: "92400E" },
    "待开票": { bg: "E0E7FF", fg: "3730A3" },
    "待付款": { bg: "FFEDD5", fg: "9A3412" },
    "生产中": { bg: "CFFAFE", fg: "164E63" },
    "待排产": { bg: "F3F4F6", fg: "4B5563" },
  };
  // 合计行样式：淡绿色背景 + 顶部双实线 + 黑色加粗字体
  const summaryBorderTop = { style: "double" as const, color: { argb: "FF808080" } };
  const summaryBorderOther = { style: "none" as const };
  const summaryStyle = {
    font: { name: "Microsoft YaHei", size: 10, bold: true, color: { argb: "FF000000" } },
    fill: { type: "pattern" as const, pattern: "solid", fgColor: { argb: "FFD1FAE5" } },
    alignment: { horizontal: "center" as const, vertical: "middle" as const },
    border: { top: summaryBorderTop, bottom: summaryBorderOther, left: summaryBorderOther, right: summaryBorderOther },
  };
  const summaryStyleRight = { ...summaryStyle, alignment: { horizontal: "right" as const, vertical: "middle" as const } };
  const filterSourceLastRow = Math.max(2, exportRows.length + 1);
  const sourceRange = (column: string) => `'_筛选数据'!$${column}$2:$${column}$${filterSourceLastRow}`;
  const categoryCriteria = `IF($B$2="全部","*","*"&$B$2&"*")`;
  const setupCategorySelector = (worksheet: ExcelJS.Worksheet, lastColumn: number) => {
    const labelCell = worksheet.getCell("A2");
    labelCell.value = "分类（单选）";
    labelCell.style = headerStyle as any;
    worksheet.mergeCells(2, 2, 2, Math.min(3, lastColumn));
    const selectorCell = worksheet.getCell("B2");
    selectorCell.value = selectedCategoryOption;
    selectorCell.dataValidation = {
      type: "list",
      allowBlank: false,
      formulae: ["CategoryFilterOptions"],
      showInputMessage: true,
      promptTitle: "分类筛选",
      prompt: "点击单元格右侧下拉箭头，选择“全部”或一个产品分类。",
      showErrorMessage: true,
      errorTitle: "请选择分类",
      error: "请从下拉列表中选择“全部”或一个产品分类。",
    };
    selectorCell.font = { name: "Microsoft YaHei", size: 12, bold: true, color: { argb: "FF1D4ED8" } };
    selectorCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFE08A" } };
    selectorCell.alignment = { horizontal: "center", vertical: "middle" };
    selectorCell.border = {
      top: { style: "medium", color: { argb: "FF2563EB" } },
      bottom: { style: "medium", color: { argb: "FF2563EB" } },
      left: { style: "medium", color: { argb: "FF2563EB" } },
      right: { style: "medium", color: { argb: "FF2563EB" } },
    };
    if (lastColumn >= 4) {
      worksheet.mergeCells(2, 4, 2, lastColumn);
      const hintCell = worksheet.getCell("D2");
      hintCell.value = "▼ 点击黄色组合框右侧箭头切换分类，汇总数据会自动更新";
      hintCell.font = { name: "Microsoft YaHei", size: 10, bold: true, color: { argb: "FFB45309" } };
      hintCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF7D6" } };
      hintCell.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
      hintCell.border = thinBorder();
    }
    worksheet.getRow(2).height = 28;
  };

  // ===== Sheet 1: 年度汇总（标准表格风格）=====
  const ws1 = wb.addWorksheet("年度汇总");
  const yearHeaders = isSampleReport
    ? ["订单总数", "已发货", "已完成", "总数量", "净发货量", "退货量", "未发货"]
    : ["订单总数", "已发货", "已完成", "订单总额", "实收金额", "应收金额", "总数量", "净发货量", "退货量", "未发货"];
  ws1.mergeCells(1, 1, 1, yearHeaders.length);
  const titleCell = ws1.getCell("A1");
  titleCell.value = `${data.currentYear}年 ${reportKind}经营报表汇总${titleSuffix}`;
  titleCell.font = { name: "Microsoft YaHei", bold: true, size: 16, color: { argb: C.titleBg } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.lightBlue } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  ws1.getRow(1).height = 36;
  if (!isSampleReport) {
    setupCategorySelector(ws1, yearHeaders.length);
  }

  const receivable = data.yearTotal.totalAmount - data.yearTotal.receivedAmount;
  const totalQty = data.yearTotal.totalQty;

  const yearHeaderRow = isSampleReport ? 2 : 3;
  const yearDataRow = yearHeaderRow + 1;
  // 表头行 — 深蓝背景白字
  const hRow1 = ws1.getRow(yearHeaderRow);
  yearHeaders.forEach((h, i) => {
    const cell = hRow1.getCell(i + 1);
    cell.value = h;
    cell.style = headerStyle as any;
  });
  ws1.getRow(yearHeaderRow).height = 21;

  // 销售依据 B2 分类自动计算；样品不提供分类筛选，直接统计全部数据。
  const dRow1 = ws1.getRow(yearDataRow);
  dRow1.height = 21;
  const categoryRange = sourceRange("B");
  const countByCategory = isSampleReport
    ? `COUNTIF(${sourceRange("A")},"?*")`
    : `COUNTIF(${categoryRange},${categoryCriteria})`;
  const countShippedByCategory = isSampleReport
    ? `SUM(${sourceRange("K")})`
    : `SUMIF(${categoryRange},${categoryCriteria},${sourceRange("K")})`;
  const countCompletedByCategory = isSampleReport
    ? `COUNTIF(${sourceRange("C")},"已完成")`
    : `COUNTIFS(${categoryRange},${categoryCriteria},${sourceRange("C")},"已完成")`;
  const sumByCategory = (column: string) => isSampleReport
    ? `SUM(${sourceRange(column)})`
    : `SUMIF(${categoryRange},${categoryCriteria},${sourceRange(column)})`;
  const values: { v: any; s: any; n?: string }[] = isSampleReport
    ? [
        { v: { formula: countByCategory, result: data.yearTotal.orderCount }, s: dataStyle(false), n: '0 "笔"' },
        { v: { formula: countShippedByCategory, result: data.yearTotal.shippedOrderCount }, s: dataStyle(false), n: '0 "笔"' },
        { v: { formula: countCompletedByCategory, result: data.yearTotal.completedCount }, s: dataStyle(false), n: '0 "笔"' },
        { v: { formula: sumByCategory("G"), result: totalQty }, s: dataStyle(false), n: '0.###### "kg"' },
        { v: { formula: sumByCategory("H"), result: data.yearTotal.shippedQty }, s: dataStyle(false), n: '0.###### "kg"' },
        { v: { formula: sumByCategory("I"), result: data.yearTotal.returnedQty }, s: dataStyle(false), n: '0.###### "kg"' },
        { v: { formula: sumByCategory("J"), result: data.yearTotal.unshippedQty }, s: dataStyle(false), n: '0.###### "kg"' },
      ]
    : [
        { v: { formula: countByCategory, result: data.yearTotal.orderCount }, s: dataStyle(false), n: '0 "笔"' },
        { v: { formula: countShippedByCategory, result: data.yearTotal.shippedOrderCount }, s: dataStyle(false), n: '0 "笔"' },
        { v: { formula: countCompletedByCategory, result: data.yearTotal.completedCount }, s: dataStyle(false), n: '0 "笔"' },
        { v: { formula: sumByCategory("D"), result: data.yearTotal.totalAmount }, s: moneyStyle(false), n: '¥#,##0.00' },
        { v: { formula: sumByCategory("E"), result: data.yearTotal.receivedAmount }, s: moneyStyle(false), n: '¥#,##0.00' },
        { v: { formula: sumByCategory("F"), result: receivable }, s: moneyStyle(false, receivable > 0), n: '¥#,##0.00' },
        { v: { formula: sumByCategory("G"), result: totalQty }, s: dataStyle(false), n: '0.###### "kg"' },
        { v: { formula: sumByCategory("H"), result: data.yearTotal.shippedQty }, s: dataStyle(false), n: '0.###### "kg"' },
        { v: { formula: sumByCategory("I"), result: data.yearTotal.returnedQty }, s: dataStyle(false), n: '0.###### "kg"' },
        { v: { formula: sumByCategory("J"), result: data.yearTotal.unshippedQty }, s: dataStyle(false), n: '0.###### "kg"' },
      ];
  values.forEach((c, i) => {
    const cell = dRow1.getCell(i + 1);
    cell.value = c.v;
    cell.style = c.s as any;
    if (c.n) cell.numFmt = c.n;
  });

  ws1.columns = yearHeaders.map(() => ({ width: 16 }));
  ws1.views = [{ state: "frozen", ySplit: yearHeaderRow }];

  // ===== Sheet 2: 按月汇总 =====
  const ws2 = wb.addWorksheet("按月汇总");
  const mHeaders = isSampleReport
    ? ["月份", "订单总数", "已发货", "已完成", "总数量(kg)", "净发货量(kg)", "退货量(kg)", "未发货(kg)"]
    : ["月份", "订单总数", "已发货", "已完成", "订单金额(元)", "实收(元)", "应收(元)", "总数量(kg)", "净发货量(kg)", "退货量(kg)", "未发货(kg)"];
  ws2.mergeCells(1, 1, 1, mHeaders.length);
  const t2 = ws2.getCell("A1");
  t2.value = `${data.currentYear}年 按月汇总${titleSuffix}`;
  t2.font = { name: "Microsoft YaHei", bold: true, size: 16, color: { argb: C.titleBg } };
  t2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.lightBlue } };
  t2.alignment = { horizontal: "center", vertical: "middle" };
  ws2.getRow(1).height = 36;
  if (!isSampleReport) {
    setupCategorySelector(ws2, mHeaders.length);
  }

  const monthHeaderRow = isSampleReport ? 2 : 3;
  const firstMonthRow = monthHeaderRow + 1;
  // 表头行 — 深蓝背景白字
  const hRow2 = ws2.getRow(monthHeaderRow);
  hRow2.height = 21;
  mHeaders.forEach((h, i) => {
    const cell = hRow2.getCell(i + 1);
    cell.value = h;
    cell.style = headerStyle as any;
  });
  ws2.views = [{ state: "frozen", ySplit: monthHeaderRow }];

  // 销售按月份和 B2 分类计算；样品仅按月份统计全部数据。
  let tOrderCount = 0, tShippedOrders = 0, tCompleted = 0, tAmount = 0, tReceived = 0, tReceivable = 0, tTotalQty = 0, tShipped = 0, tReturned = 0, tUnshipped = 0;
  const monthRange = sourceRange("A");
  const statusRange = sourceRange("C");
  const countByMonthAndCategory = (rowIndex: number) =>
    isSampleReport
      ? `COUNTIF(${monthRange},$A${rowIndex})`
      : `COUNTIFS(${monthRange},$A${rowIndex},${categoryRange},${categoryCriteria})`;
  const shippedByMonthAndCategory = (rowIndex: number) =>
    isSampleReport
      ? `SUMIF(${monthRange},$A${rowIndex},${sourceRange("K")})`
      : `SUMIFS(${sourceRange("K")},${monthRange},$A${rowIndex},${categoryRange},${categoryCriteria})`;
  const completedByMonthAndCategory = (rowIndex: number) =>
    isSampleReport
      ? `COUNTIFS(${monthRange},$A${rowIndex},${statusRange},"已完成")`
      : `COUNTIFS(${monthRange},$A${rowIndex},${categoryRange},${categoryCriteria},${statusRange},"已完成")`;
  const sumByMonthAndCategory = (column: string, rowIndex: number) =>
    isSampleReport
      ? `SUMIF(${monthRange},$A${rowIndex},${sourceRange(column)})`
      : `SUMIFS(${sourceRange(column)},${monthRange},$A${rowIndex},${categoryRange},${categoryCriteria})`;
  data.monthlyData.forEach((m, i) => {
    const rowIndex = firstMonthRow + i;
    const r = ws2.getRow(rowIndex);
    const isAlt = i % 2 === 1;
    const totalQty = m.totalQty;
    tOrderCount += m.orderCount; tShippedOrders += m.shippedOrderCount; tCompleted += m.completedCount;
    tAmount += m.totalAmount; tReceived += m.receivedAmount;
    tReceivable += m.receivableAmount; tTotalQty += totalQty; tShipped += m.shippedQty; tReturned += m.returnedQty;
    tUnshipped += m.unshippedQty;

    r.height = 21;
    r.getCell(1).value = m.month; r.getCell(1).style = dataStyleLeft(isAlt) as any;
    r.getCell(2).value = { formula: countByMonthAndCategory(rowIndex), result: m.orderCount }; r.getCell(2).style = dataStyle(isAlt) as any;
    r.getCell(3).value = { formula: shippedByMonthAndCategory(rowIndex), result: m.shippedOrderCount }; r.getCell(3).style = dataStyle(isAlt) as any;
    r.getCell(4).value = { formula: completedByMonthAndCategory(rowIndex), result: m.completedCount }; r.getCell(4).style = dataStyle(isAlt) as any;
    if (isSampleReport) {
      r.getCell(5).value = { formula: sumByMonthAndCategory("G", rowIndex), result: totalQty }; r.getCell(5).style = dataStyle(isAlt) as any;
      r.getCell(6).value = { formula: sumByMonthAndCategory("H", rowIndex), result: m.shippedQty }; r.getCell(6).style = dataStyle(isAlt) as any;
      r.getCell(7).value = { formula: sumByMonthAndCategory("I", rowIndex), result: m.returnedQty }; r.getCell(7).style = dataStyle(isAlt) as any;
      r.getCell(8).value = { formula: sumByMonthAndCategory("J", rowIndex), result: m.unshippedQty }; r.getCell(8).style = dataStyle(isAlt) as any;
    } else {
      r.getCell(5).value = { formula: sumByMonthAndCategory("D", rowIndex), result: m.totalAmount }; r.getCell(5).numFmt = '¥#,##0.00'; r.getCell(5).style = moneyStyle(isAlt) as any;
      r.getCell(6).value = { formula: sumByMonthAndCategory("E", rowIndex), result: m.receivedAmount }; r.getCell(6).numFmt = '¥#,##0.00'; r.getCell(6).style = moneyStyle(isAlt) as any;
      r.getCell(7).value = { formula: sumByMonthAndCategory("F", rowIndex), result: m.receivableAmount }; r.getCell(7).numFmt = '¥#,##0.00'; r.getCell(7).style = moneyStyle(isAlt, m.receivableAmount > 0) as any;
      r.getCell(8).value = { formula: sumByMonthAndCategory("G", rowIndex), result: totalQty }; r.getCell(8).style = dataStyle(isAlt) as any;
      r.getCell(9).value = { formula: sumByMonthAndCategory("H", rowIndex), result: m.shippedQty }; r.getCell(9).style = dataStyle(isAlt) as any;
      r.getCell(10).value = { formula: sumByMonthAndCategory("I", rowIndex), result: m.returnedQty }; r.getCell(10).style = dataStyle(isAlt) as any;
      r.getCell(11).value = { formula: sumByMonthAndCategory("J", rowIndex), result: m.unshippedQty }; r.getCell(11).style = dataStyle(isAlt) as any;
    }
  });

  // 合计行 — 淡绿色背景
  const lastMonthRow = firstMonthRow + data.monthlyData.length - 1;
  const sRow = ws2.getRow(firstMonthRow + data.monthlyData.length);
  sRow.height = 21;
  for (let ci = 1; ci <= mHeaders.length; ci++) {
    sRow.getCell(ci).style = summaryStyle as any;
  }
  sRow.getCell(1).value = "合计";
  const totalFormula = (column: string, result: number) => ({
    formula: data.monthlyData.length > 0 ? `SUM(${column}${firstMonthRow}:${column}${lastMonthRow})` : "0",
    result,
  });
  sRow.getCell(2).value = totalFormula("B", tOrderCount);
  sRow.getCell(3).value = totalFormula("C", tShippedOrders);
  sRow.getCell(4).value = totalFormula("D", tCompleted);
  if (isSampleReport) {
    sRow.getCell(5).value = totalFormula("E", tTotalQty);
    sRow.getCell(6).value = totalFormula("F", tShipped);
    sRow.getCell(7).value = totalFormula("G", tReturned);
    sRow.getCell(8).value = totalFormula("H", tUnshipped);
    ws2.columns = [{ width: 10 }, { width: 10 }, { width: 10 }, { width: 10 }, { width: 12 }, { width: 14 }, { width: 12 }, { width: 12 }];
  } else {
    sRow.getCell(5).value = totalFormula("E", tAmount); sRow.getCell(5).numFmt = '¥#,##0.00'; sRow.getCell(5).style = summaryStyleRight as any;
    sRow.getCell(6).value = totalFormula("F", tReceived); sRow.getCell(6).numFmt = '¥#,##0.00'; sRow.getCell(6).style = summaryStyleRight as any;
    sRow.getCell(7).value = totalFormula("G", tReceivable); sRow.getCell(7).numFmt = '¥#,##0.00'; sRow.getCell(7).style = summaryStyleRight as any;
    sRow.getCell(8).value = totalFormula("H", tTotalQty);
    sRow.getCell(9).value = totalFormula("I", tShipped);
    sRow.getCell(10).value = totalFormula("J", tReturned);
    sRow.getCell(11).value = totalFormula("K", tUnshipped);
    ws2.columns = [{ width: 10 }, { width: 10 }, { width: 10 }, { width: 10 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 12 }, { width: 14 }, { width: 12 }, { width: 12 }];
  }

  // ===== 通用：明细表构建（标准表格风格）=====
  function buildDetailSheet(ws: ExcelJS.Worksheet, title: string, orders: any[], emptyMessage = "暂无订单") {
    const moneyNumFmt = '¥#,##0.00';
    const detailHeaders = isSampleReport
      ? ["订单日期", "客户名称", "分类", "产品名称", "产品料号", "产品型号", "数量(kg)", "净发货量(kg)", "退货量(kg)", "未发货(kg)", "状态"]
      : ["订单日期", "客户名称", "分类", "产品名称", "产品料号", "产品型号", "数量(kg)", "净发货量(kg)", "退货量(kg)", "未发货(kg)", "单价(元)", "金额(元)", "退款(元)", "实收(元)", "未收(元)", "状态"];

    // 标题行
    ws.mergeCells(1, 1, 1, detailHeaders.length);
    const tc = ws.getCell("A1");
    tc.value = title + suffix;
    tc.font = { name: "Microsoft YaHei", bold: true, size: 16, color: { argb: C.titleBg } };
    tc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.lightBlue } };
    tc.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(1).height = 36;

    // orders 已经是 toDetailRow 转换过的结果，直接读取 categoryName/productName
    const sortedRows = [...orders].sort((a: any, b: any) => {
      const da = a.orderDate ? new Date(a.orderDate).getTime() : 0;
      const db = b.orderDate ? new Date(b.orderDate).getTime() : 0;
      return da - db;
    });

    // 表头行 (row 2) — 深蓝背景白字
    const hRow = ws.getRow(2);
    hRow.height = 21;
    detailHeaders.forEach((h, i) => {
      const cell = hRow.getCell(i + 1);
      cell.value = h;
      cell.style = headerStyle as any;
    });

    // 自动筛选覆盖全部明细列，客户、产品名称、产品料号和订单状态均可筛选。
    const totalDataRows = sortedRows.length;
    ws.autoFilter = {
      from: { row: 2, column: 1 },
      to: { row: Math.max(2, 2 + totalDataRows), column: detailHeaders.length },
    };

    // 无订单时仍保留明细 Sheet，并在表头下方明确标注。
    if (totalDataRows === 0) {
      ws.mergeCells(3, 1, 3, detailHeaders.length);
      const noDataCell = ws.getCell("A3");
      noDataCell.value = emptyMessage;
      noDataCell.font = { name: "Microsoft YaHei", size: 12, bold: true, color: { argb: "FF9A6700" } };
      noDataCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF4CC" } };
      noDataCell.alignment = { horizontal: "center", vertical: "middle" };
      noDataCell.border = thinBorder();
      ws.getRow(3).height = 30;
    }

    // 数据行
    sortedRows.forEach((row: any, idx: number) => {
      const r = ws.getRow(3 + idx);
      r.height = 21;
      const isAlt = idx % 2 === 1;

      r.getCell(1).value = fmtDate(row.orderDate);
      r.getCell(1).style = dataStyle(isAlt) as any;

      r.getCell(2).value = row.customerName ?? "";
      r.getCell(2).style = dataStyleLeft(isAlt) as any;

      r.getCell(3).value = row.categoryName || "-";
      r.getCell(3).style = dataStyle(isAlt) as any;

      r.getCell(4).value = row.productName ?? "";
      r.getCell(4).style = dataStyleLeft(isAlt) as any;

      r.getCell(5).value = row.productCode ?? "";
      r.getCell(5).style = dataStyleLeft(isAlt) as any;

      r.getCell(6).value = row.productModel ?? "";
      r.getCell(6).style = dataStyleLeft(isAlt) as any;

      r.getCell(7).value = Number(row.quantity);
      r.getCell(7).numFmt = "0.######";
      r.getCell(7).style = dataStyle(isAlt) as any;

      r.getCell(8).value = Number(row.shippedQty);
      r.getCell(8).numFmt = "0.######";
      r.getCell(8).style = dataStyle(isAlt) as any;

      r.getCell(9).value = Number(row.returnedQty);
      r.getCell(9).numFmt = "0.######";
      r.getCell(9).style = dataStyle(isAlt) as any;

      r.getCell(10).value = Number(row.unshippedQty);
      r.getCell(10).numFmt = "0.######";
      r.getCell(10).style = dataStyle(isAlt) as any;

      if (!isSampleReport) {
        r.getCell(11).value = Number(row.unitPrice);
        r.getCell(11).numFmt = moneyNumFmt;
        r.getCell(11).style = moneyStyle(isAlt) as any;

        r.getCell(12).value = Number(row.amount ?? 0);
        r.getCell(12).numFmt = moneyNumFmt;
        r.getCell(12).style = moneyStyle(isAlt) as any;

        r.getCell(13).value = Number(row.refundedAmount);
        r.getCell(13).numFmt = moneyNumFmt;
        r.getCell(13).style = moneyStyle(isAlt) as any;

        r.getCell(14).value = Number(row.receivedAmount ?? 0);
        r.getCell(14).numFmt = moneyNumFmt;
        r.getCell(14).style = moneyStyle(isAlt) as any;

        const unreceived = Number(row.unreceivedAmount ?? 0);
        r.getCell(15).value = unreceived;
        r.getCell(15).numFmt = moneyNumFmt;
        r.getCell(15).style = moneyStyle(isAlt, unreceived > 0) as any;
      }

      // 状态列彩色标签
      const status = row.status ?? "";
      const stCfg = statusStyleMap[status];
      const statusColumn = isSampleReport ? 11 : 16;
      r.getCell(statusColumn).value = status;
      if (stCfg) {
        r.getCell(statusColumn).font = { name: "Microsoft YaHei", size: 9, bold: true, color: { argb: stCfg.fg } };
        r.getCell(statusColumn).fill = { type: "pattern", pattern: "solid", fgColor: { argb: stCfg.bg } };
      } else {
        r.getCell(statusColumn).style = dataStyle(isAlt) as any;
      }
      r.getCell(statusColumn).alignment = { horizontal: "center", vertical: "middle" };
      r.getCell(statusColumn).border = thinBorder();
    });

    // 空行 — 分隔数据区域和合计行，使合计行在autoFilter范围之外
    const noDataRowCount = totalDataRows === 0 ? 1 : 0;
    const emptyRow = ws.getRow(3 + totalDataRows + noDataRowCount);
    emptyRow.height = 6;

    // 合计行 — 使用SUBTOTAL公式，筛选时自动只计算可见行
    const lastDataRow = 2 + totalDataRows;
    const sumRowIdx = 4 + totalDataRows + noDataRowCount;
    const sRow = ws.getRow(sumRowIdx);
    sRow.height = 21;

    const totals = sortedRows.reduce(
      (sum, row) => ({
        quantity: sum.quantity + Number(row.quantity ?? 0),
        shippedQty: sum.shippedQty + Number(row.shippedQty ?? 0),
        returnedQty: sum.returnedQty + Number(row.returnedQty ?? 0),
        unshippedQty: sum.unshippedQty + Number(row.unshippedQty ?? 0),
        amount: sum.amount + Number(row.amount ?? 0),
        refundedAmount: sum.refundedAmount + Number(row.refundedAmount ?? 0),
        receivedAmount: sum.receivedAmount + Number(row.receivedAmount ?? 0),
        unreceivedAmount: sum.unreceivedAmount + Number(row.unreceivedAmount ?? 0),
      }),
      { quantity: 0, shippedQty: 0, returnedQty: 0, unshippedQty: 0, amount: 0, refundedAmount: 0, receivedAmount: 0, unreceivedAmount: 0 },
    );

    const subtotal = (column: string, result: number) =>
      totalDataRows > 0 ? { formula: `SUBTOTAL(109,${column}3:${column}${lastDataRow})`, result } : result;
    const sumCells: { v: any; s: any; n?: string }[] = isSampleReport
      ? [
          { v: "合计", s: summaryStyle },
          { v: "", s: summaryStyle },
          { v: "", s: summaryStyle },
          { v: "", s: summaryStyle },
          { v: "", s: summaryStyle },
          { v: "", s: summaryStyle },
          { v: subtotal("G", totals.quantity), s: summaryStyle },
          { v: subtotal("H", totals.shippedQty), s: summaryStyle },
          { v: subtotal("I", totals.returnedQty), s: summaryStyle },
          { v: subtotal("J", totals.unshippedQty), s: summaryStyle },
          { v: "", s: summaryStyle },
        ]
      : [
          { v: "合计", s: summaryStyle },
          { v: "", s: summaryStyle },
          { v: "", s: summaryStyle },
          { v: "", s: summaryStyle },
          { v: "", s: summaryStyle },
          { v: "", s: summaryStyle },
          { v: subtotal("G", totals.quantity), s: summaryStyle },
          { v: subtotal("H", totals.shippedQty), s: summaryStyle },
          { v: subtotal("I", totals.returnedQty), s: summaryStyle },
          { v: subtotal("J", totals.unshippedQty), s: summaryStyle },
          { v: "", s: summaryStyleRight },
          { v: subtotal("L", totals.amount), s: summaryStyleRight, n: moneyNumFmt },
          { v: subtotal("M", totals.refundedAmount), s: summaryStyleRight, n: moneyNumFmt },
          { v: subtotal("N", totals.receivedAmount), s: summaryStyleRight, n: moneyNumFmt },
          { v: subtotal("O", totals.unreceivedAmount), s: summaryStyleRight, n: moneyNumFmt },
          { v: "", s: summaryStyle },
        ];
    sumCells.forEach((c, i) => {
      const cell = sRow.getCell(i + 1);
      cell.value = c.v as any;
      cell.style = c.s as any;
      if (c.n) cell.numFmt = c.n;
    });

    // 设置列宽
    ws.columns = isSampleReport
      ? [
          { width: 12 }, { width: 22 }, { width: 12 }, { width: 22 }, { width: 18 },
          { width: 18 }, { width: 10 }, { width: 14 }, { width: 10 }, { width: 10 }, { width: 10 },
        ]
      : [
          { width: 12 }, { width: 22 }, { width: 12 }, { width: 22 }, { width: 18 },
          { width: 18 }, { width: 10 }, { width: 14 }, { width: 10 }, { width: 10 },
          { width: 12 }, { width: 16 }, { width: 12 }, { width: 14 }, { width: 14 }, { width: 10 },
        ];

    // 冻结窗格（冻结表头行）
    ws.views = [{ state: "frozen", ySplit: 2 }];
  }

  // ===== Sheet 3: 订单明细 =====
  const ws3 = wb.addWorksheet("订单明细");
  buildDetailSheet(ws3, `全部订单明细（共${data.details.allOrders.length}笔）`, data.details.allOrders);

  // ===== Sheet 3+: 各月明细 =====
  data.monthlyData.forEach((m) => {
    const ws = wb.addWorksheet(`${m.month}明细`);
    buildDetailSheet(
      ws,
      `${m.month} 订单明细（共${m.orders.length}笔）`,
      m.orders,
      `${data.currentYear}年${m.month}无订单`,
    );
  });

  // ===== 下载 =====
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${reportKind}月度经营报表_${data.currentYear}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function Reports({ mode = "sales" }: { mode?: "sales" | "sample" }) {
  const trpc = useMockTrpc();
  const isSample = mode === "sample";
  const reportKind: "销售" | "样品" = isSample ? "样品" : "销售";
  const dashboardApi: any = isSample ? trpc.sampleDashboard : trpc.dashboard;
  const orderApi: any = isSample ? trpc.sampleOrder : trpc.salesOrder;
  const financeApi: any = isSample ? trpc.sampleFinance : trpc.finance;
  const { data: stats } = dashboardApi.stats.useQuery();
  const { data: aging } = dashboardApi.arAging.useQuery();
  const { data: overdueOrders } = dashboardApi.overdueOrders.useQuery();
  // 获取全部订单用于月度报表
  const { data: allOrdersData } = orderApi.list.useQuery({ page: 1, pageSize: 9999 });
  // 获取回款记录
  const { data: paymentsData } = financeApi.listPayments.useQuery({});
  // 获取产品列表和分类列表（用于分类筛选）
  const { data: productsData } = trpc.product.list.useQuery({});
  const { data: categoryData } = trpc.productCategory.list.useQuery({});

  // 分类筛选状态
  const [selectedCategory, setSelectedCategory] = useState<number>(0);

  // 根据分类过滤订单（0表示全部）
  const filteredOrders = useMemo(() => {
    const items = allOrdersData?.items ?? [];
    if (isSample || !selectedCategory) return items;
    // 筛选包含该分类产品的订单
    return items.filter((order: any) => {
      const items_arr = order.items ?? [];
      if (items_arr.length === 0) return false;
      return items_arr.some((it: any) => {
        const product = productsData?.items?.find((p: any) =>
          (it.productId && p.id === it.productId) ||
          (it.productCode && p.productCode === it.productCode) ||
          (!it.productCode && it.productName && p.productName === it.productName)
        );
        return product?.categoryId === selectedCategory;
      });
    });
  }, [allOrdersData, selectedCategory, productsData, isSample]);

  const monthlyReport = useMemo(() => {
    return generateMonthlyReport(filteredOrders, productsData);
  }, [filteredOrders, productsData]);

  // Excel 内置分类单选，因此导出时始终携带全部分类数据；
  // 若页面已选分类，则只把该分类作为工作簿的默认选中项。
  const exportReport = useMemo(() => {
    return generateMonthlyReport(allOrdersData?.items ?? [], productsData);
  }, [allOrdersData, productsData]);

  // 订单明细弹窗状态
  const [detailModal, setDetailModal] = useState<{
    open: boolean;
    title: string;
    subtitle: string;
    rows: {
      id: number; orderNo: string; customerName: string; categoryName: string; productName: string;
      productCode: string; productModel: string; quantity: string; shippedQty: string; returnedQty: string; unshippedQty: string;
      unitPrice: string; orderDate: string; amount: number; refundedAmount: number;
      receivedAmount: number; unreceivedAmount: number; status: string;
    }[];
  }>({ open: false, title: "", subtitle: "", rows: [] });

  // 回款明细弹窗状态
  const [paymentModal, setPaymentModal] = useState<{
    open: boolean;
    title: string;
    subtitle: string;
    rows: { id: number; paymentNo: string; customerName: string; orderNo: string; amount: number; paymentMethod: string; paymentDate: string }[];
  }>({ open: false, title: "", subtitle: "", rows: [] });

  const agingData = [
    { label: "未逾期", count: aging?.current.count ?? 0, amount: aging?.current.amount ?? 0, color: "text-green-600", border: "border-green-200", bg: "bg-green-50" },
    { label: "逾期1-30天", count: aging?.d30.count ?? 0, amount: aging?.d30.amount ?? 0, color: "text-yellow-600", border: "border-yellow-200", bg: "bg-yellow-50" },
    { label: "逾期31-60天", count: aging?.d60.count ?? 0, amount: aging?.d60.amount ?? 0, color: "text-orange-600", border: "border-orange-200", bg: "bg-orange-50" },
    { label: "逾期61-90天", count: aging?.d90.count ?? 0, amount: aging?.d90.amount ?? 0, color: "text-red-600", border: "border-red-200", bg: "bg-red-50" },
    { label: "逾期90天以上", count: aging?.over90.count ?? 0, amount: aging?.over90.amount ?? 0, color: "text-red-800", border: "border-red-300", bg: "bg-red-100" },
  ];

  const overdueCount = overdueOrders?.length ?? 0;
  const overdueAmount = overdueOrders?.reduce((sum: number, o: any) => sum + (Number(o.totalAmount) - Number(o.receivedAmount)), 0) ?? 0;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">{reportKind}报表中心</h2>
        <p className="text-sm text-gray-400 mt-1">仅统计{reportKind}订单数据</p>
      </div>
      {/* 月度经营报表 */}
      {monthlyReport && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <FileSpreadsheet size={16} className="text-blue-500" />
                {monthlyReport.currentYear}年 {reportKind}月度经营报表
              </CardTitle>
              <div className="flex items-center gap-3">
                {!isSample && (
                  <>
                    {/* 销售报表产品分类筛选 — 切片器风格按钮组 */}
                    <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                      <button
                        className={`px-3 py-1.5 text-sm rounded-md transition-all ${selectedCategory === 0 ? 'bg-white text-blue-700 font-medium shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        onClick={() => setSelectedCategory(0)}
                      >
                        全部
                      </button>
                      {categoryData?.items?.map((cat: any) => (
                        <button
                          key={cat.id}
                          className={`px-3 py-1.5 text-sm rounded-md transition-all ${selectedCategory === cat.id ? 'bg-white text-blue-700 font-medium shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                          onClick={() => setSelectedCategory(cat.id)}
                        >
                          {cat.name}
                        </button>
                      ))}
                    </div>
                  </>
                )}
                <Button size="sm" onClick={async () => {
                  try {
                    const catName = !isSample && selectedCategory ? (categoryData?.items?.find((c: any) => c.id === selectedCategory)?.name ?? "") : "";
                    await exportMonthlyReport(exportReport, catName, reportKind);
                  } catch (err) {
                    console.error("导出Excel失败:", err);
                    alert("导出失败: " + (err instanceof Error ? err.message : String(err)));
                  }
                }}>
                  <FileSpreadsheet size={14} className="mr-1" />
                  导出 Excel
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* 年度汇总卡片 */}
            {isSample ? (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
                <button className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center hover:shadow-md hover:border-blue-400 transition-all cursor-pointer" onClick={() => setDetailModal({ open: true, title: "订单总数明细", subtitle: `共 ${monthlyReport.details.allOrders.length} 笔订单`, rows: monthlyReport.details.allOrders })}>
                  <Package size={16} className="mx-auto mb-1 text-blue-500" />
                  <p className="text-xs text-gray-500">订单总数</p>
                  <p className="text-lg font-bold text-blue-700">{monthlyReport.yearTotal.orderCount} <span className="text-xs font-normal">笔</span></p>
                </button>
                <button className="bg-cyan-50 border border-cyan-200 rounded-lg p-3 text-center hover:shadow-md hover:border-cyan-400 transition-all cursor-pointer" onClick={() => setDetailModal({ open: true, title: "已发货订单明细", subtitle: `共 ${monthlyReport.details.shippedOrders.length} 笔已发货订单`, rows: monthlyReport.details.shippedOrders })}>
                  <Truck size={16} className="mx-auto mb-1 text-cyan-500" />
                  <p className="text-xs text-gray-500">已发货</p>
                  <p className="text-lg font-bold text-cyan-700">{monthlyReport.yearTotal.shippedOrderCount} <span className="text-xs font-normal">笔</span></p>
                </button>
                <button className="bg-green-50 border border-green-200 rounded-lg p-3 text-center hover:shadow-md hover:border-green-400 transition-all cursor-pointer" onClick={() => setDetailModal({ open: true, title: "已完成订单明细", subtitle: `共 ${monthlyReport.details.completedOrders.length} 笔已完成订单`, rows: monthlyReport.details.completedOrders })}>
                  <ClipboardCheck size={16} className="mx-auto mb-1 text-green-500" />
                  <p className="text-xs text-gray-500">已完成</p>
                  <p className="text-lg font-bold text-green-700">{monthlyReport.yearTotal.completedCount} <span className="text-xs font-normal">笔</span></p>
                </button>
                <button className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 text-center hover:shadow-md hover:border-indigo-400 transition-all cursor-pointer" onClick={() => setDetailModal({ open: true, title: "样品总数量明细", subtitle: `样品总数量 ${formatQuantity(monthlyReport.yearTotal.totalQty)} kg`, rows: monthlyReport.details.allOrders })}>
                  <Package size={16} className="mx-auto mb-1 text-indigo-500" />
                  <p className="text-xs text-gray-500">样品总数量</p>
                  <p className="text-lg font-bold text-indigo-700">{formatQuantity(monthlyReport.yearTotal.totalQty)} <span className="text-xs font-normal">kg</span></p>
                </button>
                <button className="bg-cyan-50 border border-cyan-200 rounded-lg p-3 text-center hover:shadow-md hover:border-cyan-400 transition-all cursor-pointer" onClick={() => setDetailModal({ open: true, title: "净发货量明细", subtitle: `净发货总量 ${formatQuantity(monthlyReport.yearTotal.shippedQty)} kg（已扣除退货）`, rows: monthlyReport.details.shippedOrders })}>
                  <Truck size={16} className="mx-auto mb-1 text-cyan-500" />
                  <p className="text-xs text-gray-500">净发货量</p>
                  <p className="text-lg font-bold text-cyan-700">{formatQuantity(monthlyReport.yearTotal.shippedQty)} <span className="text-xs font-normal">kg</span></p>
                </button>
                <button className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-center hover:shadow-md hover:border-rose-400 transition-all cursor-pointer" onClick={() => setDetailModal({ open: true, title: "退货量明细", subtitle: `退货总量 ${formatQuantity(monthlyReport.yearTotal.returnedQty)} kg`, rows: monthlyReport.details.returnedOrders })}>
                  <TrendingDown size={16} className="mx-auto mb-1 text-rose-500" />
                  <p className="text-xs text-gray-500">退货量</p>
                  <p className="text-lg font-bold text-rose-700">{formatQuantity(monthlyReport.yearTotal.returnedQty)} <span className="text-xs font-normal">kg</span></p>
                </button>
                <button className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-center hover:shadow-md hover:border-orange-400 transition-all cursor-pointer" onClick={() => setDetailModal({ open: true, title: "未发货量明细", subtitle: `未发货总量 ${formatQuantity(monthlyReport.yearTotal.unshippedQty)} kg`, rows: monthlyReport.details.unshippedOrders })}>
                  <TrendingUp size={16} className="mx-auto mb-1 text-orange-500" />
                  <p className="text-xs text-gray-500">未发货</p>
                  <p className="text-lg font-bold text-orange-700">{formatQuantity(monthlyReport.yearTotal.unshippedQty)} <span className="text-xs font-normal">kg</span></p>
                </button>
              </div>
            ) : (
              <div className="space-y-3 mb-6">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <button className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center hover:shadow-md hover:border-blue-400 transition-all cursor-pointer" onClick={() => setDetailModal({ open: true, title: "订单总数明细", subtitle: `共 ${monthlyReport.details.allOrders.length} 笔订单`, rows: monthlyReport.details.allOrders })}>
                    <Package size={16} className="mx-auto mb-1 text-blue-500" />
                    <p className="text-xs text-gray-500">订单总数</p>
                    <p className="text-xl font-bold text-blue-700">{monthlyReport.yearTotal.orderCount} <span className="text-xs font-normal">笔</span></p>
                  </button>
                  <button className="bg-green-50 border border-green-200 rounded-lg p-4 text-center hover:shadow-md hover:border-green-400 transition-all cursor-pointer" onClick={() => setDetailModal({ open: true, title: "已完成订单明细", subtitle: `共 ${monthlyReport.details.completedOrders.length} 笔已完成订单`, rows: monthlyReport.details.completedOrders })}>
                    <ClipboardCheck size={16} className="mx-auto mb-1 text-green-500" />
                    <p className="text-xs text-gray-500">已完成</p>
                    <p className="text-xl font-bold text-green-700">{monthlyReport.yearTotal.completedCount} <span className="text-xs font-normal">笔</span></p>
                  </button>
                  <button className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-center hover:shadow-md hover:border-purple-400 transition-all cursor-pointer" onClick={() => setDetailModal({ open: true, title: "订单总额明细", subtitle: `订单总额 ¥${monthlyReport.yearTotal.totalAmount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`, rows: monthlyReport.details.totalAmountOrders })}>
                    <Receipt size={16} className="mx-auto mb-1 text-purple-500" />
                    <p className="text-xs text-gray-500">订单总额</p>
                    <p className="text-xl font-bold text-purple-700 tabular-nums whitespace-nowrap" title={fmtMoney(monthlyReport.yearTotal.totalAmount)}>{fmtCompactMoney(monthlyReport.yearTotal.totalAmount)}</p>
                  </button>
                  <button className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-center hover:shadow-md hover:border-emerald-400 transition-all cursor-pointer" onClick={() => setDetailModal({ open: true, title: "实收金额明细", subtitle: `实收总额 ¥${monthlyReport.yearTotal.receivedAmount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`, rows: monthlyReport.details.receivedAmountOrders })}>
                    <CircleDollarSign size={16} className="mx-auto mb-1 text-emerald-500" />
                    <p className="text-xs text-gray-500">实收金额</p>
                    <p className="text-xl font-bold text-emerald-700 tabular-nums whitespace-nowrap" title={fmtMoney(monthlyReport.yearTotal.receivedAmount)}>{fmtCompactMoney(monthlyReport.yearTotal.receivedAmount)}</p>
                  </button>
                  <button className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center hover:shadow-md hover:border-amber-400 transition-all cursor-pointer" onClick={() => setDetailModal({ open: true, title: "应收金额明细", subtitle: `应收总额 ¥${(monthlyReport.yearTotal.totalAmount - monthlyReport.yearTotal.receivedAmount).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`, rows: monthlyReport.details.receivableOrders })}>
                    <DollarSign size={16} className="mx-auto mb-1 text-amber-500" />
                    <p className="text-xs text-gray-500">应收金额</p>
                    <p className="text-xl font-bold text-amber-700 tabular-nums whitespace-nowrap" title={fmtMoney(monthlyReport.yearTotal.totalAmount - monthlyReport.yearTotal.receivedAmount)}>{fmtCompactMoney(monthlyReport.yearTotal.totalAmount - monthlyReport.yearTotal.receivedAmount)}</p>
                  </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <button className="bg-sky-50 border border-sky-200 rounded-lg p-4 text-center hover:shadow-md hover:border-sky-400 transition-all cursor-pointer" onClick={() => setDetailModal({ open: true, title: "已发货订单明细", subtitle: `共 ${monthlyReport.details.shippedOrders.length} 笔已发货订单`, rows: monthlyReport.details.shippedOrders })}>
                    <Truck size={16} className="mx-auto mb-1 text-sky-500" />
                    <p className="text-xs text-gray-500">已发货订单</p>
                    <p className="text-xl font-bold text-sky-700">{monthlyReport.yearTotal.shippedOrderCount} <span className="text-xs font-normal">笔</span></p>
                  </button>
                  <button className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 text-center hover:shadow-md hover:border-indigo-400 transition-all cursor-pointer" onClick={() => setDetailModal({ open: true, title: "订单总数量明细", subtitle: `订单总数量 ${formatQuantity(monthlyReport.yearTotal.totalQty)} kg`, rows: monthlyReport.details.allOrders })}>
                    <Package size={16} className="mx-auto mb-1 text-indigo-500" />
                    <p className="text-xs text-gray-500">订单总数量</p>
                    <p className="text-xl font-bold text-indigo-700">{formatQuantity(monthlyReport.yearTotal.totalQty)} <span className="text-xs font-normal">kg</span></p>
                  </button>
                  <button className="bg-cyan-50 border border-cyan-200 rounded-lg p-4 text-center hover:shadow-md hover:border-cyan-400 transition-all cursor-pointer" onClick={() => setDetailModal({ open: true, title: "净发货量明细", subtitle: `净发货总量 ${formatQuantity(monthlyReport.yearTotal.shippedQty)} kg（已扣除退货）`, rows: monthlyReport.details.shippedOrders })}>
                    <Truck size={16} className="mx-auto mb-1 text-cyan-500" />
                    <p className="text-xs text-gray-500">净发货量</p>
                    <p className="text-xl font-bold text-cyan-700">{formatQuantity(monthlyReport.yearTotal.shippedQty)} <span className="text-xs font-normal">kg</span></p>
                  </button>
                  <button className="bg-rose-50 border border-rose-200 rounded-lg p-4 text-center hover:shadow-md hover:border-rose-400 transition-all cursor-pointer" onClick={() => setDetailModal({ open: true, title: "退货量明细", subtitle: `退货总量 ${formatQuantity(monthlyReport.yearTotal.returnedQty)} kg`, rows: monthlyReport.details.returnedOrders })}>
                    <TrendingDown size={16} className="mx-auto mb-1 text-rose-500" />
                    <p className="text-xs text-gray-500">退货量</p>
                    <p className="text-xl font-bold text-rose-700">{formatQuantity(monthlyReport.yearTotal.returnedQty)} <span className="text-xs font-normal">kg</span></p>
                  </button>
                  <button className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-center hover:shadow-md hover:border-orange-400 transition-all cursor-pointer" onClick={() => setDetailModal({ open: true, title: "未发货量明细", subtitle: `未发货总量 ${formatQuantity(monthlyReport.yearTotal.unshippedQty)} kg`, rows: monthlyReport.details.unshippedOrders })}>
                    <TrendingUp size={16} className="mx-auto mb-1 text-orange-500" />
                    <p className="text-xs text-gray-500">未发货</p>
                    <p className="text-xl font-bold text-orange-700">{formatQuantity(monthlyReport.yearTotal.unshippedQty)} <span className="text-xs font-normal">kg</span></p>
                  </button>
                </div>
              </div>
            )}

            {/* 按月明细表格 */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-gray-400">
                    <th className="text-left py-2 font-normal">月份</th>
                    <th className="text-right py-2 font-normal">订单数</th>
                    <th className="text-right py-2 font-normal">已发货</th>
                    <th className="text-right py-2 font-normal">已完成</th>
                    {isSample ? (
                      <th className="text-right py-2 font-normal">总数量</th>
                    ) : (
                      <>
                        <th className="text-right py-2 font-normal">订单金额</th>
                        <th className="text-right py-2 font-normal">实收</th>
                        <th className="text-right py-2 font-normal">应收</th>
                      </>
                    )}
                    <th className="text-right py-2 font-normal">净发货量</th>
                    <th className="text-right py-2 font-normal">退货量</th>
                    <th className="text-right py-2 font-normal">未发货</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyReport.monthlyData.map((m) => (
                    <tr key={m.month} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="py-2">
                        <button
                          className="font-medium text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                          onClick={() => setDetailModal({ open: true, title: `${m.month} 订单明细`, subtitle: `共 ${m.orders.length} 笔订单`, rows: m.orders })}
                        >
                          {m.month}
                        </button>
                      </td>
                      <td className="py-2 text-right">{m.orderCount}</td>
                      <td className="py-2 text-right text-cyan-600">{m.shippedOrderCount}</td>
                      <td className="py-2 text-right text-green-600">{m.completedCount}</td>
                      {isSample ? (
                        <td className="py-2 text-right font-medium text-indigo-600">{formatQuantity(m.totalQty)} kg</td>
                      ) : (
                        <>
                          <td className="py-2 text-right font-medium">¥{m.totalAmount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                          <td className="py-2 text-right text-green-600">¥{m.receivedAmount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                          <td className="py-2 text-right text-amber-600">¥{m.receivableAmount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                        </>
                      )}
                      <td className="py-2 text-right text-cyan-600">{formatQuantity(m.shippedQty)} kg</td>
                      <td className="py-2 text-right text-rose-600">{formatQuantity(m.returnedQty)} kg</td>
                      <td className="py-2 text-right text-orange-600">{formatQuantity(m.unshippedQty)} kg</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 明细弹窗 */}
            <Dialog open={detailModal.open} onOpenChange={(open) => setDetailModal(prev => ({ ...prev, open }))}>
              <DialogContent className="w-[70vw] max-h-[80vh] overflow-hidden flex flex-col">
                <DialogHeader>
                  <DialogTitle className="text-base">{detailModal.title}</DialogTitle>
                  <p className="text-xs text-gray-400">{detailModal.subtitle}</p>
                </DialogHeader>
                <div className="flex-1 overflow-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 whitespace-nowrap">日期</th>
                        <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 whitespace-nowrap">客户名称</th>
                        <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 whitespace-nowrap">分类</th>
                        <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 whitespace-nowrap">产品名称</th>
                        <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 whitespace-nowrap">数量</th>
                        <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 whitespace-nowrap">净发货量</th>
                        <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 whitespace-nowrap">退货量</th>
                        <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 whitespace-nowrap">未发货</th>
                        {!isSample && (
                          <>
                            <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 whitespace-nowrap">单价</th>
                            <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 whitespace-nowrap">金额</th>
                            <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 whitespace-nowrap">实收</th>
                            <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 whitespace-nowrap">未收</th>
                          </>
                        )}
                        <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 whitespace-nowrap">状态</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailModal.rows.length === 0 && (
                        <tr><td colSpan={isSample ? 9 : 13} className="py-8 text-center text-gray-400 text-sm">暂无数据</td></tr>
                      )}
                      {detailModal.rows.map((row) => (
                        <tr key={row.id} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="py-2 px-3 text-gray-400 whitespace-nowrap">{row.orderDate ? new Date(row.orderDate).toLocaleDateString() : "-"}</td>
                          <td className="py-2 px-3 text-gray-500 whitespace-nowrap">{row.customerName}</td>
                          <td className="py-2 px-3 whitespace-nowrap">{row.categoryName ? <span className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-medium">{row.categoryName}</span> : <span className="text-xs text-gray-300">-</span>}</td>
                          <td className="py-2 px-3 text-gray-500 whitespace-nowrap">{row.productName}</td>
                          <td className="py-2 px-3 text-right whitespace-nowrap">{row.quantity} kg</td>
                          <td className="py-2 px-3 text-right text-cyan-600 whitespace-nowrap">{row.shippedQty} kg</td>
                          <td className="py-2 px-3 text-right text-rose-600 whitespace-nowrap">{row.returnedQty} kg</td>
                          <td className="py-2 px-3 text-right text-orange-600 whitespace-nowrap">{row.unshippedQty} kg</td>
                          {!isSample && (
                            <>
                              <td className="py-2 px-3 text-right whitespace-nowrap">¥{Number(row.unitPrice).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                              <td className="py-2 px-3 text-right font-medium whitespace-nowrap">
                                <div className="flex flex-col items-end">
                                  <span>¥{Number(row.amount).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                                  {Number(row.refundedAmount ?? 0) > 0 && (
                                    <span className="text-[10px] text-orange-500">退¥{Number(row.refundedAmount).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                                  )}
                                </div>
                              </td>
                              <td className="py-2 px-3 text-right text-green-600 whitespace-nowrap">¥{Number(row.receivedAmount).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                              <td className="py-2 px-3 text-right text-red-500 whitespace-nowrap">¥{Number(row.unreceivedAmount ?? 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                            </>
                          )}
                          <td className="py-2 px-3"><span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 whitespace-nowrap">{row.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </DialogContent>
            </Dialog>

            {/* 回款明细仅属于销售报表 */}
            {!isSample && (
              <Dialog open={paymentModal.open} onOpenChange={(open) => setPaymentModal(prev => ({ ...prev, open }))}>
                <DialogContent className="w-[50vw] max-h-[80vh] overflow-hidden flex flex-col">
                  <DialogHeader>
                    <DialogTitle className="text-base">{paymentModal.title}</DialogTitle>
                    <p className="text-xs text-gray-400">{paymentModal.subtitle}</p>
                  </DialogHeader>
                  <div className="flex-1 overflow-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-gray-50">
                          <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 whitespace-nowrap">回款日期</th>
                          <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 whitespace-nowrap">客户名称</th>
                          <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 whitespace-nowrap">回款金额</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paymentModal.rows.length === 0 && (
                          <tr><td colSpan={3} className="py-8 text-center text-gray-400 text-sm">暂无回款数据</td></tr>
                        )}
                        {paymentModal.rows.map((row) => (
                          <tr key={row.id} className="border-b border-gray-50 hover:bg-gray-50">
                            <td className="py-2 px-3 text-gray-400 whitespace-nowrap">{row.paymentDate ? new Date(row.paymentDate).toLocaleDateString() : "-"}</td>
                            <td className="py-2 px-3 text-gray-500 whitespace-nowrap">{row.customerName}</td>
                            <td className="py-2 px-3 text-right text-green-600 font-medium whitespace-nowrap">¥{row.amount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </DialogContent>
              </Dialog>
            )}

          </CardContent>
        </Card>
      )}

      {/* 销售报表专属的回款、应收和逾期分析 */}
      {!isSample && (
        <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="cursor-pointer hover:shadow-md transition-all" onClick={() => {
          const rows = (allOrdersData?.items ?? []).map((o: any) => toDetailRow(o, productsData?.items ?? []));
          setDetailModal({ open: true, title: "订单总数明细", subtitle: `共 ${rows.length} 笔订单`, rows });
        }}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
              <Package size={20} className="text-blue-500" />
            </div>
            <div>
              <p className="text-xs text-gray-400">订单总数</p>
              <p className="text-xl font-bold">{stats?.orders.total ?? 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-all" onClick={() => {
          const now = new Date();
          const currentMonth = now.getMonth();
          const currentYear = now.getFullYear();
          const rows = (paymentsData?.items ?? [])
            .filter((p: any) => {
              const d = p.paymentDate ? new Date(p.paymentDate) : null;
              return d && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
            })
            .map((p: any) => ({
              id: p.id,
              paymentNo: p.paymentNo ?? "-",
              customerName: p.customerName ?? "-",
              orderNo: p.orderNo ?? "-",
              amount: Number(p.amount ?? 0),
              paymentMethod: p.paymentMethod ?? "-",
              paymentDate: p.paymentDate ?? "-",
            }));
          const total = rows.reduce((s: number, r: any) => s + r.amount, 0);
          setPaymentModal({ open: true, title: "本月回款明细", subtitle: `本月共 ${rows.length} 笔回款 / ¥${total.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`, rows });
        }}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center shrink-0">
              <CircleDollarSign size={20} className="text-green-500" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-400">本月回款</p>
              <p className="text-xl font-bold truncate tabular-nums" title={fmtMoney(Number(stats?.payments.monthTotal ?? 0))}>{fmtCompactMoney(Number(stats?.payments.monthTotal ?? 0))}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-all" onClick={() => {
          const inProgressStatuses = ["生产中", "待排产", "待发货"];
          const rows = (allOrdersData?.items ?? [])
            .filter((o: any) => inProgressStatuses.includes(o.orderStatus))
            .map((o: any) => toDetailRow(o, productsData?.items ?? []));
          setDetailModal({ open: true, title: "进行中订单明细", subtitle: `共 ${rows.length} 笔进行中订单`, rows });
        }}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center shrink-0">
              <Clock size={20} className="text-amber-500" />
            </div>
            <div>
              <p className="text-xs text-gray-400">进行中</p>
              <p className="text-xl font-bold">{stats?.orders.inProgress ?? 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-all" onClick={() => {
          const rows = (allOrdersData?.items ?? [])
            .filter((o: any) => o.isOverdue)
            .map((o: any) => toDetailRow(o, productsData?.items ?? []));
          setDetailModal({ open: true, title: "逾期订单明细", subtitle: `共 ${rows.length} 笔逾期订单`, rows });
        }}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center shrink-0">
              <TrendingDown size={20} className="text-red-500" />
            </div>
            <div>
              <p className="text-xs text-gray-400">逾期</p>
              <p className="text-xl font-bold">{stats?.orders.overdue ?? 0}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 应收账龄分析 - 简洁网格卡片 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Wallet size={16} className="text-blue-500" />
            应收账款账龄分析
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {agingData.map((item) => (
              <div key={item.label} className={`${item.bg} border ${item.border} rounded-lg p-3`}>
                <p className="text-xs text-gray-500 mb-2">{item.label}</p>
                <p className={`text-xl font-bold ${item.color}`}>{item.count} <span className="text-xs font-normal text-gray-400">笔</span></p>
                <p className="text-sm font-medium mt-1 truncate tabular-nums" title={fmtMoney(item.amount)}>{fmtCompactMoney(item.amount)}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 逾期订单 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2 text-red-600">
            <AlertTriangle size={16} />
            逾期订单
            {overdueCount > 0 && (
              <span className="text-xs font-normal text-gray-400 ml-1">
                共 {overdueCount} 笔 / ¥{overdueAmount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {overdueCount > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-gray-400">
                    <th className="text-left pb-2 font-normal">订单号</th>
                    <th className="text-left pb-2 font-normal">客户</th>
                    <th className="text-right pb-2 font-normal">未收金额</th>
                    <th className="text-right pb-2 font-normal">逾期天数</th>
                  </tr>
                </thead>
                <tbody>
                  {overdueOrders?.map((order: any) => {
                    const balance = Number(order.totalAmount) - Number(order.receivedAmount);
                    return (
                      <tr key={order.id} className="border-b border-gray-50 hover:bg-red-50/30">
                        <td className="py-2.5 font-medium">{order.orderNo}</td>
                        <td className="py-2.5 text-gray-500">{order.customerName}</td>
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
        </>
      )}
    </div>
  );
}
