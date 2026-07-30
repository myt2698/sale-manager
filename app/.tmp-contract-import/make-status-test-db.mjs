import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";

const outputDir = "D:/projects/sale-manager/app/.tmp-contract-import/test-data-2";
const outputDb = `${outputDir}/sales-manager.db`;
fs.mkdirSync(`${outputDir}/backups`, { recursive: true });
fs.mkdirSync(`${outputDir}/exports`, { recursive: true });
if (fs.existsSync(outputDb)) throw new Error(`测试数据库已存在：${outputDb}`);

const source = new DatabaseSync(
  "D:/projects/sale-manager/app/release-ready/data/sales-manager.db",
  { readOnly: true },
);
source.exec(`VACUUM INTO '${outputDb.replaceAll("'", "''")}'`);
source.close();
