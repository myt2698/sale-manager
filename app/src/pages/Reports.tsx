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

// 辅助函数：从订单和全局产品列表中提取产品信息
function resolveProductInfo(o: any, productsList?: any[]) {
  const firstItem = (o.items ?? [])[0];
  if (!firstItem) {
    return { categoryName: "", productName: o.productName ?? "" };
  }
  // 优先用 productId 从产品列表查
  if (firstItem.productId && productsList && productsList.length > 0) {
    const p = productsList.find((prod: any) => prod.id === firstItem.productId);
    if (p) {
      return { categoryName: p.categoryName ?? "", productName: p.productName ?? "" };
    }
  }
  // 回退到 items 中存储的数据
  return { categoryName: firstItem.categoryName ?? "", productName: firstItem.productName ?? "" };
}

// 辅助函数：将订单转为明细行格式
function toDetailRow(o: any, productsList?: any[]) {
  const qty = Number(o.quantity ?? 0);
  const shipped = Number(o.actualShippedQty ?? o.shippedTotal ?? 0);
  const amount = Number(o.totalAmount ?? 0) - Number(o.refundedAmount ?? 0);
  const receivedAmount = Number(o.receivedAmount ?? 0);
  const { categoryName, productName } = resolveProductInfo(o, productsList);
  return {
    id: o.id,
    orderNo: o.orderNo,
    customerName: o.customerName,
    categoryName: categoryName,
    productName: productName,
    quantity: String(qty.toFixed(0)),
    shippedQty: String(shipped.toFixed(0)),
    unshippedQty: String(Math.max(0, qty - shipped).toFixed(0)),
    unitPrice: String(Number(o.unitPrice ?? 0).toFixed(2)),
    orderDate: o.orderDate,
    amount: amount,
    refundedAmount: Number(o.refundedAmount ?? 0),
    receivedAmount: receivedAmount,
    unreceivedAmount: Math.max(0, amount - receivedAmount),
    status: o.orderStatus,
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
    completedCount: yearOrders.filter((o: any) => o.orderStatus === "已完成").length,
    totalAmount: yearOrders.reduce((s: number, o: any) => s + Number(o.totalAmount ?? 0) - Number(o.refundedAmount ?? 0), 0),
    receivedAmount: yearOrders.reduce((s: number, o: any) => s + Number(o.receivedAmount ?? 0), 0),
    shippedQty: yearOrders.reduce((s: number, o: any) => s + Number(o.actualShippedQty ?? o.shippedTotal ?? 0), 0),
    totalQty: yearOrders.reduce((s: number, o: any) => s + Number(o.quantity ?? 0), 0),
  };
  yearTotal.totalQty = Math.max(yearTotal.totalQty, yearTotal.shippedQty);

  // 明细数据：每个指标对应的订单列表（传 productList 解析分类）
  const details = {
    allOrders: yearOrders.map((o: any) => toDetailRow(o, productList)),
    completedOrders: yearOrders.filter((o: any) => o.orderStatus === "已完成").map((o: any) => toDetailRow(o, productList)),
    totalAmountOrders: yearOrders.map((o: any) => toDetailRow(o, productList)),
    receivedAmountOrders: yearOrders.filter((o: any) => Number(o.receivedAmount ?? 0) > 0).map((o: any) => toDetailRow(o, productList)),
    shippedOrders: yearOrders.filter((o: any) => Number(o.actualShippedQty ?? o.shippedTotal ?? 0) > 0).map((o: any) => toDetailRow(o, productList)),
    receivableOrders: yearOrders.filter((o: any) => Number(o.balance ?? 0) > 0).map((o: any) => toDetailRow(o, productList)),
    unshippedOrders: yearOrders.filter((o: any) => Number(o.quantity ?? 0) - Number(o.actualShippedQty ?? o.shippedTotal ?? 0) > 0).map((o: any) => toDetailRow(o, productList)),
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
      completedCount: monthOrders.filter((o: any) => o.orderStatus === "已完成").length,
      totalAmount: monthOrders.reduce((s: number, o: any) => s + Number(o.totalAmount ?? 0) - Number(o.refundedAmount ?? 0), 0),
      receivedAmount: monthOrders.reduce((s: number, o: any) => s + Number(o.receivedAmount ?? 0), 0),
      receivableAmount: monthOrders.reduce((s: number, o: any) => s + Number(o.balance ?? 0), 0),
      shippedQty: monthOrders.reduce((s: number, o: any) => s + Number(o.actualShippedQty ?? o.shippedTotal ?? 0), 0),
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

function fmtDate(d: string | Date | null): string {
  if (!d) return "-";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" });
}

// 导出月度报表 Excel（exceljs 完整样式版）
async function exportMonthlyReport(data: { currentYear: number; yearTotal: any; monthlyData: any[]; details: any }, categoryName: string = "", productsData?: any) {
  const suffix = categoryName ? ` [${categoryName}]` : "";
  const wb = new ExcelJS.Workbook();
  wb.creator = "销售管理系统";

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
  const dataStyleRight = (isAlt: boolean) => ({
    ...dataStyle(isAlt), alignment: { horizontal: "right" as const, vertical: "middle" },
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
    alignment: { horizontal: "center" as const, vertical: "middle" },
    border: { top: summaryBorderTop, bottom: summaryBorderOther, left: summaryBorderOther, right: summaryBorderOther },
  };
  const summaryStyleRight = { ...summaryStyle, alignment: { horizontal: "right" as const, vertical: "middle" } };

  // ===== Sheet 1: 年度汇总（标准表格风格）=====
  const ws1 = wb.addWorksheet("年度汇总");
  ws1.mergeCells("A1:H1");
  const titleCell = ws1.getCell("A1");
  titleCell.value = `${data.currentYear}年 经营报表汇总${titleSuffix}`;
  titleCell.font = { name: "Microsoft YaHei", bold: true, size: 16, color: { argb: C.titleBg } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.lightBlue } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  ws1.getRow(1).height = 36;

  const receivable = data.yearTotal.totalAmount - data.yearTotal.receivedAmount;
  const totalQty = data.yearTotal.totalQty;

  // 表头行 (row 2) — 深蓝背景白字
  const yearHeaders = ["订单总数", "已完成", "订单总额", "实收金额", "应收金额", "总数量", "发货量", "未发货"];
  const hRow1 = ws1.getRow(2);
  yearHeaders.forEach((h, i) => {
    const cell = hRow1.getCell(i + 1);
    cell.value = h;
    cell.style = headerStyle as any;
  });
  ws1.getRow(2).height = 21;

  // 数据行 (row 3) — 白底数据行（文本左对齐，金额右对齐）
  const dRow1 = ws1.getRow(3);
  dRow1.height = 21;
  const values = [
    { v: `${data.yearTotal.orderCount} 笔`, s: dataStyle(false) },
    { v: `${data.yearTotal.completedCount} 笔`, s: dataStyle(false) },
    { v: data.yearTotal.totalAmount, s: moneyStyle(false), n: '¥#,##0.00' },
    { v: data.yearTotal.receivedAmount, s: moneyStyle(false), n: '¥#,##0.00' },
    { v: receivable, s: moneyStyle(false, receivable > 0), n: '¥#,##0.00' },
    { v: `${totalQty.toFixed(0)} kg`, s: dataStyle(false) },
    { v: `${data.yearTotal.shippedQty.toFixed(0)} kg`, s: dataStyle(false) },
    { v: `${(totalQty - data.yearTotal.shippedQty).toFixed(0)} kg`, s: dataStyle(false) },
  ];
  values.forEach((c, i) => {
    const cell = dRow1.getCell(i + 1);
    cell.value = c.v;
    cell.style = c.s as any;
    if (c.n) cell.numFmt = c.n;
  });

  ws1.columns = yearHeaders.map(() => ({ width: 16 }));

  // ===== Sheet 2: 按月汇总 =====
  const ws2 = wb.addWorksheet("按月汇总");
  ws2.mergeCells("A1:I1"); // 9列数据
  const t2 = ws2.getCell("A1");
  t2.value = `${data.currentYear}年 按月汇总${titleSuffix}`;
  t2.font = { name: "Microsoft YaHei", bold: true, size: 16, color: { argb: C.titleBg } };
  t2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.lightBlue } };
  t2.alignment = { horizontal: "center", vertical: "middle" };
  ws2.getRow(1).height = 36;

  // 表头行 (row 2) — 深蓝背景白字
  const mHeaders = ["月份", "订单总数", "已完成", "订单金额(元)", "实收(元)", "应收(元)", "总数量(kg)", "发货量(kg)", "未发货(kg)"];
  const hRow2 = ws2.getRow(2);
  hRow2.height = 21;
  mHeaders.forEach((h, i) => {
    const cell = hRow2.getCell(i + 1);
    cell.value = h;
    cell.style = headerStyle as any;
  });
  ws2.views = [{ state: "frozen", ySplit: 2 }];

  // 数据行 (row 3起) — 白底/交替浅灰底
  let tOrderCount = 0, tCompleted = 0, tAmount = 0, tReceived = 0, tReceivable = 0, tTotalQty = 0, tShipped = 0, tUnshipped = 0;
  data.monthlyData.forEach((m, i) => {
    const r = ws2.getRow(3 + i);
    const isAlt = i % 2 === 1;
    const totalQty = m.totalQty;
    tOrderCount += m.orderCount; tCompleted += m.completedCount;
    tAmount += m.totalAmount; tReceived += m.receivedAmount;
    tReceivable += m.receivableAmount; tTotalQty += totalQty; tShipped += m.shippedQty;
    tUnshipped += Math.max(0, totalQty - m.shippedQty);

    r.height = 21;
    r.getCell(1).value = m.month; r.getCell(1).style = dataStyleLeft(isAlt) as any;
    r.getCell(2).value = m.orderCount; r.getCell(2).style = dataStyle(isAlt) as any;
    r.getCell(3).value = m.completedCount; r.getCell(3).style = dataStyle(isAlt) as any;
    r.getCell(4).value = m.totalAmount; r.getCell(4).numFmt = '¥#,##0.00'; r.getCell(4).style = moneyStyle(isAlt) as any;
    r.getCell(5).value = m.receivedAmount; r.getCell(5).numFmt = '¥#,##0.00'; r.getCell(5).style = moneyStyle(isAlt) as any;
    r.getCell(6).value = m.receivableAmount; r.getCell(6).numFmt = '¥#,##0.00'; r.getCell(6).style = moneyStyle(isAlt, m.receivableAmount > 0) as any;
    r.getCell(7).value = totalQty; r.getCell(7).style = dataStyle(isAlt) as any;
    r.getCell(8).value = m.shippedQty; r.getCell(8).style = dataStyle(isAlt) as any;
    r.getCell(9).value = Math.max(0, totalQty - m.shippedQty); r.getCell(9).style = dataStyle(isAlt) as any;
  });

  // 合计行 — 淡绿色背景
  const sRow = ws2.getRow(3 + data.monthlyData.length);
  sRow.height = 21;
  for (let ci = 1; ci <= 9; ci++) {
    sRow.getCell(ci).style = summaryStyle;
  }
  sRow.getCell(1).value = "合计";
  sRow.getCell(2).value = tOrderCount;
  sRow.getCell(3).value = tCompleted;
  sRow.getCell(4).value = tAmount; sRow.getCell(4).numFmt = '¥#,##0.00'; sRow.getCell(4).style = summaryStyleRight;
  sRow.getCell(5).value = tReceived; sRow.getCell(5).numFmt = '¥#,##0.00'; sRow.getCell(5).style = summaryStyleRight;
  sRow.getCell(6).value = tReceivable; sRow.getCell(6).numFmt = '¥#,##0.00'; sRow.getCell(6).style = summaryStyleRight;
  sRow.getCell(7).value = tTotalQty;
  sRow.getCell(8).value = tShipped;
  sRow.getCell(9).value = tUnshipped;

  ws2.columns = [{ width: 10 }, { width: 10 }, { width: 10 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 12 }, { width: 12 }, { width: 12 }];

  // ===== 通用：明细表构建（标准表格风格）=====
  function buildDetailSheet(ws: ExcelJS.Worksheet, title: string, orders: any[], catName: string = "", pd?: any) {
    const moneyNumFmt = '¥#,##0.00';
    const detailHeaders = ["订单日期", "客户名称", "分类", "产品名称", "数量(kg)", "已发货(kg)", "未发货(kg)", "单价(元)", "金额(元)", "退款(元)", "实收(元)", "未收(元)", "状态"];

    // 标题行
    ws.mergeCells("A1:M1");
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

    // 自动筛选（仅分类列）
    const totalDataRows = sortedRows.length;
    if (totalDataRows > 0) {
      ws.autoFilter = { from: { row: 2, column: 3 }, to: { row: 2, column: 3 } };
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

      r.getCell(5).value = Number(row.quantity);
      r.getCell(5).style = dataStyle(isAlt) as any;

      r.getCell(6).value = Number(row.shippedQty);
      r.getCell(6).style = dataStyle(isAlt) as any;

      r.getCell(7).value = Number(row.unshippedQty);
      r.getCell(7).style = dataStyle(isAlt) as any;

      r.getCell(8).value = Number(row.unitPrice);
      r.getCell(8).numFmt = moneyNumFmt;
      r.getCell(8).style = moneyStyle(isAlt) as any;

      r.getCell(9).value = row.amount;
      r.getCell(9).numFmt = moneyNumFmt;
      r.getCell(9).style = moneyStyle(isAlt) as any;

      r.getCell(10).value = Number(row.refundedAmount);
      r.getCell(10).numFmt = moneyNumFmt;
      r.getCell(10).style = moneyStyle(isAlt) as any;

      r.getCell(11).value = row.receivedAmount;
      r.getCell(11).numFmt = moneyNumFmt;
      r.getCell(11).style = moneyStyle(isAlt) as any;

      const unreceived = Number(row.unreceivedAmount ?? 0);
      r.getCell(12).value = unreceived;
      r.getCell(12).numFmt = moneyNumFmt;
      r.getCell(12).style = moneyStyle(isAlt, unreceived > 0) as any;

      // 状态列彩色标签
      const status = row.status ?? "";
      const stCfg = statusStyleMap[status];
      r.getCell(13).value = status;
      if (stCfg) {
        r.getCell(13).font = { name: "Microsoft YaHei", size: 9, bold: true, color: { argb: stCfg.fg } };
        r.getCell(13).fill = { type: "pattern", pattern: "solid", fgColor: { argb: stCfg.bg } };
      } else {
        r.getCell(13).style = dataStyle(isAlt) as any;
      }
      r.getCell(13).alignment = { horizontal: "center", vertical: "middle" };
      r.getCell(13).border = thinBorder();
    });

    // 空行 — 分隔数据区域和合计行，使合计行在autoFilter范围之外
    const emptyRow = ws.getRow(3 + totalDataRows);
    emptyRow.height = 6;

    // 合计行 — 使用SUBTOTAL公式，筛选时自动只计算可见行
    const lastDataRow = 2 + totalDataRows;
    const sumRowIdx = 4 + totalDataRows;
    const sRow = ws.getRow(sumRowIdx);
    sRow.height = 21;

    const sumCells = [
      { v: "合计", s: summaryStyle },
      { v: "", s: summaryStyle },
      { v: "", s: summaryStyle },
      { v: "", s: summaryStyle },
      { v: { formula: `SUBTOTAL(109,E3:E${lastDataRow})` }, s: summaryStyle },
      { v: { formula: `SUBTOTAL(109,F3:F${lastDataRow})` }, s: summaryStyle },
      { v: { formula: `SUBTOTAL(109,G3:G${lastDataRow})` }, s: summaryStyle },
      { v: "", s: summaryStyleRight },
      { v: { formula: `SUBTOTAL(109,I3:I${lastDataRow})` }, s: summaryStyleRight, n: moneyNumFmt },
      { v: { formula: `SUBTOTAL(109,J3:J${lastDataRow})` }, s: summaryStyleRight, n: moneyNumFmt },
      { v: { formula: `SUBTOTAL(109,K3:K${lastDataRow})` }, s: summaryStyleRight, n: moneyNumFmt },
      { v: { formula: `SUBTOTAL(109,L3:L${lastDataRow})` }, s: summaryStyleRight, n: moneyNumFmt },
      { v: "", s: summaryStyle },
    ];
    sumCells.forEach((c, i) => {
      const cell = sRow.getCell(i + 1);
      cell.value = c.v as any;
      cell.style = c.s as any;
      if (c.n) cell.numFmt = c.n;
    });

    // 设置列宽
    ws.columns = [
      { width: 12 }, { width: 22 }, { width: 12 }, { width: 22 }, { width: 10 }, { width: 10 },
      { width: 10 }, { width: 12 }, { width: 16 }, { width: 12 }, { width: 14 }, { width: 14 }, { width: 10 },
    ];

    // 冻结窗格（冻结表头行）
    ws.views = [{ state: "frozen", ySplit: 2 }];
  }

  // ===== Sheet 3: 订单明细 =====
  const ws3 = wb.addWorksheet("订单明细");
  buildDetailSheet(ws3, `全部订单明细（共${data.details.allOrders.length}笔）`, data.details.allOrders, categoryName, productsData);

  // ===== Sheet 3+: 各月明细 =====
  data.monthlyData.forEach((m) => {
    if (m.orders.length === 0) return;
    const ws = wb.addWorksheet(`${m.month}明细`);
    buildDetailSheet(ws, `${m.month} 订单明细（共${m.orders.length}笔）`, m.orders, categoryName, productsData);
  });

  // ===== 下载 =====
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `月度经营报表_${data.currentYear}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function Reports() {
  const trpc = useMockTrpc();
  const { data: stats } = trpc.dashboard.stats.useQuery();
  const { data: aging } = trpc.dashboard.arAging.useQuery();
  const { data: overdueOrders } = trpc.dashboard.overdueOrders.useQuery();
  // 获取全部订单用于月度报表
  const { data: allOrdersData } = trpc.salesOrder.list.useQuery({ page: 1, pageSize: 9999 });
  // 获取回款记录
  const { data: paymentsData } = trpc.finance.listPayments.useQuery({});
  // 获取产品列表和分类列表（用于分类筛选）
  const { data: productsData } = trpc.product.list.useQuery({});
  const { data: categoryData } = trpc.productCategory.list.useQuery({});

  // 分类筛选状态
  const [selectedCategory, setSelectedCategory] = useState<number>(0);

  // 根据分类过滤订单（0表示全部）
  const filteredOrders = useMemo(() => {
    const items = allOrdersData?.items ?? [];
    if (!selectedCategory) return items;
    // 筛选包含该分类产品的订单
    return items.filter((order: any) => {
      const items_arr = order.items ?? [];
      if (items_arr.length === 0) return false;
      return items_arr.some((it: any) => {
        if (!it.productId) return false;
        const product = productsData?.items?.find((p: any) => p.id === it.productId);
        return product?.categoryId === selectedCategory;
      });
    });
  }, [allOrdersData, selectedCategory, productsData]);

  const monthlyReport = useMemo(() => {
    if (filteredOrders.length === 0) return null;
    return generateMonthlyReport(filteredOrders, productsData);
  }, [filteredOrders, productsData]);

  // 订单明细弹窗状态
  const [detailModal, setDetailModal] = useState<{
    open: boolean;
    title: string;
    subtitle: string;
    rows: { id: number; orderNo: string; customerName: string; productName: string; quantity: string; unitPrice: string; orderDate: string; amount: number; receivedAmount: number; unreceivedAmount: number; status: string }[];
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
      {/* 月度经营报表 */}
      {monthlyReport && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <FileSpreadsheet size={16} className="text-blue-500" />
                {monthlyReport.currentYear}年 月度经营报表
              </CardTitle>
              <div className="flex items-center gap-3">
                {/* 产品分类筛选 — 切片器风格按钮组 */}
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
                <Button size="sm" onClick={async () => {
                  try {
                    const catName = selectedCategory ? (categoryData?.items?.find((c: any) => c.id === selectedCategory)?.name ?? "") : "";
                    await exportMonthlyReport(monthlyReport, catName, productsData);
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
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
              <button className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center hover:shadow-md hover:border-blue-400 transition-all cursor-pointer" onClick={() => setDetailModal({ open: true, title: "订单总数明细", subtitle: `共 ${monthlyReport.details.allOrders.length} 笔订单`, rows: monthlyReport.details.allOrders })}>
                <Package size={16} className="mx-auto mb-1 text-blue-500" />
                <p className="text-xs text-gray-500">订单总数</p>
                <p className="text-lg font-bold text-blue-700">{monthlyReport.yearTotal.orderCount} <span className="text-xs font-normal">笔</span></p>
              </button>
              <button className="bg-green-50 border border-green-200 rounded-lg p-3 text-center hover:shadow-md hover:border-green-400 transition-all cursor-pointer" onClick={() => setDetailModal({ open: true, title: "已完成订单明细", subtitle: `共 ${monthlyReport.details.completedOrders.length} 笔已完成订单`, rows: monthlyReport.details.completedOrders })}>
                <ClipboardCheck size={16} className="mx-auto mb-1 text-green-500" />
                <p className="text-xs text-gray-500">已完成</p>
                <p className="text-lg font-bold text-green-700">{monthlyReport.yearTotal.completedCount} <span className="text-xs font-normal">笔</span></p>
              </button>
              <button className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-center hover:shadow-md hover:border-purple-400 transition-all cursor-pointer" onClick={() => setDetailModal({ open: true, title: "订单总额明细", subtitle: `订单总额 ¥${monthlyReport.yearTotal.totalAmount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`, rows: monthlyReport.details.totalAmountOrders })}>
                <Receipt size={16} className="mx-auto mb-1 text-purple-500" />
                <p className="text-xs text-gray-500">订单总额</p>
                <p className="text-lg font-bold text-purple-700">¥{monthlyReport.yearTotal.totalAmount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
              </button>
              <button className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-center hover:shadow-md hover:border-emerald-400 transition-all cursor-pointer" onClick={() => setDetailModal({ open: true, title: "实收金额明细", subtitle: `实收总额 ¥${monthlyReport.yearTotal.receivedAmount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`, rows: monthlyReport.details.receivedAmountOrders })}>
                <CircleDollarSign size={16} className="mx-auto mb-1 text-emerald-500" />
                <p className="text-xs text-gray-500">实收金额</p>
                <p className="text-lg font-bold text-emerald-700">¥{monthlyReport.yearTotal.receivedAmount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
              </button>
              <button className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center hover:shadow-md hover:border-amber-400 transition-all cursor-pointer" onClick={() => setDetailModal({ open: true, title: "应收金额明细", subtitle: `应收总额 ¥${(monthlyReport.yearTotal.totalAmount - monthlyReport.yearTotal.receivedAmount).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`, rows: monthlyReport.details.receivableOrders })}>
                <DollarSign size={16} className="mx-auto mb-1 text-amber-500" />
                <p className="text-xs text-gray-500">应收金额</p>
                <p className="text-lg font-bold text-amber-700">¥{(monthlyReport.yearTotal.totalAmount - monthlyReport.yearTotal.receivedAmount).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
              </button>
              <button className="bg-cyan-50 border border-cyan-200 rounded-lg p-3 text-center hover:shadow-md hover:border-cyan-400 transition-all cursor-pointer" onClick={() => setDetailModal({ open: true, title: "发货量明细", subtitle: `发货总量 ${monthlyReport.yearTotal.shippedQty.toFixed(0)} kg`, rows: monthlyReport.details.shippedOrders })}>
                <Truck size={16} className="mx-auto mb-1 text-cyan-500" />
                <p className="text-xs text-gray-500">发货量</p>
                <p className="text-lg font-bold text-cyan-700">{monthlyReport.yearTotal.shippedQty.toFixed(0)} <span className="text-xs font-normal">kg</span></p>
              </button>
              <button className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-center hover:shadow-md hover:border-orange-400 transition-all cursor-pointer" onClick={() => setDetailModal({ open: true, title: "未发货量明细", subtitle: `未发货总量 ${(monthlyReport.yearTotal.totalQty - monthlyReport.yearTotal.shippedQty).toFixed(0)} kg`, rows: monthlyReport.details.unshippedOrders })}>
                <TrendingUp size={16} className="mx-auto mb-1 text-orange-500" />
                <p className="text-xs text-gray-500">未发货</p>
                <p className="text-lg font-bold text-orange-700">{(monthlyReport.yearTotal.totalQty - monthlyReport.yearTotal.shippedQty).toFixed(0)} <span className="text-xs font-normal">kg</span></p>
              </button>
            </div>

            {/* 按月明细表格 */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-gray-400">
                    <th className="text-left py-2 font-normal">月份</th>
                    <th className="text-right py-2 font-normal">订单数</th>
                    <th className="text-right py-2 font-normal">已完成</th>
                    <th className="text-right py-2 font-normal">订单金额</th>
                    <th className="text-right py-2 font-normal">实收</th>
                    <th className="text-right py-2 font-normal">应收</th>
                    <th className="text-right py-2 font-normal">发货量</th>
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
                      <td className="py-2 text-right text-green-600">{m.completedCount}</td>
                      <td className="py-2 text-right font-medium">¥{m.totalAmount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                      <td className="py-2 text-right text-green-600">¥{m.receivedAmount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                      <td className="py-2 text-right text-amber-600">¥{m.receivableAmount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                      <td className="py-2 text-right text-cyan-600">{m.shippedQty.toFixed(0)} kg</td>
                      <td className="py-2 text-right text-orange-600">{Math.max(0, m.totalQty - m.shippedQty).toFixed(0)} kg</td>
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
                        <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 whitespace-nowrap">单价</th>
                        <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 whitespace-nowrap">金额</th>
                        <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 whitespace-nowrap">实收</th>
                        <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 whitespace-nowrap">未收</th>
                        <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 whitespace-nowrap">状态</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailModal.rows.length === 0 && (
                        <tr><td colSpan={10} className="py-8 text-center text-gray-400 text-sm">暂无数据</td></tr>
                      )}
                      {detailModal.rows.map((row) => (
                        <tr key={row.id} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="py-2 px-3 text-gray-400 whitespace-nowrap">{row.orderDate ? new Date(row.orderDate).toLocaleDateString() : "-"}</td>
                          <td className="py-2 px-3 text-gray-500 whitespace-nowrap">{row.customerName}</td>
                          <td className="py-2 px-3 whitespace-nowrap">{row.categoryName ? <span className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-medium">{row.categoryName}</span> : <span className="text-xs text-gray-300">-</span>}</td>
                          <td className="py-2 px-3 text-gray-500 whitespace-nowrap">{row.productName}</td>
                          <td className="py-2 px-3 text-right whitespace-nowrap">{row.quantity} kg</td>
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
                          <td className="py-2 px-3"><span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 whitespace-nowrap">{row.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </DialogContent>
            </Dialog>

            {/* 回款明细弹窗 */}
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

          </CardContent>
        </Card>
      )}

      {/* 顶部统计 */}
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
            <div>
              <p className="text-xs text-gray-400">本月回款</p>
              <p className="text-xl font-bold">¥{(Number(stats?.payments.monthTotal ?? 0)).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
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
                <p className="text-sm font-medium mt-1">¥{item.amount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
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
    </div>
  );
}
