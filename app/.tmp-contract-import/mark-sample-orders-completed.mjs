import fs from "node:fs";
import path from "node:path";
import AdmZip from "adm-zip";
import { DatabaseSync } from "node:sqlite";

const dataDir = process.env.SALE_MANAGER_DATA_DIR || "D:/projects/sale-manager/app/release-ready/data";
const dbPath = path.join(dataDir, "sales-manager.db");
const resultPath = path.join(dataDir, "exports", "样品订单状态批量更新结果.json");
const errorPath = path.join(dataDir, "exports", "样品订单状态批量更新错误.log");

function createBackup(db) {
  db.exec("PRAGMA wal_checkpoint(FULL)");
  const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19);
  const backupPath = path.join(dataDir, "backups", `样品订单状态更新前备份-${stamp}.zip`);
  const zip = new AdmZip();
  zip.addLocalFile(dbPath);
  const attachments = path.join(dataDir, "attachments");
  if (fs.existsSync(attachments)) zip.addLocalFolder(attachments, "attachments");
  zip.addFile("backup-info.json", Buffer.from(JSON.stringify({
    format: "sale-manager-backup",
    version: 1,
    createdAt: new Date().toISOString(),
    reason: "批量将待排产样品订单改为已完成",
  }, null, 2), "utf8"));
  zip.writeZip(backupPath);
  return backupPath;
}

try {
  const db = new DatabaseSync(dbPath);
  const backupPath = createBackup(db);
  const orderRow = db.prepare("SELECT value FROM app_state WHERE key = ?").get("sales-sys-sampleOrders");
  const shipmentRow = db.prepare("SELECT value FROM app_state WHERE key = ?").get("sales-sys-sampleShipments");
  const orders = orderRow ? JSON.parse(orderRow.value) : [];
  const shipments = shipmentRow ? JSON.parse(shipmentRow.value) : {};
  const now = new Date().toISOString();
  const changedOrderNos = [];

  for (const order of orders) {
    const orderShipments = shipments[order.id] ?? shipments[String(order.id)] ?? [];
    const storedStatus = order.orderStatus ?? order.status ?? "待排产";
    if (storedStatus === "待排产" && orderShipments.length === 0) {
      order.orderStatus = "已完成";
      order.status = "已完成";
      order.manualCompleted = true;
      order.updatedAt = now;
      if (!Array.isArray(order.statusHistory)) order.statusHistory = [];
      if (order.statusHistory.at(-1)?.status !== "已完成") {
        order.statusHistory.push({ status: "已完成", timestamp: now });
      }
      changedOrderNos.push(order.orderNo);
    }
  }

  const update = db.prepare(`
    INSERT INTO app_state(key, value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at
  `);
  db.exec("BEGIN IMMEDIATE");
  try {
    update.run("sales-sys-sampleOrders", JSON.stringify(orders), now);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  const verifyOrders = JSON.parse(
    db.prepare("SELECT value FROM app_state WHERE key = ?").get("sales-sys-sampleOrders").value,
  );
  db.close();
  const remaining = verifyOrders.filter((order) => {
    const orderShipments = shipments[order.id] ?? shipments[String(order.id)] ?? [];
    return (order.orderStatus ?? order.status) === "待排产" && orderShipments.length === 0;
  });
  if (remaining.length > 0) throw new Error(`仍有 ${remaining.length} 笔无发货记录的待排产样品订单`);

  fs.writeFileSync(resultPath, JSON.stringify({
    success: true,
    completedAt: new Date().toISOString(),
    backupPath,
    changedCount: changedOrderNos.length,
    changedOrderNos,
    remainingPendingProductionCount: remaining.length,
  }, null, 2), "utf8");
  if (fs.existsSync(errorPath)) fs.rmSync(errorPath);
} catch (error) {
  fs.mkdirSync(path.dirname(errorPath), { recursive: true });
  fs.writeFileSync(errorPath, `${new Date().toISOString()}\n${error?.stack ?? error}`, "utf8");
  process.exitCode = 1;
}
