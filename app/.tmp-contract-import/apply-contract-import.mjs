import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import AdmZip from "adm-zip";
import { DatabaseSync } from "node:sqlite";

const sourcePath = "C:/Users/02/Downloads/所有合同列表_20260729141532_张夏.xls";
const dataDir = process.env.SALE_MANAGER_DATA_DIR || "D:/projects/sale-manager/app/release-ready/data";
const dbPath = path.join(dataDir, "sales-manager.db");
const resultPath = path.join(dataDir, "exports", "样品订单导入结果.json");
const errorPath = path.join(dataDir, "exports", "样品订单导入错误.log");

const normalize = (value) => String(value ?? "").trim().replace(/\s+/g, " ").toUpperCase();
const blankChecklist = () => ({
  contactNameChecked: false,
  contactPhoneChecked: false,
  bankNameChecked: false,
  bankAccountChecked: false,
  bankAccountNameChecked: false,
  shippingNameChecked: false,
  shippingPhoneChecked: false,
  shippingAddressChecked: false,
  riskDocChecked: false,
  infoDocChecked: false,
});

function parseContracts() {
  const workbook = XLSX.read(fs.readFileSync(sourcePath), {
    type: "buffer",
    cellDates: true,
    raw: true,
  });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
    raw: true,
    blankrows: false,
  });
  const headers = rows[0];
  const col = Object.fromEntries(headers.map((name, index) => [name, index]));
  const contracts = [];
  let current = null;
  for (const row of rows.slice(1)) {
    const contractNo = String(row[col["合同编号"]] ?? "").trim();
    if (contractNo && contractNo !== "【产品明细2】") {
      current = {
        contractNo,
        startDate: row[col["开始日期"]],
        customerName: String(row[col["客户名称"]] ?? "").trim(),
        products: [],
      };
      contracts.push(current);
      continue;
    }
    if (contractNo === "【产品明细2】" && current) {
      const quantity = Number(row[col["数量"]] ?? 0);
      const unitPrice = Number(row[col["含税单价"]] ?? 0);
      const amount = Number(row[col["金额"]] ?? quantity * unitPrice);
      current.products.push({
        productName: String(row[col["产品名称"]] ?? "").trim(),
        productCode: String(row[col["产品编号"]] ?? "").trim(),
        productModel: String(row[col["型号"]] ?? "").trim(),
        quantity,
        unitPrice: Number.isFinite(unitPrice) ? unitPrice : 0,
        subTotal: Number.isFinite(amount) ? amount : quantity * unitPrice,
      });
    }
  }
  const invalid = contracts.filter((contract) =>
    !contract.contractNo ||
    !contract.customerName ||
    !contract.startDate ||
    contract.products.length === 0 ||
    contract.products.some((product) =>
      !product.productName ||
      !product.productCode ||
      !product.productModel ||
      !Number.isFinite(product.quantity) ||
      product.quantity <= 0
    )
  );
  if (invalid.length > 0) {
    throw new Error(`源文件存在 ${invalid.length} 条无法导入的合同：${invalid.map((c) => c.contractNo).join(", ")}`);
  }
  return contracts;
}

function readState(db) {
  return Object.fromEntries(
    db.prepare("SELECT key, value FROM app_state").all().map((row) => [row.key, JSON.parse(row.value)]),
  );
}

function createBackup(db) {
  db.exec("PRAGMA wal_checkpoint(FULL)");
  const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19);
  const backupPath = path.join(dataDir, "backups", `合同导入前备份-${stamp}.zip`);
  const zip = new AdmZip();
  zip.addLocalFile(dbPath);
  const attachments = path.join(dataDir, "attachments");
  if (fs.existsSync(attachments)) zip.addLocalFolder(attachments, "attachments");
  zip.addFile("backup-info.json", Buffer.from(JSON.stringify({
    format: "sale-manager-backup",
    version: 1,
    createdAt: new Date().toISOString(),
    reason: "导入样品订单前自动备份",
    sourceFile: path.basename(sourcePath),
  }, null, 2), "utf8"));
  zip.writeZip(backupPath);
  return backupPath;
}

function allocateStart(nextId, key, items) {
  const maxExistingId = items.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0);
  return Math.max(Number(nextId[key]) || 1, maxExistingId + 1);
}

function main() {
  fs.mkdirSync(path.join(dataDir, "backups"), { recursive: true });
  fs.mkdirSync(path.join(dataDir, "exports"), { recursive: true });
  const contracts = parseContracts();
  const db = new DatabaseSync(dbPath);
  const backupPath = createBackup(db);
  const state = readState(db);

  const customers = [...(state["sales-sys-customers"] ?? [])];
  const products = [...(state["sales-sys-products"] ?? [])];
  const categories = [...(state["sales-sys-productCategories"] ?? [])];
  const sampleOrders = [...(state["sales-sys-sampleOrders"] ?? [])];
  const nextId = { ...(state["sales-sys-nextId"] ?? {}) };
  const now = new Date().toISOString();

  let tinPasteCategory = categories.find((category) => String(category.name ?? "").trim() === "锡膏");
  let createdCategory = false;
  if (!tinPasteCategory) {
    const categoryId = categories.reduce((max, category) => Math.max(max, Number(category.id) || 0), 0) + 1;
    tinPasteCategory = { id: categoryId, name: "锡膏", sortOrder: categories.length + 1, createdAt: now };
    categories.push(tinPasteCategory);
    createdCategory = true;
  }

  let customerId = allocateStart(nextId, "customer", customers);
  let productId = allocateStart(nextId, "product", products);
  let sampleOrderId = allocateStart(nextId, "sampleOrder", sampleOrders);
  let newCustomerCount = 0;
  let reusedCustomerCount = 0;
  let newProductCount = 0;
  let reusedProductCount = 0;
  let skippedOrderCount = 0;
  let importedOrderCount = 0;
  let importedProductLineCount = 0;

  const customerByName = new Map(customers.map((customer) => [String(customer.companyName ?? "").trim(), customer]));
  const findProduct = (sourceProduct) => products.find((product) =>
    normalize(product.productCode) === normalize(sourceProduct.productCode) &&
    normalize(product.productName) === normalize(sourceProduct.productName) &&
    normalize(product.productModel) === normalize(sourceProduct.productModel)
  );
  const existingOrderNos = new Set(sampleOrders.map((order) => String(order.orderNo ?? "").trim()));

  for (const contract of contracts) {
    if (existingOrderNos.has(contract.contractNo)) {
      skippedOrderCount += 1;
      continue;
    }

    let customer = customerByName.get(contract.customerName);
    if (!customer) {
      const id = customerId++;
      customer = {
        id,
        customerNo: `CUST-${String(id).padStart(6, "0")}`,
        companyName: contract.customerName,
        contactName: "",
        contactPhone: "",
        bankName: "",
        bankAccount: "",
        bankAccountName: "",
        shippingName: "",
        shippingPhone: "",
        shippingAddress: "",
        notes: "",
        checklist: blankChecklist(),
        createdAt: now,
        updatedAt: now,
      };
      customers.push(customer);
      customerByName.set(contract.customerName, customer);
      newCustomerCount += 1;
    } else {
      reusedCustomerCount += 1;
    }

    const items = contract.products.map((sourceProduct) => {
      let product = findProduct(sourceProduct);
      if (!product) {
        product = {
          id: productId++,
          productName: sourceProduct.productName,
          productCode: sourceProduct.productCode,
          productModel: sourceProduct.productModel,
          categoryId: tinPasteCategory.id,
          categoryName: "锡膏",
          description: "",
          createdAt: now,
          updatedAt: now,
        };
        products.unshift(product);
        newProductCount += 1;
      } else {
        reusedProductCount += 1;
      }
      return {
        productId: product.id,
        productName: sourceProduct.productName,
        categoryName: "锡膏",
        productCode: sourceProduct.productCode,
        productModel: sourceProduct.productModel,
        quantity: sourceProduct.quantity,
        unitPrice: sourceProduct.unitPrice,
        subTotal: sourceProduct.subTotal,
      };
    });

    const firstItem = items[0];
    const quantity = items.reduce((sum, item) => sum + Number(item.quantity), 0);
    const totalAmount = items.reduce((sum, item) => sum + Number(item.subTotal), 0);
    const orderDate = new Date(contract.startDate).toISOString();
    sampleOrders.unshift({
      id: sampleOrderId++,
      orderNo: contract.contractNo,
      orderDate,
      customerId: customer.id,
      customerName: customer.companyName,
      customerOrderNo: "",
      items,
      quantity,
      totalAmount: totalAmount.toFixed(2),
      productId: firstItem.productId,
      productName: firstItem.productName,
      productCode: firstItem.productCode,
      productModel: firstItem.productModel,
      unitPrice: firstItem.unitPrice,
      orderStatus: "待排产",
      status: "待排产",
      paymentTerms: "0",
      contractReviewed: true,
      hasShippingInfo: true,
      hasSpecialRequirements: true,
      shippingAddress: "",
      notes: "",
      invoicedAmount: "0.00",
      receivedAmount: "0.00",
      orderPaymentStatus: "待支付",
      orderInvoiceStatus: "待开票",
      balance: totalAmount,
      isOverdue: false,
      overdueDays: 0,
      statusHistory: [{ status: "待排产", timestamp: now }],
      createdAt: now,
      updatedAt: now,
    });
    existingOrderNos.add(contract.contractNo);
    importedOrderCount += 1;
    importedProductLineCount += items.length;
  }

  nextId.customer = customerId;
  nextId.product = productId;
  nextId.sampleOrder = sampleOrderId;

  const customerIds = new Set(customers.map((customer) => Number(customer.id)));
  const productIds = new Set(products.map((product) => Number(product.id)));
  const importedNos = new Set(contracts.map((contract) => contract.contractNo));
  const importedOrders = sampleOrders.filter((order) => importedNos.has(String(order.orderNo ?? "").trim()));
  if (importedOrders.length !== contracts.length) {
    throw new Error(`校验失败：应有 ${contracts.length} 份源合同，当前仅找到 ${importedOrders.length} 份样品订单`);
  }
  for (const order of importedOrders) {
    if (!customerIds.has(Number(order.customerId))) throw new Error(`订单 ${order.orderNo} 的客户关联无效`);
    if (!order.contractReviewed || !order.hasShippingInfo || !order.hasSpecialRequirements || String(order.paymentTerms) !== "0") {
      throw new Error(`订单 ${order.orderNo} 的评审或附加信息设置不正确`);
    }
    if (!Array.isArray(order.items) || order.items.length === 0 || order.items.some((item) => !productIds.has(Number(item.productId)))) {
      throw new Error(`订单 ${order.orderNo} 的产品关联无效`);
    }
  }

  const updates = {
    "sales-sys-customers": customers,
    "sales-sys-products": products,
    "sales-sys-productCategories": categories,
    "sales-sys-sampleOrders": sampleOrders,
    "sales-sys-nextId": nextId,
  };
  const upsert = db.prepare(`
    INSERT INTO app_state(key, value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at
  `);
  db.exec("BEGIN IMMEDIATE");
  try {
    for (const [key, value] of Object.entries(updates)) {
      upsert.run(key, JSON.stringify(value), now);
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  const verifyState = readState(db);
  db.close();
  const verifyOrders = verifyState["sales-sys-sampleOrders"] ?? [];
  const verifyImported = verifyOrders.filter((order) => importedNos.has(String(order.orderNo ?? "").trim()));
  if (verifyImported.length !== contracts.length) throw new Error("写入后校验失败：样品订单数量不一致");

  const result = {
    success: true,
    completedAt: new Date().toISOString(),
    sourceFile: sourcePath,
    backupPath,
    sourceContractCount: contracts.length,
    sourceProductLineCount: contracts.reduce((sum, contract) => sum + contract.products.length, 0),
    importedOrderCount,
    skippedOrderCount,
    importedProductLineCount,
    newCustomerCount,
    reusedCustomerCount,
    newProductCount,
    reusedProductCount,
    createdCategory,
    finalCustomerCount: verifyState["sales-sys-customers"]?.length ?? 0,
    finalProductCount: verifyState["sales-sys-products"]?.length ?? 0,
    finalSampleOrderCount: verifyOrders.length,
    validation: {
      allSourceContractsPresent: verifyImported.length === contracts.length,
      allOrdersReviewed: verifyImported.every((order) => order.contractReviewed === true),
      allShippingInfoChecked: verifyImported.every((order) => order.hasShippingInfo === true),
      allSpecialRequirementsChecked: verifyImported.every((order) => order.hasSpecialRequirements === true),
      allCashTerms: verifyImported.every((order) => String(order.paymentTerms) === "0"),
    },
  };
  fs.writeFileSync(resultPath, JSON.stringify(result, null, 2), "utf8");
  if (fs.existsSync(errorPath)) fs.rmSync(errorPath);
}

try {
  main();
} catch (error) {
  fs.mkdirSync(path.dirname(errorPath), { recursive: true });
  fs.writeFileSync(errorPath, `${new Date().toISOString()}\n${error?.stack ?? error}`, "utf8");
  process.exitCode = 1;
}
