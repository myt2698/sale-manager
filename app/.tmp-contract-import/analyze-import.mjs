import fs from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";

const extracted = JSON.parse(
  await fs.readFile("D:/projects/sale-manager/app/.tmp-contract-import/extracted-contracts.json", "utf8"),
);
const rows = extracted.sheets[0].rows;
const headers = rows[0];
const col = Object.fromEntries(headers.map((name, index) => [name, index]));

const contracts = [];
let current = null;
for (const row of rows.slice(1)) {
  const contractNo = String(row[col["合同编号"]] ?? "").trim();
  if (contractNo && contractNo !== "【产品明细2】") {
    current = {
      contractNo,
      startDate: row[col["开始日期"]] ?? null,
      customerName: String(row[col["客户名称"]] ?? "").trim(),
      customerCode: String(row[col["客户编号"]] ?? "").trim(),
      customerOrderNo: String(row[col["客户订单号"]] ?? "").trim(),
      shippingAddress: String(row[col["收货地址"]] ?? "").trim(),
      products: [],
    };
    contracts.push(current);
    continue;
  }
  if (contractNo === "【产品明细2】" && current) {
    current.products.push({
      productName: String(row[col["产品名称"]] ?? "").trim(),
      productCode: String(row[col["产品编号"]] ?? "").trim(),
      productModel: String(row[col["型号"]] ?? "").trim(),
      quantity: Number(row[col["数量"]] ?? 0),
      unitPrice: Number(row[col["含税单价"]] ?? 0),
      amount: Number(row[col["金额"]] ?? 0),
      unit: String(row[col["单位"]] ?? "").trim(),
    });
  }
}

const db = new DatabaseSync("D:/projects/sale-manager/app/release-ready/data/sales-manager.db", { readOnly: true });
const stateRows = db.prepare("SELECT key, value, updated_at FROM app_state ORDER BY key").all();
db.close();
const state = Object.fromEntries(stateRows.map((row) => [row.key, JSON.parse(row.value)]));

const existing = {
  customers: state["sales-sys-customers"] ?? [],
  products: state["sales-sys-products"] ?? [],
  categories: state["sales-sys-productCategories"] ?? [],
  sampleOrders: state["sales-sys-sampleOrders"] ?? [],
  nextId: state["sales-sys-nextId"] ?? {},
};

const uniqueCustomers = [...new Set(contracts.map((c) => c.customerName).filter(Boolean))];
const productPairs = new Map();
for (const contract of contracts) {
  for (const product of contract.products) {
    const key = `${product.productCode}\u0000${product.productName}\u0000${product.productModel}`;
    if (!productPairs.has(key)) productPairs.set(key, product);
  }
}
const duplicateContractNos = contracts
  .map((c) => c.contractNo)
  .filter((value, index, array) => array.indexOf(value) !== index);
const existingContractNos = new Set(existing.sampleOrders.map((o) => String(o.orderNo ?? "").trim()));
const alreadyImported = contracts.filter((c) => existingContractNos.has(c.contractNo)).map((c) => c.contractNo);

const analysis = {
  source: {
    contractCount: contracts.length,
    productLineCount: contracts.reduce((sum, c) => sum + c.products.length, 0),
    uniqueCustomerCount: uniqueCustomers.length,
    uniqueProductCount: productPairs.size,
    multiProductContracts: contracts.filter((c) => c.products.length > 1).map((c) => ({ contractNo: c.contractNo, productCount: c.products.length })),
    missingCustomer: contracts.filter((c) => !c.customerName).map((c) => c.contractNo),
    missingStartDate: contracts.filter((c) => !c.startDate).map((c) => c.contractNo),
    missingProducts: contracts.filter((c) => c.products.length === 0).map((c) => c.contractNo),
    invalidProducts: contracts.flatMap((c) => c.products
      .filter((p) => !p.productName || !p.productCode || !p.productModel || !Number.isFinite(p.quantity) || p.quantity <= 0)
      .map((p) => ({ contractNo: c.contractNo, ...p }))),
    duplicateContractNos,
  },
  existing: {
    customerCount: existing.customers.length,
    productCount: existing.products.length,
    categoryCount: existing.categories.length,
    categories: existing.categories.map((c) => ({ id: c.id, name: c.name })),
    sampleOrderCount: existing.sampleOrders.length,
    alreadyImported,
  },
  matching: {
    existingCustomers: uniqueCustomers.filter((name) => existing.customers.some((c) => String(c.companyName ?? "").trim() === name)),
    newCustomers: uniqueCustomers.filter((name) => !existing.customers.some((c) => String(c.companyName ?? "").trim() === name)),
  },
  contracts,
};

await fs.writeFile(
  "D:/projects/sale-manager/app/.tmp-contract-import/import-analysis.json",
  JSON.stringify(analysis, null, 2),
  "utf8",
);

console.log(JSON.stringify({
  source: analysis.source,
  existing: analysis.existing,
  matching: {
    existingCustomerCount: analysis.matching.existingCustomers.length,
    newCustomerCount: analysis.matching.newCustomers.length,
    newCustomers: analysis.matching.newCustomers,
  },
  sourceProducts: [...productPairs.values()],
  existingProducts: existing.products.map((p) => ({
    id: p.id,
    productName: p.productName,
    productCode: p.productCode,
    productModel: p.productModel,
    categoryId: p.categoryId,
    categoryName: p.categoryName,
  })),
}, null, 2));
