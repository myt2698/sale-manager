// Customer checklist item keys
export interface CustomerChecklist {
  contactNameChecked: boolean;
  contactPhoneChecked: boolean;
  bankNameChecked: boolean;
  bankAccountChecked: boolean;
  bankAccountNameChecked: boolean;
  shippingNameChecked: boolean;
  shippingPhoneChecked: boolean;
  shippingAddressChecked: boolean;
  riskDocChecked: boolean;
  infoDocChecked: boolean;
}

export const defaultChecklist: CustomerChecklist = {
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
};

export const checklistLabels: { key: keyof CustomerChecklist; label: string; group: string }[] = [
  { key: "contactNameChecked", label: "联系人姓名", group: "联系人信息" },
  { key: "contactPhoneChecked", label: "联系人电话", group: "联系人信息" },
  { key: "bankNameChecked", label: "开户行", group: "财务信息" },
  { key: "bankAccountChecked", label: "银行账号", group: "财务信息" },
  { key: "bankAccountNameChecked", label: "账号名称", group: "财务信息" },
  { key: "shippingNameChecked", label: "收货人", group: "地址信息" },
  { key: "shippingPhoneChecked", label: "收货电话", group: "地址信息" },
  { key: "shippingAddressChecked", label: "详细地址", group: "地址信息" },
  { key: "riskDocChecked", label: "客户风险评估表", group: "文档核对" },
  { key: "infoDocChecked", label: "客户信息备案表", group: "文档核对" },
];

export const docCheckLabels = [
  { key: "riskDocChecked", label: "客户风险评估表" },
  { key: "infoDocChecked", label: "客户信息备案表" },
];

function buildChecklist(c: any): CustomerChecklist {
  return {
    contactNameChecked: !!c.contactName,
    contactPhoneChecked: !!c.contactPhone,
    bankNameChecked: !!c.bankName,
    bankAccountChecked: !!c.bankAccount,
    bankAccountNameChecked: !!c.bankAccountName,
    shippingNameChecked: !!c.shippingName,
    shippingPhoneChecked: !!c.shippingPhone,
    shippingAddressChecked: !!c.shippingAddress,
  };
}

function countChecked(cl: CustomerChecklist): number {
  return Object.values(cl).filter(Boolean).length;
}

export const mockCustomers = [
  {
    id: 1,
    customerNo: "CUST-001",
    companyName: "华为技术有限公司",
    contactName: "张经理",
    contactPhone: "13800138001",
    bankName: "中国工商银行深圳分行",
    bankAccount: "4000023019200123456",
    bankAccountName: "华为技术有限公司",
    shippingName: "张经理",
    shippingPhone: "13800138001",
    shippingAddress: "深圳市龙岗区坂田华为基地B区",
    notes: "优质大客户，长期合作",
    checklist: { contactNameChecked: true, contactPhoneChecked: true, bankNameChecked: true, bankAccountChecked: true, bankAccountNameChecked: true, shippingNameChecked: true, shippingPhoneChecked: true, shippingAddressChecked: true, riskDocChecked: true, infoDocChecked: true },
    createdAt: "2026-05-19T03:38:20.000Z",
    updatedAt: "2026-05-19T03:38:20.000Z",
  },
  {
    id: 2,
    customerNo: "CUST-002",
    companyName: "小米科技有限责任公司",
    contactName: "李主管",
    contactPhone: "13900139002",
    bankName: "招商银行北京分行",
    bankAccount: "1109080012345678",
    bankAccountName: "小米科技有限责任公司",
    shippingName: "李主管",
    shippingPhone: "13900139002",
    shippingAddress: "北京市海淀区清河中街68号小米科技园",
    notes: "重要客户",
    checklist: { contactNameChecked: true, contactPhoneChecked: true, bankNameChecked: true, bankAccountChecked: true, bankAccountNameChecked: true, shippingNameChecked: true, shippingPhoneChecked: true, shippingAddressChecked: true, riskDocChecked: true, infoDocChecked: true },
    createdAt: "2026-05-19T03:38:20.000Z",
    updatedAt: "2026-05-19T03:38:20.000Z",
  },
  {
    id: 3,
    customerNo: "CUST-003",
    companyName: "比亚迪股份有限公司",
    contactName: "王采购",
    contactPhone: "13600136003",
    bankName: "中国建设银行深圳分行",
    bankAccount: "44201501100059234567",
    bankAccountName: "比亚迪股份有限公司",
    shippingName: "",
    shippingPhone: "",
    shippingAddress: "深圳市坪山区比亚迪路3009号",
    notes: "新客户，需谨慎",
    checklist: { contactNameChecked: true, contactPhoneChecked: true, bankNameChecked: true, bankAccountChecked: true, bankAccountNameChecked: true, shippingNameChecked: false, shippingPhoneChecked: false, shippingAddressChecked: true, riskDocChecked: true, infoDocChecked: false },
    createdAt: "2026-05-19T03:38:20.000Z",
    updatedAt: "2026-05-19T03:38:20.000Z",
  },
  {
    id: 4,
    customerNo: "CUST-004",
    companyName: "深圳市腾讯计算机系统有限公司",
    contactName: "陈经理",
    contactPhone: "13700137004",
    bankName: "中国银行深圳分行",
    bankAccount: "741957345678",
    bankAccountName: "深圳市腾讯计算机系统有限公司",
    shippingName: "",
    shippingPhone: "",
    shippingAddress: "",
    notes: "潜在大客户，正在商务谈判中",
    checklist: { contactNameChecked: true, contactPhoneChecked: true, bankNameChecked: true, bankAccountChecked: true, bankAccountNameChecked: true, shippingNameChecked: false, shippingPhoneChecked: false, shippingAddressChecked: false, riskDocChecked: false, infoDocChecked: false },
    createdAt: "2026-05-19T03:38:20.000Z",
    updatedAt: "2026-05-19T03:38:20.000Z",
  },
  {
    id: 5,
    customerNo: "CUST-005",
    companyName: "阿里巴巴（中国）网络技术有限公司",
    contactName: "刘总监",
    contactPhone: "13500135005",
    bankName: "中国工商银行杭州分行",
    bankAccount: "1202020119900234567",
    bankAccountName: "阿里巴巴（中国）网络技术有限公司",
    shippingName: "刘总监",
    shippingPhone: "13500135005",
    shippingAddress: "杭州市余杭区五常街道文一西路969号",
    notes: "战略合作客户",
    checklist: { contactNameChecked: true, contactPhoneChecked: true, bankNameChecked: true, bankAccountChecked: true, bankAccountNameChecked: true, shippingNameChecked: true, shippingPhoneChecked: true, shippingAddressChecked: true, riskDocChecked: true, infoDocChecked: true },
    createdAt: "2026-05-19T03:38:20.000Z",
    updatedAt: "2026-05-19T03:38:20.000Z",
  },
];

// 产品分类
export const mockProductCategories = [
  { id: 1, name: "传感器", sortOrder: 1, createdAt: "2026-01-01T00:00:00.000Z" },
  { id: 2, name: "芯片", sortOrder: 2, createdAt: "2026-01-01T00:00:00.000Z" },
  { id: 3, name: "连接器", sortOrder: 3, createdAt: "2026-01-01T00:00:00.000Z" },
  { id: 4, name: "线缆", sortOrder: 4, createdAt: "2026-01-01T00:00:00.000Z" },
];

export const mockProducts = [
  { id: 1, productName: "高精度传感器模块", productCode: "SENSOR-A-001", productModel: "A型", categoryId: 1, categoryName: "传感器", description: "高精度压力传感器模块，量程0-1000Pa，精度0.01%" },
  { id: 2, productName: "智能控制芯片", productCode: "CHIP-B-002", productModel: "B型", categoryId: 2, categoryName: "芯片", description: "高性能智能控制芯片，32位ARM Cortex-M4" },
  { id: 3, productName: "工业级连接器", productCode: "CONN-C-003", productModel: "C型", categoryId: 3, categoryName: "连接器", description: "防水防尘工业连接器，IP67防水，24Pin" },
  { id: 4, productName: "定制线缆组件", productCode: "CABLE-D-004", productModel: "D型", categoryId: 4, categoryName: "线缆", description: "耐高温屏蔽线缆组件，耐温200度" },
  { id: 5, productName: "高精度传感器模块", productCode: "SENSOR-A-PRO", productModel: "PRO-专业版", categoryId: 1, categoryName: "传感器", description: "专业级高精度传感器，量程0-5000Pa" },
  { id: 6, productName: "智能控制芯片", productCode: "CHIP-B-001", productModel: "B型-标准版", categoryId: 2, categoryName: "芯片", description: "标准版控制芯片，32位ARM Cortex-M3" },
  { id: 7, productName: "工业级连接器", productCode: "CONN-C-003-B", productModel: "C型-防水型", categoryId: 3, categoryName: "连接器", description: "增强防水型连接器，IP68防水，36Pin" },
  { id: 8, productName: "定制线缆组件", productCode: "CABLE-D-004-B", productModel: "D型-高温型", categoryId: 4, categoryName: "线缆", description: "高温双屏蔽线缆，耐温300度" },
  { id: 9, productName: "高精度传感器模块", productCode: "SENSOR-A-001-B", productModel: "A型-工业级", categoryId: 1, categoryName: "传感器", description: "工业级批量传感器，量程0-2000Pa" },
  { id: 10, productName: "智能控制芯片", productCode: "CHIP-B-002-B", productModel: "B型-增强版", categoryId: 2, categoryName: "芯片", description: "增强版智能控制芯片，32位ARM Cortex-M7" },
];

export const sampleStatusFlow = ["待处理", "已发起", "待生产确认", "待出库", "待发货", "待签收", "已完成"];

function buildSampleStatusHistory(status: string, createdAt: string): Array<{ status: string; timestamp: string }> {
  const idx = sampleStatusFlow.indexOf(status);
  if (idx < 0) return [{ status, timestamp: createdAt }];
  return sampleStatusFlow.slice(0, idx + 1).map((s, i) => ({
    status: s,
    timestamp: new Date(new Date(createdAt).getTime() + i * 86400000).toISOString(),
  }));
}

export const mockSampleOrders = [
  { id: 1, orderNo: "SP-2026-001", customerId: 1, productName: "高精度传感器模块", productCode: "SENSOR-A-001", productModel: "A型", quantity: "5.50", unitPrice: "850.0000", totalAmount: "4675.00", status: "已完成", deliveryDate: "2026-05-10", logisticsMethod: "顺丰快递", logisticsNo: "SF1234567890", specialRequirements: "需要防静电包装，随附检测报告", createdBy: null, createdAt: "2026-05-01T00:00:00.000Z", updatedAt: "2026-05-19T03:38:20.000Z",
    statusHistory: buildSampleStatusHistory("已完成", "2026-05-01T00:00:00.000Z") },
  { id: 2, orderNo: "SP-2026-002", customerId: 2, productName: "智能控制芯片", productCode: "CHIP-B-002", productModel: "B型", quantity: "10.00", unitPrice: "1200.0000", totalAmount: "12000.00", status: "待签收", deliveryDate: "2026-05-15", logisticsMethod: "德邦物流", logisticsNo: "DB9876543210", specialRequirements: "", createdBy: null, createdAt: "2026-05-03T00:00:00.000Z", updatedAt: "2026-05-19T03:38:20.000Z",
    statusHistory: buildSampleStatusHistory("待签收", "2026-05-03T00:00:00.000Z") },
  { id: 3, orderNo: "SP-2026-003", customerId: 3, productName: "工业级连接器", productCode: "CONN-C-003", productModel: "C型", quantity: "20.35", unitPrice: "45.0000", totalAmount: "915.75", status: "待生产确认", deliveryDate: null, logisticsMethod: null, logisticsNo: null, specialRequirements: "要求IP67防水等级", createdBy: null, createdAt: "2026-05-05T00:00:00.000Z", updatedAt: "2026-05-19T03:38:20.000Z",
    statusHistory: buildSampleStatusHistory("待生产确认", "2026-05-05T00:00:00.000Z") },
  { id: 4, orderNo: "SP-2026-004", customerId: 4, productName: "定制线缆组件", productCode: "CABLE-D-004", productModel: "D型", quantity: "50.00", unitPrice: "68.0000", totalAmount: "3400.00", status: "待处理", deliveryDate: null, logisticsMethod: null, logisticsNo: null, specialRequirements: "特殊长度定制，需提供样品确认", createdBy: null, createdAt: "2026-05-08T00:00:00.000Z", updatedAt: "2026-05-19T03:38:20.000Z",
    statusHistory: buildSampleStatusHistory("待处理", "2026-05-08T00:00:00.000Z") },
];

export const statusFlow = ["待预审", "待生产确认", "生产中", "待出库", "待发货", "已发货", "已收货", "待对账", "待开票", "待付款", "部分付款", "全部付款", "已完结"];

function buildStatusHistory(orderStatus: string, orderDate: string): Array<{ status: string; timestamp: string }> {
  const idx = statusFlow.indexOf(orderStatus);
  if (idx < 0) return [{ status: orderStatus, timestamp: orderDate }];
  return statusFlow.slice(0, idx + 1).map((s, i) => ({
    status: s,
    timestamp: new Date(new Date(orderDate).getTime() + i * 86400000).toISOString(),
  }));
}

export const mockSalesOrders = [
  { id: 1, orderNo: "SO-2026-001", customerId: 1, customerOrderNo: "HW-PO-20260501", productName: "高精度传感器模块（批量）", productCode: "SENSOR-A-001-B", productModel: "A型-工业级", quantity: "500.50", unitPrice: "780.0000", totalAmount: "390390.00", orderStatus: "全部付款", invoicedAmount: "390000.00", receivedAmount: "390000.00", orderDate: "2026-05-01T00:00:00.000Z", contractDate: "2026-05-02T00:00:00.000Z", deliveryDate: "2026-05-20T00:00:00.000Z", shippedDate: "2026-05-18T00:00:00.000Z", receivedDate: "2026-05-22T00:00:00.000Z", statementDate: "2026-05-23T00:00:00.000Z", invoiceDate: "2026-05-25T00:00:00.000Z", dueDate: "2026-06-25T00:00:00.000Z", completedDate: "2026-06-20T00:00:00.000Z", logisticsCompany: "顺丰物流", logisticsNo: "SF20260518001", specialRequirements: "", notes: "首批大订单，按时交付", isOverdue: false, overdueDays: 0, createdAt: "2026-05-01T00:00:00.000Z", updatedAt: "2026-05-19T03:38:20.000Z", customerName: "华为技术有限公司", balance: 0,
    items: [{ productId: 9, productName: "高精度传感器模块", categoryName: "传感器", productCode: "SENSOR-A-001-B", productModel: "A型-工业级", quantity: "500.50", unitPrice: "780.0000", subTotal: "390390.00" }],
    statusHistory: buildStatusHistory("全部付款", "2026-05-01T00:00:00.000Z") },
  { id: 2, orderNo: "SO-2026-002", customerId: 2, customerOrderNo: "XM-PO-20260505", productName: "智能控制芯片（批量）", productCode: "CHIP-B-002-B", productModel: "B型-增强版", quantity: "1000.00", unitPrice: "1100.0000", totalAmount: "1100000.00", orderStatus: "部分付款", invoicedAmount: "1100000.00", receivedAmount: "500000.00", orderDate: "2026-05-05T00:00:00.000Z", contractDate: "2026-05-06T00:00:00.000Z", deliveryDate: "2026-05-25T00:00:00.000Z", shippedDate: "2026-05-24T00:00:00.000Z", receivedDate: "2026-05-26T00:00:00.000Z", statementDate: "2026-05-27T00:00:00.000Z", invoiceDate: "2026-05-28T00:00:00.000Z", dueDate: "2026-07-28T00:00:00.000Z", completedDate: null, logisticsCompany: "京东物流", logisticsNo: "JD20260524002", specialRequirements: "需要温度控制在5-25度运输", notes: "重要订单，部分回款", isOverdue: false, overdueDays: 0, createdAt: "2026-05-05T00:00:00.000Z", updatedAt: "2026-05-19T03:38:20.000Z", customerName: "小米科技有限责任公司", balance: 600000,
    items: [{ productId: 10, productName: "智能控制芯片", categoryName: "芯片", productCode: "CHIP-B-002-B", productModel: "B型-增强版", quantity: "1000.00", unitPrice: "1100.0000", subTotal: "1100000.00" }],
    statusHistory: buildStatusHistory("部分付款", "2026-05-05T00:00:00.000Z") },
  { id: 3, orderNo: "SO-2026-003", customerId: 3, customerOrderNo: "BYD-PO-20260508", productName: "工业级连接器（批量）", productCode: "CONN-C-003-B", productModel: "C型-防水型", quantity: "2000.80", unitPrice: "38.0000", totalAmount: "76030.40", orderStatus: "待付款", invoicedAmount: "76000.00", receivedAmount: "0.00", orderDate: "2026-05-08T00:00:00.000Z", contractDate: "2026-05-09T00:00:00.000Z", deliveryDate: "2026-05-28T00:00:00.000Z", shippedDate: "2026-05-27T00:00:00.000Z", receivedDate: "2026-05-29T00:00:00.000Z", statementDate: "2026-05-30T00:00:00.000Z", invoiceDate: "2026-06-01T00:00:00.000Z", dueDate: "2026-07-01T00:00:00.000Z", completedDate: null, logisticsCompany: "中通快运", logisticsNo: "ZT20260527003", specialRequirements: "IP67防水等级要求", notes: "新客户订单", isOverdue: false, overdueDays: 0, createdAt: "2026-05-08T00:00:00.000Z", updatedAt: "2026-05-19T03:38:20.000Z", customerName: "比亚迪股份有限公司", balance: 76000,
    items: [{ productId: 7, productName: "工业级连接器", categoryName: "连接器", productCode: "CONN-C-003-B", productModel: "C型-防水型", quantity: "2000.80", unitPrice: "38.0000", subTotal: "76030.40" }],
    statusHistory: buildStatusHistory("待付款", "2026-05-08T00:00:00.000Z") },
  { id: 4, orderNo: "SO-2026-004", customerId: 5, customerOrderNo: "ALI-PO-20260510", productName: "定制线缆组件（批量）", productCode: "CABLE-D-004-B", productModel: "D型-高温型", quantity: "3000.00", unitPrice: "55.0000", totalAmount: "165000.00", orderStatus: "待开票", invoicedAmount: "0.00", receivedAmount: "0.00", orderDate: "2026-05-10T00:00:00.000Z", contractDate: "2026-05-12T00:00:00.000Z", deliveryDate: "2026-06-05T00:00:00.000Z", shippedDate: "2026-06-04T00:00:00.000Z", receivedDate: "2026-06-06T00:00:00.000Z", statementDate: "2026-06-07T00:00:00.000Z", invoiceDate: null, dueDate: null, completedDate: null, logisticsCompany: "跨越速运", logisticsNo: "KY20260604004", specialRequirements: "", notes: "战略客户", isOverdue: false, overdueDays: 0, createdAt: "2026-05-10T00:00:00.000Z", updatedAt: "2026-05-19T03:38:20.000Z", customerName: "阿里巴巴（中国）网络技术有限公司", balance: 165000,
    items: [{ productId: 8, productName: "定制线缆组件", categoryName: "线缆", productCode: "CABLE-D-004-B", productModel: "D型-高温型", quantity: "3000.00", unitPrice: "55.0000", subTotal: "165000.00" }],
    statusHistory: buildStatusHistory("待开票", "2026-05-10T00:00:00.000Z") },
  { id: 5, orderNo: "SO-2026-005", customerId: 1, customerOrderNo: "HW-PO-20260515", productName: "高精度传感器模块-升级款", productCode: "SENSOR-A-PRO", productModel: "PRO-专业版", quantity: "800.25", unitPrice: "950.0000", totalAmount: "760237.50", orderStatus: "生产中", invoicedAmount: "0.00", receivedAmount: "0.00", orderDate: "2026-05-15T00:00:00.000Z", contractDate: "2026-05-16T00:00:00.000Z", deliveryDate: "2026-06-15T00:00:00.000Z", shippedDate: null, receivedDate: null, statementDate: null, invoiceDate: null, dueDate: null, completedDate: null, logisticsCompany: null, logisticsNo: null, specialRequirements: "需RoHS认证", notes: "升级版新品订单", isOverdue: false, overdueDays: 0, createdAt: "2026-05-15T00:00:00.000Z", updatedAt: "2026-05-19T03:38:20.000Z", customerName: "华为技术有限公司", balance: 760000,
    items: [{ productId: 5, productName: "高精度传感器模块", categoryName: "传感器", productCode: "SENSOR-A-PRO", productModel: "PRO-专业版", quantity: "800.25", unitPrice: "950.0000", subTotal: "760237.50" }],
    statusHistory: buildStatusHistory("生产中", "2026-05-15T00:00:00.000Z") },
  { id: 6, orderNo: "SO-2026-006", customerId: 2, customerOrderNo: "XM-PO-20260501-OLD", productName: "智能控制芯片-老款", productCode: "CHIP-B-001", productModel: "B型-标准版", quantity: "500.00", unitPrice: "1000.0000", totalAmount: "500000.00", orderStatus: "部分付款", invoicedAmount: "500000.00", receivedAmount: "200000.00", orderDate: "2026-04-01T00:00:00.000Z", contractDate: "2026-04-02T00:00:00.000Z", deliveryDate: "2026-04-20T00:00:00.000Z", shippedDate: "2026-04-18T00:00:00.000Z", receivedDate: "2026-04-22T00:00:00.000Z", statementDate: "2026-04-23T00:00:00.000Z", invoiceDate: "2026-04-25T00:00:00.000Z", dueDate: "2026-05-25T00:00:00.000Z", completedDate: null, logisticsCompany: "顺丰物流", logisticsNo: "SF20260418001", specialRequirements: "", notes: "已逾期，需催款", isOverdue: true, overdueDays: 24, createdAt: "2026-04-01T00:00:00.000Z", updatedAt: "2026-04-01T00:00:00.000Z", customerName: "小米科技有限责任公司", balance: 300000,
    items: [{ productId: 6, productName: "智能控制芯片", categoryName: "芯片", productCode: "CHIP-B-001", productModel: "B型-标准版", quantity: "500.00", unitPrice: "1000.0000", subTotal: "500000.00" }],
    statusHistory: buildStatusHistory("部分付款", "2026-04-01T00:00:00.000Z") },
];

export const mockChecklists: Record<number, any> = {
  1: { orderId: 1, quoteConfirmed: true, productNameChecked: true, productCodeChecked: true, quantityChecked: true, priceChecked: true, shippingAddressChecked: true, companyNameChecked: true, customerOrderNoChecked: true, paymentTermsChecked: true, financialInfoChecked: true, allChecked: true },
  2: { orderId: 2, quoteConfirmed: true, productNameChecked: true, productCodeChecked: true, quantityChecked: true, priceChecked: true, shippingAddressChecked: true, companyNameChecked: true, customerOrderNoChecked: true, paymentTermsChecked: true, financialInfoChecked: true, allChecked: true },
  3: { orderId: 3, quoteConfirmed: true, productNameChecked: true, productCodeChecked: true, quantityChecked: true, priceChecked: true, shippingAddressChecked: true, companyNameChecked: true, customerOrderNoChecked: true, paymentTermsChecked: true, financialInfoChecked: false, allChecked: false },
};

export const mockPayments = [
  { id: 1, orderId: 1, paymentNo: "PAY-20260615-001", amount: "200000.00", paymentMethod: "银行转账", paymentDate: "2026-06-10T00:00:00.000Z", bankReference: "ICBC20260610001", payerAccount: "4000023019200123456", payerName: "华为技术有限公司", notes: "第一笔回款" },
  { id: 2, orderId: 1, paymentNo: "PAY-20260620-002", amount: "190000.00", paymentMethod: "银行转账", paymentDate: "2026-06-20T00:00:00.000Z", bankReference: "ICBC20260620002", payerAccount: "4000023019200123456", payerName: "华为技术有限公司", notes: "尾款结清" },
  { id: 3, orderId: 2, paymentNo: "PAY-20260625-003", amount: "300000.00", paymentMethod: "银行转账", paymentDate: "2026-06-25T00:00:00.000Z", bankReference: "CMB20260625001", payerAccount: "1109080012345678", payerName: "小米科技有限责任公司", notes: "第一笔预付款" },
  { id: 4, orderId: 2, paymentNo: "PAY-20260705-004", amount: "200000.00", paymentMethod: "银行转账", paymentDate: "2026-07-05T00:00:00.000Z", bankReference: "CMB20260705001", payerAccount: "1109080012345678", payerName: "小米科技有限责任公司", notes: "第二笔回款" },
  { id: 5, orderId: 6, paymentNo: "PAY-20260510-005", amount: "200000.00", paymentMethod: "银行转账", paymentDate: "2026-05-10T00:00:00.000Z", bankReference: "CMB20260510001", payerAccount: "1109080012345678", payerName: "小米科技有限责任公司", notes: "部分回款" },
];

export const mockDashboardStats = {
  orders: { total: 6, pending: 0, inProgress: 1, toFinance: 2, overdue: 1, completed: 0, totalAmount: "2991000.00", receivedAmount: "1090000.00" },
  customers: { total: 5, active: 4, potential: 1 },
  payments: { monthTotal: "1090000.00", monthCount: 5 },
  sampleOrders: { total: 4, pending: 1, completed: 1 },
};

export const mockARAging = {
  current: { count: 3, amount: 841000 },
  d30: { count: 0, amount: 0 },
  d60: { count: 0, amount: 0 },
  d90: { count: 1, amount: 300000 },
  over90: { count: 0, amount: 0 },
};

export interface AlloyFormula {
  metal: string;
  percent: number;
}

export const mockQuotationRules = [
  {
    id: 0, customerId: 0, customerName: "", productId: 0,
    ruleName: "按总价报", productName: "", productCode: "", productModel: "", productType: "",
    alloyFormula: [] as AlloyFormula[],
    pricePercent: 100, fixedPrice: 0, unit: "kg",
    notes: "直接输入总价，不计算合金价", createdAt: "1970-01-01T00:00:00.000Z",
  },
  {
    id: 1, customerId: 1, customerName: "华为技术有限公司", productId: 1,
    ruleName: "SENSOR-A-001", productName: "高精度传感器模块", productCode: "SENSOR-A-001", productModel: "A型", productType: "锡膏",
    alloyFormula: [] as AlloyFormula[],
    pricePercent: 100, fixedPrice: 45.00, unit: "kg",
    notes: "", createdAt: "2026-01-15T00:00:00.000Z",
  },
  {
    id: 2, customerId: 1, customerName: "华为技术有限公司", productId: 2,
    ruleName: "CHIP-B-002", productName: "智能控制芯片", productCode: "CHIP-B-002", productModel: "B型", productType: "锡膏",
    alloyFormula: [] as AlloyFormula[],
    pricePercent: 100, fixedPrice: 120.00, unit: "kg",
    notes: "", createdAt: "2026-02-01T00:00:00.000Z",
  },
  {
    id: 3, customerId: 2, customerName: "小米科技有限责任公司", productId: 3,
    ruleName: "CONN-C-003", productName: "工业级连接器", productCode: "CONN-C-003", productModel: "C型", productType: "焊锡丝",
    alloyFormula: [] as AlloyFormula[],
    pricePercent: 100, fixedPrice: 25.00, unit: "kg",
    notes: "", createdAt: "2026-01-20T00:00:00.000Z",
  },
  {
    id: 4, customerId: 3, customerName: "比亚迪股份有限公司", productId: 4,
    ruleName: "CABLE-D-004", productName: "定制线缆组件", productCode: "CABLE-D-004", productModel: "D型", productType: "锡条",
    alloyFormula: [] as AlloyFormula[],
    pricePercent: 100, fixedPrice: 15.00, unit: "kg",
    notes: "", createdAt: "2026-03-01T00:00:00.000Z",
  },
];
