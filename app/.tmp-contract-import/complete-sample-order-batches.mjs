import fs from "node:fs";
import path from "node:path";
import AdmZip from "adm-zip";
import { DatabaseSync } from "node:sqlite";

const dataDir = process.env.SALE_MANAGER_DATA_DIR || "D:/projects/sale-manager/app/release-ready/data";
const excludedOrderNo = "QXHZ202600041";
const dbPath = path.join(dataDir, "sales-manager.db");
const resultPath = path.join(dataDir, "exports", "样品订单批次批量完成结果.json");
const errorPath = path.join(dataDir, "exports", "样品订单批次批量完成错误.log");

function createBackup(db) {
  db.exec("PRAGMA wal_checkpoint(FULL)");
  const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19);
  const backupPath = path.join(dataDir, "backups", `样品订单批次更新前备份-${stamp}.zip`);
  const zip = new AdmZip();
  zip.addLocalFile(dbPath);
  const attachments = path.join(dataDir, "attachments");
  if (fs.existsSync(attachments)) zip.addLocalFolder(attachments, "attachments");
  zip.addFile("backup-info.json", Buffer.from(JSON.stringify({
    format: "sale-manager-backup",
    version: 1,
    createdAt: new Date().toISOString(),
    reason: `除 ${excludedOrderNo} 外，批量将全部样品订单设为全部发货、已签收、已支付、已开票`,
  }, null, 2), "utf8"));
  zip.writeZip(backupPath);
  return backupPath;
}

function getState(db, key, fallback) {
  const row = db.prepare("SELECT value FROM app_state WHERE key = ?").get(key);
  return row ? JSON.parse(row.value) : fallback;
}

function quantityText(value) {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number)) return "0";
  return number.toFixed(6).replace(/\.?0+$/, "");
}

function getProductNames(order) {
  const names = (order.items ?? [])
    .map(item => String(item.productName ?? "").trim())
    .filter(Boolean);
  return [...new Set(names)].join("、") || String(order.productName ?? "");
}

try {
  fs.mkdirSync(path.join(dataDir, "backups"), { recursive: true });
  fs.mkdirSync(path.join(dataDir, "exports"), { recursive: true });

  const db = new DatabaseSync(dbPath);
  const orders = getState(db, "sales-sys-sampleOrders", []);
  const shipments = getState(db, "sales-sys-sampleShipments", {});
  const nextId = getState(db, "sales-sys-nextId", {});
  const excludedOrder = orders.find(order => order.orderNo === excludedOrderNo);
  if (!excludedOrder) throw new Error(`未找到需要排除的样品订单 ${excludedOrderNo}`);

  const excludedOrderBefore = JSON.stringify(excludedOrder);
  const excludedShipmentsBefore = JSON.stringify(shipments[excludedOrder.id] ?? shipments[String(excludedOrder.id)] ?? []);
  const backupPath = createBackup(db);
  const now = new Date().toISOString();
  let shipmentId = Number(nextId.sampleShipment ?? 1);
  let newShipmentCount = 0;
  let existingShipmentCount = 0;
  const changedOrderNos = [];

  for (const order of orders) {
    if (order.orderNo === excludedOrderNo) continue;

    const key = String(order.id);
    const orderShipments = shipments[key] ?? shipments[order.id] ?? [];
    shipments[key] = orderShipments;
    existingShipmentCount += orderShipments.length;

    const orderQuantity = Number(order.quantity ?? 0);
    const allocatedQuantity = orderShipments.reduce(
      (sum, shipment) => sum + Number(shipment.quantity ?? 0),
      0,
    );
    const remainingQuantity = Math.max(0, orderQuantity - allocatedQuantity);

    if (orderShipments.length === 0 || remainingQuantity > 0.0000001) {
      const batchQuantity = orderShipments.length === 0 ? orderQuantity : remainingQuantity;
      orderShipments.push({
        id: shipmentId++,
        orderId: order.id,
        quantity: quantityText(batchQuantity),
        productName: getProductNames(order),
        logisticsCompany: order.logisticsCompany ?? "",
        logisticsNo: order.logisticsNo ?? "",
        shippedDate: now,
        productionDate: now,
        shippingStatus: "已发货",
        receivingStatus: "已签收",
        paymentStatus: "已支付",
        afterSalesStatus: "无售后",
        invoiceStatus: "已开票",
        reconciliationStatus: "已对账",
        flowType: "cash",
        receivedAmount: "0.00",
        refundedAmount: "0.00",
        paymentDueDate: null,
        shippingDate: now,
        receivingDate: now,
        paymentDate: now,
        invoiceDate: now,
        reconciliationDate: now,
      });
      newShipmentCount += 1;
    }

    for (const shipment of orderShipments) {
      shipment.shippingStatus = "已发货";
      shipment.receivingStatus = "已签收";
      shipment.paymentStatus = "已支付";
      shipment.invoiceStatus = "已开票";
      shipment.reconciliationStatus = "已对账";
      shipment.shippingDate ??= now;
      shipment.shippedDate ??= now;
      shipment.receivingDate ??= now;
      shipment.paymentDate ??= now;
      shipment.invoiceDate ??= now;
      shipment.reconciliationDate ??= now;
      shipment.paymentDueDate = null;
    }

    order.manualCompleted = false;
    order.orderStatus = "已完成";
    order.status = "已完成";
    order.completedDate ??= now;
    order.updatedAt = now;
    if (!Array.isArray(order.statusHistory)) order.statusHistory = [];
    if (order.statusHistory.at(-1)?.status !== "已完成") {
      order.statusHistory.push({ status: "已完成", timestamp: now });
    }
    changedOrderNos.push(order.orderNo);
  }

  nextId.sampleShipment = shipmentId;
  const upsert = db.prepare(`
    INSERT INTO app_state(key, value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at
  `);
  db.exec("BEGIN IMMEDIATE");
  try {
    upsert.run("sales-sys-sampleOrders", JSON.stringify(orders), now);
    upsert.run("sales-sys-sampleShipments", JSON.stringify(shipments), now);
    upsert.run("sales-sys-nextId", JSON.stringify(nextId), now);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  const verifyOrders = getState(db, "sales-sys-sampleOrders", []);
  const verifyShipments = getState(db, "sales-sys-sampleShipments", {});
  const verifyExcludedOrder = verifyOrders.find(order => order.orderNo === excludedOrderNo);
  const verifyExcludedShipments = verifyShipments[String(excludedOrder.id)] ?? verifyShipments[excludedOrder.id] ?? [];
  if (JSON.stringify(verifyExcludedOrder) !== excludedOrderBefore ||
      JSON.stringify(verifyExcludedShipments) !== excludedShipmentsBefore) {
    throw new Error(`排除订单 ${excludedOrderNo} 或其发货批次发生了变化`);
  }

  const invalidOrders = verifyOrders
    .filter(order => order.orderNo !== excludedOrderNo)
    .filter(order => {
      const orderShipments = verifyShipments[String(order.id)] ?? verifyShipments[order.id] ?? [];
      const shippedQuantity = orderShipments.reduce(
        (sum, shipment) => sum + Number(shipment.quantity ?? 0),
        0,
      );
      return orderShipments.length === 0 ||
        shippedQuantity + 0.0000001 < Number(order.quantity ?? 0) ||
        orderShipments.some(shipment =>
          shipment.shippingStatus !== "已发货" ||
          shipment.receivingStatus !== "已签收" ||
          shipment.paymentStatus !== "已支付" ||
          shipment.invoiceStatus !== "已开票" ||
          shipment.reconciliationStatus !== "已对账"
        );
    })
    .map(order => order.orderNo);
  db.close();

  if (invalidOrders.length > 0) {
    throw new Error(`仍有 ${invalidOrders.length} 笔样品订单未达到目标状态：${invalidOrders.join("、")}`);
  }

  fs.writeFileSync(resultPath, JSON.stringify({
    success: true,
    completedAt: new Date().toISOString(),
    backupPath,
    excludedOrderNo,
    excludedOrderUnchanged: true,
    changedOrderCount: changedOrderNos.length,
    newShipmentCount,
    existingShipmentCount,
    changedOrderNos,
    invalidOrderCount: invalidOrders.length,
  }, null, 2), "utf8");
  if (fs.existsSync(errorPath)) fs.rmSync(errorPath);
} catch (error) {
  fs.mkdirSync(path.dirname(errorPath), { recursive: true });
  fs.writeFileSync(errorPath, `${new Date().toISOString()}\n${error?.stack ?? error}`, "utf8");
  process.exitCode = 1;
}
