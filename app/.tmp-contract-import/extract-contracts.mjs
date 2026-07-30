import fs from "node:fs/promises";
import * as XLSX from "xlsx";

const sourcePath = "C:/Users/02/Downloads/所有合同列表_20260729141532_张夏.xls";
const buffer = await fs.readFile(sourcePath);
const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true, raw: true });

const result = {
  sheetNames: workbook.SheetNames,
  sheets: workbook.SheetNames.map((name) => {
    const sheet = workbook.Sheets[name];
    const range = sheet["!ref"] ?? null;
    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: null,
      raw: true,
      blankrows: false,
    });
    return { name, range, rowCount: rows.length, rows };
  }),
};

await fs.writeFile(
  "D:/projects/sale-manager/app/.tmp-contract-import/extracted-contracts.json",
  JSON.stringify(result, null, 2),
  "utf8",
);

console.log(JSON.stringify({
  sheetNames: result.sheetNames,
  sheets: result.sheets.map((sheet) => ({
    name: sheet.name,
    range: sheet.range,
    rowCount: sheet.rowCount,
    preview: sheet.rows.slice(0, 20),
  })),
}, null, 2));
