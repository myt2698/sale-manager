import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import {
  salesOrders,
  orderChecklists,
  productionConfirmations,
  logisticsTracking,
  returnReceipts,
  customers,
} from "@db/schema";
import { eq, like, desc, and, sql } from "drizzle-orm";

export const salesOrderRouter = createRouter({
  list: publicQuery
    .input(
      z.object({
        search: z.string().optional(),
        status: z.string().optional(),
        customerId: z.number().optional(),
        page: z.number().default(1),
        pageSize: z.number().default(20),
        isOverdue: z.boolean().optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      const db = getDb();
      const page = input?.page ?? 1;
      const pageSize = input?.pageSize ?? 20;
      const offset = (page - 1) * pageSize;

      const conditions = [];
      if (input?.search) {
        conditions.push(like(salesOrders.orderNo, `%${input.search}%`));
      }
      if (input?.status) {
        conditions.push(eq(salesOrders.orderStatus, input.status as any));
      }
      if (input?.customerId) {
        conditions.push(eq(salesOrders.customerId, input.customerId));
      }
      if (input?.isOverdue !== undefined) {
        conditions.push(eq(salesOrders.isOverdue, input.isOverdue));
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const [items, countResult] = await Promise.all([
        db
          .select()
          .from(salesOrders)
          .where(where)
          .orderBy(desc(salesOrders.createdAt))
          .limit(pageSize)
          .offset(offset),
        db
          .select({ count: sql<number>`count(*)` })
          .from(salesOrders)
          .where(where),
      ]);

      // 获取客户名称
      const itemsWithCustomer = await Promise.all(
        items.map(async (item) => {
          const [customer] = await db
            .select({ companyName: customers.companyName })
            .from(customers)
            .where(eq(customers.id, item.customerId));
          return {
            ...item,
            customerName: customer?.companyName ?? "未知客户",
            balance: Number(item.totalAmount) - Number(item.receivedAmount),
          };
        })
      );

      return {
        items: itemsWithCustomer,
        total: countResult[0]?.count ?? 0,
        page,
        pageSize,
      };
    }),

  getById: publicQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const [order] = await db
        .select()
        .from(salesOrders)
        .where(eq(salesOrders.id, input.id));
      if (!order) return null;

      const [customer] = await db
        .select()
        .from(customers)
        .where(eq(customers.id, order.customerId));

      const [checklist] = await db
        .select()
        .from(orderChecklists)
        .where(eq(orderChecklists.orderId, input.id));

      const [logistics] = await db
        .select()
        .from(logisticsTracking)
        .where(eq(logisticsTracking.orderId, input.id));

      const [receipt] = await db
        .select()
        .from(returnReceipts)
        .where(eq(returnReceipts.orderId, input.id));

      const prodConfirmations = await db
        .select()
        .from(productionConfirmations)
        .where(eq(productionConfirmations.orderId, input.id));

      return {
        ...order,
        customerName: customer?.companyName ?? "未知客户",
        customer,
        checklist: checklist ?? null,
        logistics: logistics ?? null,
        receipt: receipt ?? null,
        productionConfirmations: prodConfirmations,
        balance: Number(order.totalAmount) - Number(order.receivedAmount),
      };
    }),

  create: publicQuery
    .input(
      z.object({
        orderNo: z.string().min(1),
        customerId: z.number(),
        customerOrderNo: z.string().optional(),
        productName: z.string().min(1),
        productCode: z.string().optional(),
        quantity: z.number().min(1),
        unitPrice: z.string(),
        totalAmount: z.string(),
        shippingAddress: z.string().optional(),
        specialRequirements: z.string().optional(),
        dueDate: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const { dueDate, ...rest } = input;
      const [result] = await db.insert(salesOrders).values({
        ...rest,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        orderStatus: "待预审",
        invoicedAmount: "0.00",
        receivedAmount: "0.00",
      });

      // 自动创建空核对清单
      const orderId = Number(result.insertId);
      await db.insert(orderChecklists).values({
        orderId,
      });

      return { id: orderId, success: true };
    }),

  update: publicQuery
    .input(
      z.object({
        id: z.number(),
        data: z.object({
          customerOrderNo: z.string().optional(),
          productName: z.string().optional(),
          productCode: z.string().optional(),
          quantity: z.number().optional(),
          unitPrice: z.string().optional(),
          totalAmount: z.string().optional(),
          shippingAddress: z.string().optional(),
          specialRequirements: z.string().optional(),
          dueDate: z.string().optional(),
          notes: z.string().optional(),
        }).partial(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const { dueDate, ...rest } = input.data;
      await db
        .update(salesOrders)
        .set({
          ...rest,
          dueDate: dueDate ? new Date(dueDate) : undefined,
        })
        .where(eq(salesOrders.id, input.id));
      return { success: true };
    }),

  updateStatus: publicQuery
    .input(
      z.object({
        id: z.number(),
        orderStatus: z.enum([
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
        ]),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      await db
        .update(salesOrders)
        .set({ orderStatus: input.orderStatus })
        .where(eq(salesOrders.id, input.id));
      return { success: true };
    }),

  delete: publicQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(salesOrders).where(eq(salesOrders.id, input.id));
      return { success: true };
    }),

  // 核对清单
  updateChecklist: publicQuery
    .input(
      z.object({
        orderId: z.number(),
        quoteConfirmed: z.boolean().optional(),
        productNameChecked: z.boolean().optional(),
        productCodeChecked: z.boolean().optional(),
        quantityChecked: z.boolean().optional(),
        priceChecked: z.boolean().optional(),
        shippingAddressChecked: z.boolean().optional(),
        companyNameChecked: z.boolean().optional(),
        customerOrderNoChecked: z.boolean().optional(),
        paymentTermsChecked: z.boolean().optional(),
        financialInfoChecked: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const { orderId, ...checks } = input;

      // 检查是否全部勾选
      const allChecked =
        checks.quoteConfirmed &&
        checks.productNameChecked &&
        checks.productCodeChecked &&
        checks.quantityChecked &&
        checks.priceChecked &&
        checks.shippingAddressChecked &&
        checks.companyNameChecked &&
        checks.customerOrderNoChecked &&
        checks.paymentTermsChecked &&
        checks.financialInfoChecked;

      await db
        .update(orderChecklists)
        .set({
          ...checks,
          allChecked: allChecked ?? false,
          checkedAt: allChecked ? new Date() : undefined,
        })
        .where(eq(orderChecklists.orderId, orderId));

      return { success: true, allChecked: allChecked ?? false };
    }),

  // 物流跟踪
  updateLogistics: publicQuery
    .input(
      z.object({
        orderId: z.number(),
        logisticsCompany: z.string().optional(),
        logisticsNo: z.string().optional(),
        status: z.enum(["待发货", "运输中", "已签收", "异常"]).optional(),
        shippedAt: z.string().optional(),
        estimatedArrival: z.string().optional(),
        actualArrival: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const { orderId, shippedAt, estimatedArrival, actualArrival, ...rest } = input;
      const data = {
        ...rest,
        shippedAt: shippedAt ? new Date(shippedAt) : undefined,
        estimatedArrival: estimatedArrival ? new Date(estimatedArrival) : undefined,
        actualArrival: actualArrival ? new Date(actualArrival) : undefined,
      };

      const [existing] = await db
        .select()
        .from(logisticsTracking)
        .where(eq(logisticsTracking.orderId, orderId));

      if (existing) {
        await db
          .update(logisticsTracking)
          .set(data)
          .where(eq(logisticsTracking.orderId, orderId));
      } else {
        await db.insert(logisticsTracking).values({ orderId, ...data });
      }

      // 如果已签收，更新订单状态
      if (data.status === "已签收") {
        await db
          .update(salesOrders)
          .set({
            orderStatus: "待对账",
            receivedDate: data.actualArrival ? new Date(data.actualArrival) : new Date(),
          })
          .where(eq(salesOrders.id, orderId));
      }

      return { success: true };
    }),

  // 上传回单
  uploadReceipt: publicQuery
    .input(
      z.object({
        orderId: z.number(),
        receiptNo: z.string().optional(),
        signatory: z.string().optional(),
        signedAt: z.string().optional(),
        fileUrl: z.string().optional(),
        photoUrl: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const { orderId, signedAt, ...rest } = input;
      const data = {
        ...rest,
        signedAt: signedAt ? new Date(signedAt) : undefined,
      };

      const [existing] = await db
        .select()
        .from(returnReceipts)
        .where(eq(returnReceipts.orderId, orderId));

      if (existing) {
        await db
          .update(returnReceipts)
          .set(data)
          .where(eq(returnReceipts.orderId, orderId));
      } else {
        await db.insert(returnReceipts).values({ orderId, ...data });
      }

      // 更新订单状态为待对账
      await db
        .update(salesOrders)
        .set({ orderStatus: "待对账" })
        .where(eq(salesOrders.id, orderId));

      return { success: true };
    }),

  // 生产确认
  createProductionConfirmation: publicQuery
    .input(
      z.object({
        orderId: z.number(),
        department: z.string(),
        confirmedBy: z.string().optional(),
        deliveryDate: z.string().optional(),
        logisticsMethod: z.string().optional(),
        remarks: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const [result] = await db.insert(productionConfirmations).values(input);
      return { id: Number(result.insertId), success: true };
    }),

  confirmProduction: publicQuery
    .input(
      z.object({
        id: z.number(),
        confirmedBy: z.string(),
        deliveryDate: z.string().optional(),
        logisticsMethod: z.string().optional(),
        remarks: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...data } = input;
      await db
        .update(productionConfirmations)
        .set({
          ...data,
          status: "已确认",
          confirmedAt: new Date(),
        })
        .where(eq(productionConfirmations.id, id));
      return { success: true };
    }),
});
