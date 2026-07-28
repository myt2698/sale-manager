import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import {
  statements,
  invoices,
  paymentRecords,
  salesOrders,
} from "@db/schema";
import { eq, desc, and, sql } from "drizzle-orm";

export const financeRouter = createRouter({
  // ==================== 对账单 ====================
  listStatements: publicQuery
    .input(
      z.object({
        orderId: z.number().optional(),
        status: z.string().optional(),
        page: z.number().default(1),
        pageSize: z.number().default(20),
      }).optional()
    )
    .query(async ({ input }) => {
      const db = getDb();
      const page = input?.page ?? 1;
      const pageSize = input?.pageSize ?? 20;
      const offset = (page - 1) * pageSize;

      const conditions = [];
      if (input?.orderId) {
        conditions.push(eq(statements.orderId, input.orderId));
      }
      if (input?.status) {
        conditions.push(eq(statements.status, input.status as any));
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const [items, countResult] = await Promise.all([
        db
          .select()
          .from(statements)
          .where(where)
          .orderBy(desc(statements.createdAt))
          .limit(pageSize)
          .offset(offset),
        db
          .select({ count: sql<number>`count(*)` })
          .from(statements)
          .where(where),
      ]);

      return {
        items,
        total: countResult[0]?.count ?? 0,
        page,
        pageSize,
      };
    }),

  createStatement: publicQuery
    .input(
      z.object({
        orderId: z.number(),
        statementNo: z.string(),
        amount: z.string(),
        fileUrl: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const [result] = await db.insert(statements).values({
        ...input,
        status: "待发送",
      });

      // 更新订单状态
      await db
        .update(salesOrders)
        .set({ orderStatus: "待开票" })
        .where(eq(salesOrders.id, input.orderId));

      return { id: Number(result.insertId), success: true };
    }),

  sendStatement: publicQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db
        .update(statements)
        .set({ status: "待确认", sentAt: new Date() })
        .where(eq(statements.id, input.id));
      return { success: true };
    }),

  confirmStatement: publicQuery
    .input(z.object({ id: z.number(), confirmedBy: z.string().optional() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db
        .update(statements)
        .set({ status: "客户已确认", confirmedAt: new Date(), confirmedBy: input.confirmedBy })
        .where(eq(statements.id, input.id));
      return { success: true };
    }),

  // ==================== 发票 ====================
  listInvoices: publicQuery
    .input(
      z.object({
        orderId: z.number().optional(),
        status: z.string().optional(),
        page: z.number().default(1),
        pageSize: z.number().default(20),
      }).optional()
    )
    .query(async ({ input }) => {
      const db = getDb();
      const page = input?.page ?? 1;
      const pageSize = input?.pageSize ?? 20;
      const offset = (page - 1) * pageSize;

      const conditions = [];
      if (input?.orderId) {
        conditions.push(eq(invoices.orderId, input.orderId));
      }
      if (input?.status) {
        conditions.push(eq(invoices.status, input.status as any));
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const [items, countResult] = await Promise.all([
        db
          .select()
          .from(invoices)
          .where(where)
          .orderBy(desc(invoices.createdAt))
          .limit(pageSize)
          .offset(offset),
        db
          .select({ count: sql<number>`count(*)` })
          .from(invoices)
          .where(where),
      ]);

      return {
        items,
        total: countResult[0]?.count ?? 0,
        page,
        pageSize,
      };
    }),

  createInvoice: publicQuery
    .input(
      z.object({
        orderId: z.number(),
        statementId: z.number().optional(),
        invoiceNo: z.string(),
        amount: z.string(),
        taxRate: z.string().optional(),
        taxAmount: z.string().optional(),
        totalWithTax: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const [result] = await db.insert(invoices).values({
        ...input,
        status: "已开具",
        issuedAt: new Date(),
      });

      // 更新订单开票金额
      const orderInvoices = await db
        .select({ amount: invoices.amount })
        .from(invoices)
        .where(eq(invoices.orderId, input.orderId));

      const totalInvoiced = orderInvoices.reduce(
        (sum, inv) => sum + Number(inv.amount),
        0
      );

      await db
        .update(salesOrders)
        .set({
          invoicedAmount: String(totalInvoiced),
          orderStatus: "待付款",
          invoiceDate: new Date(),
        })
        .where(eq(salesOrders.id, input.orderId));

      return { id: Number(result.insertId), success: true };
    }),

  mailInvoice: publicQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db
        .update(invoices)
        .set({ status: "已邮寄", mailedAt: new Date() })
        .where(eq(invoices.id, input.id));
      return { success: true };
    }),

  // ==================== 回款记录 ====================
  listPayments: publicQuery
    .input(
      z.object({
        orderId: z.number().optional(),
        page: z.number().default(1),
        pageSize: z.number().default(20),
      }).optional()
    )
    .query(async ({ input }) => {
      const db = getDb();
      const page = input?.page ?? 1;
      const pageSize = input?.pageSize ?? 20;
      const offset = (page - 1) * pageSize;

      const where = input?.orderId
        ? eq(paymentRecords.orderId, input.orderId)
        : undefined;

      const [items, countResult] = await Promise.all([
        db
          .select()
          .from(paymentRecords)
          .where(where)
          .orderBy(desc(paymentRecords.createdAt))
          .limit(pageSize)
          .offset(offset),
        db
          .select({ count: sql<number>`count(*)` })
          .from(paymentRecords)
          .where(where),
      ]);

      return {
        items,
        total: countResult[0]?.count ?? 0,
        page,
        pageSize,
      };
    }),

  recordPayment: publicQuery
    .input(
      z.object({
        orderId: z.number(),
        invoiceId: z.number().optional(),
        paymentNo: z.string().optional(),
        amount: z.string(),
        paymentMethod: z.enum(["银行转账", "支票", "现金", "承兑汇票", "其他"]).default("银行转账"),
        paymentDate: z.string(),
        bankReference: z.string().optional(),
        payerAccount: z.string().optional(),
        payerName: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const [result] = await db.insert(paymentRecords).values({
        ...input,
        paymentDate: new Date(input.paymentDate),
      });

      // 更新订单收款金额
      const orderPayments = await db
        .select({ amount: paymentRecords.amount })
        .from(paymentRecords)
        .where(eq(paymentRecords.orderId, input.orderId));

      const totalReceived = orderPayments.reduce(
        (sum, p) => sum + Number(p.amount),
        0
      );

      // 获取订单总额
      const [order] = await db
        .select({ totalAmount: salesOrders.totalAmount })
        .from(salesOrders)
        .where(eq(salesOrders.id, input.orderId));

      const totalAmount = Number(order?.totalAmount ?? 0);
      let newStatus: string = "待付款";

      if (totalReceived >= totalAmount) {
        newStatus = "全部付款";
      } else if (totalReceived > 0) {
        newStatus = "部分付款";
      }

      await db
        .update(salesOrders)
        .set({
          receivedAmount: String(totalReceived),
          orderStatus: newStatus as any,
          completedDate: totalReceived >= totalAmount ? new Date() : undefined,
        })
        .where(eq(salesOrders.id, input.orderId));

      return { id: Number(result.insertId), success: true };
    }),

  deletePayment: publicQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();

      const [payment] = await db
        .select()
        .from(paymentRecords)
        .where(eq(paymentRecords.id, input.id));

      if (!payment) return { success: false };

      await db.delete(paymentRecords).where(eq(paymentRecords.id, input.id));

      // 重新计算收款金额
      const orderPayments = await db
        .select({ amount: paymentRecords.amount })
        .from(paymentRecords)
        .where(eq(paymentRecords.orderId, payment.orderId));

      const totalReceived = orderPayments.reduce(
        (sum, p) => sum + Number(p.amount),
        0
      );

      const [order] = await db
        .select({ totalAmount: salesOrders.totalAmount })
        .from(salesOrders)
        .where(eq(salesOrders.id, payment.orderId));

      const totalAmount = Number(order?.totalAmount ?? 0);
      let newStatus: string = "待付款";

      if (totalReceived >= totalAmount) {
        newStatus = "全部付款";
      } else if (totalReceived > 0) {
        newStatus = "部分付款";
      }

      await db
        .update(salesOrders)
        .set({
          receivedAmount: String(totalReceived),
          orderStatus: newStatus as any,
        })
        .where(eq(salesOrders.id, payment.orderId));

      return { success: true };
    }),
});
