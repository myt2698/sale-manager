import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const sourcePath = "C:/Users/02/Downloads/所有合同列表_20260729141532_张夏.xls";
const input = await FileBlob.load(sourcePath);
const workbook = await SpreadsheetFile.importXlsx(input);

const summary = await workbook.inspect({
  kind: "workbook,sheet,table",
  maxChars: 12000,
  tableMaxRows: 12,
  tableMaxCols: 20,
  tableMaxCellChars: 120,
});
console.log(summary.ndjson);

const sheetInfo = await workbook.inspect({
  kind: "sheet",
  include: "id,name",
  maxChars: 4000,
});
console.log(sheetInfo.ndjson);

const firstSheet = workbook.worksheets.getItemAt(0);
const usedRange = firstSheet.getUsedRange();
console.log(JSON.stringify({ firstSheet: firstSheet.name, usedRange: usedRange?.address ?? null }));

const preview = await workbook.render({
  sheetName: firstSheet.name,
  autoCrop: "all",
  scale: 1,
  format: "png",
});
await fs.writeFile(
  "D:/projects/sale-manager/app/.tmp-contract-import/source-preview.png",
  new Uint8Array(await preview.arrayBuffer()),
);
