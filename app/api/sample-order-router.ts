import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { sampleOrders } from "@db/schema";
import { eq, like, desc, and, sql } from "drizzle-orm";

export const sampleOrderRouter = createRouter({
  list: publicQuery
    .input(
      z.object({
        search: z.string().optional(),
        status: z.string().optional(),
        customerId: z.number().optional(),
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
      if (input?.search) {
        conditions.push(like(sampleOrders.orderNo, `%${input.search}%`));
      }
      if (input?.status) {
        conditions.push(eq(sampleOrders.status, input.status as any));
      }
      if (input?.customerId) {
        conditions.push(eq(sampleOrders.customerId, input.customerId));
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const [items, countResult] = await Promise.all([
        db
          .select()
          .from(sampleOrders)
          .where(where)
          .orderBy(desc(sampleOrders.createdAt))
          .limit(pageSize)
          .offset(offset),
        db
          .select({ count: sql<number>`count(*)` })
          .from(sampleOrders)
          .where(where),
      ]);

      return {
        items,
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
        .from(sampleOrders)
        .where(eq(sampleOrders.id, input.id));
      return order ?? null;
    }),

  create: publicQuery
    .input(
      z.object({
        orderNo: z.string().min(1),
        customerId: z.number(),
        productName: z.string().min(1),
        productCode: z.string().optional(),
        quantity: z.number().min(1),
        unitPrice: z.string().optional(),
        totalAmount: z.string().optional(),
        specialRequirements: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const [result] = await db.insert(sampleOrders).values({
        ...input,
        status: "待处理",
      });
      return { id: Number(result.insertId), success: true };
    }),

  updateStatus: publicQuery
    .input(
      z.object({
        id: z.number(),
        status: z.enum([
          "待处理",
          "已发起",
          "待生产确认",
          "待出库",
          "待发货",
          "已发货",
          "已完成",
          "已取消",
        ]),
        deliveryDate: z.string().optional(),
        logisticsMethod: z.string().optional(),
        logisticsNo: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...data } = input;
      await db.update(sampleOrders).set(data).where(eq(sampleOrders.id, id));
      return { success: true };
    }),

  delete: publicQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(sampleOrders).where(eq(sampleOrders.id, input.id));
      return { success: true };
    }),
});
