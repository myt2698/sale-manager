# 销售管理系统 Windows 桌面版

## 运行方式

构建产物：

```text
release-ready/销售管理系统.exe
```

将这个 EXE 复制到任意文件夹后运行。程序会在 EXE 旁创建：

```text
data/
├─ sales-manager.db
├─ attachments/
├─ backups/
└─ exports/
```

把 EXE 和 `data` 文件夹一起复制给另一台电脑，即可继续使用原数据。

## 备份与恢复

进入左侧“数据与备份”：

- “导出 ZIP 备份”包含 SQLite 数据库和附件。
- “选择备份恢复”会用备份替换当前数据。
- “导出 Excel”会生成客户、产品、报价、订单、发货、回款等工作表。

恢复前建议先导出当前完整备份。

## 从旧网页迁移

旧网页的数据保存在当时使用的浏览器本地，不能仅凭网页链接在另一浏览器读取。

1. 在原来保存数据的浏览器中打开旧网页并登录。
2. 按 `F12`，进入 Console（控制台）。
3. 粘贴并执行下面的脚本：

```js
(() => {
  const state = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith("sales-sys-")) state[key] = localStorage.getItem(key);
  }
  const payload = {
    format: "sale-manager-browser-data",
    version: 1,
    exportedAt: new Date().toISOString(),
    state,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `销售管理系统旧网页数据-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
})();
```

4. 在桌面版打开“数据与备份”，点击“导入旧网页数据”，选择下载的 JSON。

## 开发

```powershell
pnpm install
pnpm desktop:dev
pnpm desktop:build
```

桌面版使用 Electron 内置的 SQLite，不需要 MySQL、云服务器或网络连接。
