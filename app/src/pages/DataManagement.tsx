import { useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Archive, Database, Download, FileJson, FolderOpen, RefreshCw, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const exportSheets: Array<{ key: string; title: string }> = [
  { key: "sales-sys-customers", title: "客户" },
  { key: "sales-sys-products", title: "产品" },
  { key: "sales-sys-productCategories", title: "产品分类" },
  { key: "sales-sys-quotationRules", title: "报价规则" },
  { key: "sales-sys-quotationRecords", title: "报价记录" },
  { key: "sales-sys-salesOrders", title: "销售订单" },
  { key: "sales-sys-shipments", title: "发货批次" },
  { key: "sales-sys-returns", title: "退货售后" },
  { key: "sales-sys-payments", title: "回款记录" },
  { key: "sales-sys-reminders", title: "提醒" },
];

const isBusinessKey = (key: string) =>
  key.startsWith("sales-sys-") || key === "filename-generator-history";

function parseRows(key: string): Record<string, unknown>[] {
  const raw = localStorage.getItem(key);
  if (!raw) return [];
  try {
    const value = JSON.parse(raw);
    if (Array.isArray(value)) return value;
    if (value && typeof value === "object") {
      return Object.entries(value).flatMap(([parentId, rows]) =>
        Array.isArray(rows) ? rows.map((row) => ({ parentId, ...row })) : [],
      );
    }
  } catch {
    return [];
  }
  return [];
}

function workbookBase64() {
  const workbook = XLSX.utils.book_new();
  for (const sheet of exportSheets) {
    const rows = parseRows(sheet.key).map((row) => {
      const flat: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(row)) {
        flat[key] = value && typeof value === "object" ? JSON.stringify(value) : value;
      }
      return flat;
    });
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(rows.length ? rows : [{ 提示: "暂无数据" }]),
      sheet.title.slice(0, 31),
    );
  }
  return XLSX.write(workbook, { type: "base64", bookType: "xlsx" });
}

function snapshotLocalData(): Record<string, string> {
  const state: Record<string, string> = {};
  for (let index = 0; index < localStorage.length; index++) {
    const key = localStorage.key(index);
    if (key && isBusinessKey(key)) {
      const value = localStorage.getItem(key);
      if (value !== null) state[key] = value;
    }
  }
  return state;
}

export default function DataManagement() {
  const [info, setInfo] = useState<{ dataDir: string; databasePath: string; isPortable: boolean }>();
  const importRef = useRef<HTMLInputElement>(null);
  const desktop = window.desktopAPI;

  useEffect(() => {
    void desktop?.getInfo().then(setInfo);
  }, [desktop]);

  const backup = async () => {
    if (!desktop) return toast.error("完整备份仅在 Windows 桌面版中可用");
    const result = await desktop.createBackup();
    if (!result.canceled) toast.success(`备份已保存：${result.filePath}`);
  };

  const restore = async () => {
    if (!desktop) return toast.error("恢复备份仅在 Windows 桌面版中可用");
    if (!window.confirm("恢复备份会替换当前数据。建议先导出一次当前备份，确定继续吗？")) return;
    const result = await desktop.restoreBackup();
    if (!result.canceled && result.state) {
      Object.keys(localStorage)
        .filter(isBusinessKey)
        .forEach((key) => localStorage.removeItem(key));
      Object.entries(result.state).forEach(([key, value]) => localStorage.setItem(key, value));
      toast.success("备份恢复成功，软件即将重新加载");
      window.setTimeout(() => window.location.reload(), 500);
    }
  };

  const exportExcel = async () => {
    const name = `销售管理系统数据-${new Date().toISOString().slice(0, 10)}.xlsx`;
    const base64 = workbookBase64();
    if (desktop) {
      const result = await desktop.saveExport({ name, base64 });
      if (!result.canceled) toast.success(`Excel 已导出：${result.filePath}`);
      return;
    }
    const anchor = document.createElement("a");
    anchor.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${base64}`;
    anchor.download = name;
    anchor.click();
  };

  const exportMigration = () => {
    const payload = {
      format: "sale-manager-browser-data",
      version: 1,
      exportedAt: new Date().toISOString(),
      state: snapshotLocalData(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(blob);
    anchor.download = `销售管理系统旧网页数据-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(anchor.href);
  };

  const importMigration = async (file: File) => {
    try {
      const payload = JSON.parse(await file.text());
      const state = payload?.format === "sale-manager-browser-data" ? payload.state : payload;
      if (!state || typeof state !== "object") throw new Error("文件中没有可导入的数据");
      const entries = Object.entries(state).filter(
        ([key, value]) => isBusinessKey(key) && typeof value === "string",
      ) as Array<[string, string]>;
      if (!entries.length) throw new Error("没有找到销售管理系统数据");
      if (!window.confirm(`即将导入 ${entries.length} 组旧网页数据并替换当前数据，是否继续？`)) return;
      Object.keys(localStorage)
        .filter(isBusinessKey)
        .forEach((key) => localStorage.removeItem(key));
      entries.forEach(([key, value]) => localStorage.setItem(key, value));
      await desktop?.saveState(Object.fromEntries(entries));
      toast.success("旧网页数据导入成功，软件即将重新加载");
      window.setTimeout(() => window.location.reload(), 500);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "导入失败");
    } finally {
      if (importRef.current) importRef.current.value = "";
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-800">数据与备份</h1>
        <p className="text-sm text-slate-500 mt-1">所有业务数据保存在本机，可完整复制给另一台电脑继续使用。</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Database size={18} />本地数据</CardTitle>
          <CardDescription>便携版优先保存在软件旁的 data 文件夹，安装开发版保存在桌面专用目录。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-lg bg-slate-50 border p-3 text-sm text-slate-600 break-all">
            <div><span className="font-medium">数据目录：</span>{info?.dataDir ?? "浏览器演示模式"}</div>
            {info?.databasePath && <div className="mt-1"><span className="font-medium">数据库：</span>{info.databasePath}</div>}
          </div>
          <Button variant="outline" onClick={() => desktop?.openDataDir()} disabled={!desktop}>
            <FolderOpen size={16} />打开数据目录
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Archive size={18} />完整备份</CardTitle>
            <CardDescription>包含 SQLite 数据库和附件，适合迁移到另一台电脑。</CardDescription>
          </CardHeader>
          <CardContent><Button onClick={backup}>导出 ZIP 备份</Button></CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><RefreshCw size={18} />恢复备份</CardTitle>
            <CardDescription>从完整备份恢复，并替换当前软件中的业务数据。</CardDescription>
          </CardHeader>
          <CardContent><Button variant="outline" onClick={restore}>选择备份恢复</Button></CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Download size={18} />Excel 导出</CardTitle>
            <CardDescription>将客户、产品、报价、订单、发货、回款等导出为多个工作表。</CardDescription>
          </CardHeader>
          <CardContent><Button variant="outline" onClick={exportExcel}>导出 Excel</Button></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><FileJson size={18} />旧网页数据迁移</CardTitle>
          <CardDescription>
            在旧网页的“数据与备份”页面导出迁移文件，再在桌面版导入。该文件包含浏览器中保存的全部业务数据。
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={exportMigration}><Download size={16} />导出网页迁移文件</Button>
          <Button variant="outline" onClick={() => importRef.current?.click()}><Upload size={16} />导入旧网页数据</Button>
          <input
            ref={importRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importMigration(file);
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
