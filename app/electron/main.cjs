const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const { DatabaseSync } = require("node:sqlite");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const AdmZip = require("adm-zip");

const isDev = !app.isPackaged;
let db;
let dataDir;

function isBusinessKey(key) {
  return key.startsWith("sales-sys-") || key === "filename-generator-history";
}

function resolveDataDir() {
  const portableRoot = process.env.PORTABLE_EXECUTABLE_DIR;
  if (portableRoot) return path.join(portableRoot, "data");
  return path.join(app.getPath("desktop"), "销售管理系统数据");
}

function ensureDataStore() {
  dataDir = resolveDataDir();
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(path.join(dataDir, "attachments"), { recursive: true });
  fs.mkdirSync(path.join(dataDir, "backups"), { recursive: true });
  fs.mkdirSync(path.join(dataDir, "exports"), { recursive: true });
  db = new DatabaseSync(path.join(dataDir, "sales-manager.db"));
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS app_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
}

function loadState() {
  const rows = db.prepare("SELECT key, value FROM app_state").all();
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

function saveState(state) {
  const upsert = db.prepare(`
    INSERT INTO app_state(key, value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at
  `);
  const remove = db.prepare("DELETE FROM app_state WHERE key = ?");
  const existing = new Set(db.prepare("SELECT key FROM app_state").all().map((row) => row.key));
  const now = new Date().toISOString();
  db.exec("BEGIN");
  try {
    for (const [key, value] of Object.entries(state || {})) {
      if (isBusinessKey(key)) {
        upsert.run(key, String(value), now);
        existing.delete(key);
      }
    }
    for (const key of existing) remove.run(key);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function backupName() {
  const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19);
  return `销售管理系统备份-${stamp}.zip`;
}

function createBackup(targetPath) {
  if (db) db.exec("PRAGMA wal_checkpoint(FULL)");
  const zip = new AdmZip();
  const dbPath = path.join(dataDir, "sales-manager.db");
  if (fs.existsSync(dbPath)) zip.addLocalFile(dbPath);
  const attachments = path.join(dataDir, "attachments");
  if (fs.existsSync(attachments)) zip.addLocalFolder(attachments, "attachments");
  zip.addFile("backup-info.json", Buffer.from(JSON.stringify({
    format: "sale-manager-backup",
    version: 1,
    createdAt: new Date().toISOString(),
  }, null, 2), "utf8"));
  zip.writeZip(targetPath);
}

async function restoreBackup(sourcePath) {
  const zip = new AdmZip(sourcePath);
  const info = zip.getEntry("backup-info.json");
  const database = zip.getEntry("sales-manager.db");
  if (!info || !database) throw new Error("不是有效的销售管理系统备份文件");
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sale-manager-restore-"));
  zip.extractAllTo(tempDir, true);
  if (db) db.close();
  fs.copyFileSync(path.join(tempDir, "sales-manager.db"), path.join(dataDir, "sales-manager.db"));
  const sourceAttachments = path.join(tempDir, "attachments");
  if (fs.existsSync(sourceAttachments)) {
    fs.cpSync(sourceAttachments, path.join(dataDir, "attachments"), { recursive: true, force: true });
  }
  ensureDataStore();
  fs.rmSync(tempDir, { recursive: true, force: true });
}

function registerIpc() {
  ipcMain.handle("desktop:load-state", () => loadState());
  ipcMain.handle("desktop:save-state", (_event, state) => {
    saveState(state);
    return { ok: true };
  });
  ipcMain.handle("desktop:info", () => ({
    dataDir,
    databasePath: path.join(dataDir, "sales-manager.db"),
    isPortable: Boolean(process.env.PORTABLE_EXECUTABLE_DIR),
  }));
  ipcMain.handle("desktop:open-data-dir", () => shell.openPath(dataDir));
  ipcMain.handle("desktop:backup", async () => {
    const defaultPath = path.join(dataDir, "backups", backupName());
    const result = await dialog.showSaveDialog({
      title: "导出完整备份",
      defaultPath,
      filters: [{ name: "销售管理系统备份", extensions: ["zip"] }],
    });
    if (result.canceled || !result.filePath) return { canceled: true };
    createBackup(result.filePath);
    return { canceled: false, filePath: result.filePath };
  });
  ipcMain.handle("desktop:restore", async () => {
    const result = await dialog.showOpenDialog({
      title: "恢复完整备份",
      properties: ["openFile"],
      filters: [{ name: "销售管理系统备份", extensions: ["zip"] }],
    });
    if (result.canceled || !result.filePaths[0]) return { canceled: true };
    await restoreBackup(result.filePaths[0]);
    return { canceled: false, state: loadState() };
  });
  ipcMain.handle("desktop:save-export", async (_event, { name, base64 }) => {
    const result = await dialog.showSaveDialog({
      title: "导出 Excel",
      defaultPath: path.join(dataDir, "exports", name),
      filters: [{ name: "Excel 工作簿", extensions: ["xlsx"] }],
    });
    if (result.canceled || !result.filePath) return { canceled: true };
    fs.writeFileSync(result.filePath, Buffer.from(base64, "base64"));
    return { canceled: false, filePath: result.filePath };
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    title: "销售管理系统",
    icon: isDev
      ? path.join(__dirname, "../public/icon-rounded.png")
      : path.join(__dirname, "../dist/public/icon-rounded.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.once("ready-to-show", () => win.show());
  if (isDev) win.loadURL("http://127.0.0.1:3000");
  else win.loadFile(path.join(__dirname, "../dist/public/index.html"));
}

app.whenReady().then(() => {
  ensureDataStore();
  registerIpc();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (db) db.close();
  if (process.platform !== "darwin") app.quit();
});
