import {
  mysqlTable,
  mysqlEnum,
  serial,
  varchar,
  text,
  timestamp,
  bigint,
  decimal,
  boolean,
  int,
} from "drizzle-orm/mysql-core";

// ==================== 用户表 ====================
export const users = mysqlTable("users", {
  id: serial("id").primaryKey(),
  unionId: varchar("unionId", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 320 }),
  avatar: text("avatar"),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
  lastSignInAt: timestamp("lastSignInAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ==================== 客户管理 ====================
export const customers = mysqlTable("customers", {
  id: serial("id").primaryKey(),
  customerNo: varchar("customerNo", { length: 50 }).notNull().unique(),
  companyName: varchar("companyName", { length: 255 }).notNull(),
  contactName: varchar("contactName", { length: 100 }),
  contactPhone: varchar("contactPhone", { length: 50 }),
  contactEmail: varchar("contactEmail", { length: 255 }),
  status: mysqlEnum("status", ["潜在", "正式", "冻结", "黑名单"]).default("潜在").notNull(),
  bankName: varchar("bankName", { length: 255 }),
  bankAccount: varchar("bankAccount", { length: 100 }),
  bankAccountName: varchar("bankAccountName", { length: 255 }),
  address: text("address"),
  shippingAddress: text("shippingAddress"),
  riskLevel: mysqlEnum("riskLevel", ["低", "中", "高"]).default("中"),
  creditLimit: decimal("creditLimit", { precision: 14, scale: 2 }).default("0.00"),
  paymentTerms: varchar("paymentTerms", { length: 100 }),
  settlementDay: int("settlementDay"),
  invoicingDay: int("invoicingDay"),
  paymentDueDay: int("paymentDueDay"),
  assignedTo: bigint("assignedTo", { mode: "number", unsigned: true }),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type Customer = typeof customers.$inferSelect;

// ==================== 客户档案文件 ====================
export const customerDocuments = mysqlTable("customerDocuments", {
  id: serial("id").primaryKey(),
  customerId: bigint("customerId", { mode: "number", unsigned: true }).notNull(),
  documentType: mysqlEnum("documentType", ["风险评估表", "信息登记表", "营业执照", "合同", "其他"]).notNull(),
  documentName: varchar("documentName", { length: 255 }).notNull(),
  fileUrl: text("fileUrl").notNull(),
  uploadedBy: bigint("uploadedBy", { mode: "number", unsigned: true }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ==================== 样品订单 ====================
export const sampleOrders = mysqlTable("sampleOrders", {
  id: serial("id").primaryKey(),
  orderNo: varchar("orderNo", { length: 50 }).notNull().unique(),
  customerId: bigint("customerId", { mode: "number", unsigned: true }).notNull(),
  productName: varchar("productName", { length: 255 }).notNull(),
  productCode: varchar("productCode", { length: 100 }),
  productModel: varchar("productModel", { length: 100 }),
  quantity: decimal("quantity", { precision: 14, scale: 4 }).notNull(),
  unitPrice: decimal("unitPrice", { precision: 14, scale: 4 }),
  totalAmount: decimal("totalAmount", { precision: 14, scale: 2 }),
  status: mysqlEnum("status", [
    "待处理",
    "已发起",
    "待生产确认",
    "待出库",
    "待发货",
    "已发货",
    "已完成",
    "已取消",
  ]).default("待处理").notNull(),
  deliveryDate: varchar("deliveryDate", { length: 50 }),
  logisticsMethod: varchar("logisticsMethod", { length: 100 }),
  logisticsNo: varchar("logisticsNo", { length: 100 }),
  specialRequirements: text("specialRequirements"),
  createdBy: bigint("createdBy", { mode: "number", unsigned: true }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

// ==================== 销售订单 ====================
export const salesOrders = mysqlTable("salesOrders", {
  id: serial("id").primaryKey(),
  orderNo: varchar("orderNo", { length: 50 }).notNull().unique(),
  customerId: bigint("customerId", { mode: "number", unsigned: true }).notNull(),
  customerOrderNo: varchar("customerOrderNo", { length: 100 }),
  productName: varchar("productName", { length: 255 }).notNull(),
  productCode: varchar("productCode", { length: 100 }),
  productModel: varchar("productModel", { length: 100 }),
  quantity: decimal("quantity", { precision: 14, scale: 4 }).notNull(),
  unitPrice: decimal("unitPrice", { precision: 14, scale: 4 }).notNull(),
  totalAmount: decimal("totalAmount", { precision: 14, scale: 2 }).notNull(),

  // 流程状态
  orderStatus: mysqlEnum("orderStatus", [
    "待预审",
    "待生产确认",
    "生产中",
    "待出库",
    "待发货",
    "待签收",
    "待对账",
    "待开票",
    "待付款",
    "部分付款",
    "全部付款",
    "已完结",
    "已取消",
  ]).default("待预审").notNull(),

  // 金额状态
  invoicedAmount: decimal("invoicedAmount", { precision: 14, scale: 2 }).default("0.00"),
  receivedAmount: decimal("receivedAmount", { precision: 14, scale: 2 }).default("0.00"),

  // 时间
  orderDate: timestamp("orderDate").defaultNow().notNull(),
  contractDate: timestamp("contractDate"),
  deliveryDate: timestamp("deliveryDate"),
  shippedDate: timestamp("shippedDate"),
  receivedDate: timestamp("receivedDate"),
  statementDate: timestamp("statementDate"),
  invoiceDate: timestamp("invoiceDate"),
  dueDate: timestamp("dueDate"),
  completedDate: timestamp("completedDate"),

  // 物流
  logisticsCompany: varchar("logisticsCompany", { length: 100 }),
  logisticsNo: varchar("logisticsNo", { length: 100 }),
  specialRequirements: text("specialRequirements"),

  // 其他
  notes: text("notes"),
  createdBy: bigint("createdBy", { mode: "number", unsigned: true }),
  assignedTo: bigint("assignedTo", { mode: "number", unsigned: true }),
  isOverdue: boolean("isOverdue").default(false),
  overdueDays: int("overdueDays").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

// ==================== 订单核对清单 ====================
export const orderChecklists = mysqlTable("orderChecklists", {
  id: serial("id").primaryKey(),
  orderId: bigint("orderId", { mode: "number", unsigned: true }).notNull(),
  // 9项核对
  quoteConfirmed: boolean("quoteConfirmed").default(false),
  productNameChecked: boolean("productNameChecked").default(false),
  productCodeChecked: boolean("productCodeChecked").default(false),
  quantityChecked: boolean("quantityChecked").default(false),
  priceChecked: boolean("priceChecked").default(false),
  shippingAddressChecked: boolean("shippingAddressChecked").default(false),
  companyNameChecked: boolean("companyNameChecked").default(false),
  customerOrderNoChecked: boolean("customerOrderNoChecked").default(false),
  paymentTermsChecked: boolean("paymentTermsChecked").default(false),
  // 客户财务资料
  financialInfoChecked: boolean("financialInfoChecked").default(false),
  allChecked: boolean("allChecked").default(false),
  checkedBy: bigint("checkedBy", { mode: "number", unsigned: true }),
  checkedAt: timestamp("checkedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ==================== 生产确认 ====================
export const productionConfirmations = mysqlTable("productionConfirmations", {
  id: serial("id").primaryKey(),
  orderId: bigint("orderId", { mode: "number", unsigned: true }).notNull(),
  department: varchar("department", { length: 100 }).notNull(),
  confirmedBy: varchar("confirmedBy", { length: 100 }),
  deliveryDate: varchar("deliveryDate", { length: 50 }),
  logisticsMethod: varchar("logisticsMethod", { length: 100 }),
  remarks: text("remarks"),
  status: mysqlEnum("status", ["待确认", "已确认", "已超时"]).default("待确认").notNull(),
  confirmedAt: timestamp("confirmedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ==================== 物流跟踪 ====================
export const logisticsTracking = mysqlTable("logisticsTracking", {
  id: serial("id").primaryKey(),
  orderId: bigint("orderId", { mode: "number", unsigned: true }).notNull(),
  logisticsCompany: varchar("logisticsCompany", { length: 100 }),
  logisticsNo: varchar("logisticsNo", { length: 100 }),
  status: mysqlEnum("status", ["待发货", "运输中", "已签收", "异常"]).default("待发货").notNull(),
  shippedAt: timestamp("shippedAt"),
  estimatedArrival: timestamp("estimatedArrival"),
  actualArrival: timestamp("actualArrival"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

// ==================== 回单 ====================
export const returnReceipts = mysqlTable("returnReceipts", {
  id: serial("id").primaryKey(),
  orderId: bigint("orderId", { mode: "number", unsigned: true }).notNull(),
  receiptNo: varchar("receiptNo", { length: 100 }),
  signatory: varchar("signatory", { length: 100 }),
  signedAt: timestamp("signedAt"),
  fileUrl: text("fileUrl"),
  photoUrl: text("photoUrl"),
  notes: text("notes"),
  uploadedBy: bigint("uploadedBy", { mode: "number", unsigned: true }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ==================== 对账单 ====================
export const statements = mysqlTable("statements", {
  id: serial("id").primaryKey(),
  orderId: bigint("orderId", { mode: "number", unsigned: true }).notNull(),
  statementNo: varchar("statementNo", { length: 50 }).notNull().unique(),
  amount: decimal("amount", { precision: 14, scale: 2 }).notNull(),
  status: mysqlEnum("status", ["待发送", "待确认", "客户已确认", "已拒绝"]).default("待发送").notNull(),
  sentAt: timestamp("sentAt"),
  confirmedAt: timestamp("confirmedAt"),
  confirmedBy: varchar("confirmedBy", { length: 100 }),
  fileUrl: text("fileUrl"),
  createdBy: bigint("createdBy", { mode: "number", unsigned: true }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

// ==================== 发票 ====================
export const invoices = mysqlTable("invoices", {
  id: serial("id").primaryKey(),
  orderId: bigint("orderId", { mode: "number", unsigned: true }).notNull(),
  statementId: bigint("statementId", { mode: "number", unsigned: true }),
  invoiceNo: varchar("invoiceNo", { length: 50 }).notNull().unique(),
  amount: decimal("amount", { precision: 14, scale: 2 }).notNull(),
  taxRate: decimal("taxRate", { precision: 5, scale: 2 }).default("13.00"),
  taxAmount: decimal("taxAmount", { precision: 14, scale: 2 }),
  totalWithTax: decimal("totalWithTax", { precision: 14, scale: 2 }),
  status: mysqlEnum("status", ["待开具", "已开具", "已邮寄", "已接收"]).default("待开具").notNull(),
  issuedAt: timestamp("issuedAt"),
  mailedAt: timestamp("mailedAt"),
  receivedAt: timestamp("receivedAt"),
  createdBy: bigint("createdBy", { mode: "number", unsigned: true }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ==================== 回款记录 ====================
export const paymentRecords = mysqlTable("paymentRecords", {
  id: serial("id").primaryKey(),
  orderId: bigint("orderId", { mode: "number", unsigned: true }).notNull(),
  invoiceId: bigint("invoiceId", { mode: "number", unsigned: true }),
  paymentNo: varchar("paymentNo", { length: 50 }),
  amount: decimal("amount", { precision: 14, scale: 2 }).notNull(),
  paymentMethod: mysqlEnum("paymentMethod", ["银行转账", "支票", "现金", "承兑汇票", "其他"]).default("银行转账").notNull(),
  paymentDate: timestamp("paymentDate").notNull(),
  bankReference: varchar("bankReference", { length: 100 }),
  payerAccount: varchar("payerAccount", { length: 100 }),
  payerName: varchar("payerName", { length: 255 }),
  notes: text("notes"),
  recordedBy: bigint("recordedBy", { mode: "number", unsigned: true }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ==================== 通知消息 ====================
export const notifications = mysqlTable("notifications", {
  id: serial("id").primaryKey(),
  userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
  type: mysqlEnum("type", ["任务", "提醒", "预警", "通知"]).notNull(),
  priority: mysqlEnum("priority", ["低", "中", "高", "紧急"]).default("中").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content"),
  relatedType: varchar("relatedType", { length: 50 }),
  relatedId: bigint("relatedId", { mode: "number", unsigned: true }),
  isRead: boolean("isRead").default(false),
  readAt: timestamp("readAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ==================== 产品管理 ====================
export const products = mysqlTable("products", {
  id: serial("id").primaryKey(),
  productName: varchar("productName", { length: 255 }).notNull(),
  productCode: varchar("productCode", { length: 100 }),
  productModel: varchar("productModel", { length: 100 }),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type Product = typeof products.$inferSelect;

// ==================== 待办任务 ====================
export const todos = mysqlTable("todos", {
  id: serial("id").primaryKey(),
  userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  status: mysqlEnum("status", ["待处理", "处理中", "已完成", "已取消"]).default("待处理").notNull(),
  priority: mysqlEnum("priority", ["低", "中", "高", "紧急"]).default("中").notNull(),
  dueDate: timestamp("dueDate"),
  completedAt: timestamp("completedAt"),
  relatedType: varchar("relatedType", { length: 50 }),
  relatedId: bigint("relatedId", { mode: "number", unsigned: true }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
