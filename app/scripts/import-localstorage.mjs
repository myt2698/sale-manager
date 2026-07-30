import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const [, , sourceArg, dataDirArg] = process.argv;
if (!sourceArg || !dataDirArg) {
  throw new Error("Usage: node scripts/import-localstorage.mjs <backup.json> <data-directory>");
}

const sourcePath = path.resolve(sourceArg);
const dataDir = path.resolve(dataDirArg);
const raw = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
const state = raw?.format === "sale-manager-browser-data" ? raw.state : raw;
if (!state || typeof state !== "object" || Array.isArray(state)) {
  throw new Error("Invalid localStorage backup");
}

const isBusinessKey = (key) =>
  key.startsWith("sales-sys-") || key === "filename-generator-history";
const entries = Object.entries(state).filter(
  ([key, value]) => isBusinessKey(key) && typeof value === "string",
);
if (!entries.length) throw new Error("No sale-manager data found");

fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(path.join(dataDir, "attachments"), { recursive: true });
fs.mkdirSync(path.join(dataDir, "backups"), { recursive: true });
fs.mkdirSync(path.join(dataDir, "exports"), { recursive: true });

const dbPath = path.join(dataDir, "sales-manager.db");
if (fs.existsSync(dbPath)) {
  const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19);
  fs.copyFileSync(dbPath, path.join(dataDir, "backups", `导入前数据库-${stamp}.db`));
}

const db = new DatabaseSync(dbPath);
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS app_state (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);
const upsert = db.prepare(`
  INSERT INTO app_state(key, value, updated_at)
  VALUES (?, ?, ?)
  ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at
`);
const now = new Date().toISOString();
db.exec("BEGIN");
try {
  db.exec("DELETE FROM app_state");
  for (const [key, value] of entries) upsert.run(key, value, now);
  db.exec("COMMIT");
} catch (error) {
  db.exec("ROLLBACK");
  throw error;
} finally {
  db.close();
}

const counts = {};
for (const [key, value] of entries) {
  try {
    const decoded = JSON.parse(value);
    counts[key] = Array.isArray(decoded)
      ? decoded.length
      : decoded && typeof decoded === "object"
        ? Object.keys(decoded).length
        : 1;
  } catch {
    counts[key] = 1;
  }
}

console.log(JSON.stringify({ dbPath, importedKeys: entries.length, counts }, null, 2));
