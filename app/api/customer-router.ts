import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { customers, customerDocuments } from "@db/schema";
import { eq, like, desc, and, sql } from "drizzle-orm";

export const customerRouter = createRouter({
  // 客户列表
  list: publicQuery
    .input(
      z.object({
        search: z.string().optional(),
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
      if (input?.search) {
        conditions.push(like(customers.companyName, `%${input.search}%`));
      }
      if (input?.status) {
        conditions.push(eq(customers.status, input.status as "潜在" | "正式" | "冻结" | "黑名单"));
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const [items, countResult] = await Promise.all([
        db
          .select()
          .from(customers)
          .where(where)
          .orderBy(desc(customers.createdAt))
          .limit(pageSize)
          .offset(offset),
        db
          .select({ count: sql<number>`count(*)` })
          .from(customers)
          .where(where),
      ]);

      // 获取每个客户的文档数量
      const itemsWithDocCount = await Promise.all(
        items.map(async (item) => {
          const docs = await db
            .select({ count: sql<number>`count(*)` })
            .from(customerDocuments)
            .where(eq(customerDocuments.customerId, item.id));
          return {
            ...item,
            documentCount: docs[0]?.count ?? 0,
          };
        })
      );

      return {
        items: itemsWithDocCount,
        total: countResult[0]?.count ?? 0,
        page,
        pageSize,
      };
    }),

  // 获取单个客户
  getById: publicQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const [customer] = await db
        .select()
        .from(customers)
        .where(eq(customers.id, input.id));
      if (!customer) return null;

      const docs = await db
        .select()
        .from(customerDocuments)
        .where(eq(customerDocuments.customerId, input.id));

      return { ...customer, documents: docs };
    }),

  // 创建客户
  create: publicQuery
    .input(
      z.object({
        customerNo: z.string().min(1),
        companyName: z.string().min(1),
        contactName: z.string().optional(),
        contactPhone: z.string().optional(),
        contactEmail: z.string().optional(),
        status: z.enum(["潜在", "正式", "冻结", "黑名单"]).default("潜在"),
        bankName: z.string().optional(),
        bankAccount: z.string().optional(),
        bankAccountName: z.string().optional(),
        address: z.string().optional(),
        shippingAddress: z.string().optional(),
        riskLevel: z.enum(["低", "中", "高"]).default("中"),
        creditLimit: z.string().optional(),
        paymentTerms: z.string().optional(),
        settlementDay: z.number().optional(),
        invoicingDay: z.number().optional(),
        paymentDueDay: z.number().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const [result] = await db.insert(customers).values({
        ...input,
        creditLimit: input.creditLimit ?? "0.00",
      });
      return { id: Number(result.insertId), success: true };
    }),

  // 更新客户
  update: publicQuery
    .input(
      z.object({
        id: z.number(),
        data: z.object({
          customerNo: z.string().optional(),
          companyName: z.string().optional(),
          contactName: z.string().optional(),
          contactPhone: z.string().optional(),
          contactEmail: z.string().optional(),
          status: z.enum(["潜在", "正式", "冻结", "黑名单"]).optional(),
          bankName: z.string().optional(),
          bankAccount: z.string().optional(),
          bankAccountName: z.string().optional(),
          address: z.string().optional(),
          shippingAddress: z.string().optional(),
          riskLevel: z.enum(["低", "中", "高"]).optional(),
          creditLimit: z.string().optional(),
          paymentTerms: z.string().optional(),
          settlementDay: z.number().optional(),
          invoicingDay: z.number().optional(),
          paymentDueDay: z.number().optional(),
          notes: z.string().optional(),
        }),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      await db
        .update(customers)
        .set(input.data)
        .where(eq(customers.id, input.id));
      return { success: true };
    }),

  // 删除客户
  delete: publicQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(customers).where(eq(customers.id, input.id));
      return { success: true };
    }),

  // 上传客户文档
  uploadDocument: publicQuery
    .input(
      z.object({
        customerId: z.number(),
        documentType: z.enum(["风险评估表", "信息登记表", "营业执照", "合同", "其他"]),
        documentName: z.string(),
        fileUrl: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const [result] = await db.insert(customerDocuments).values(input);
      return { id: Number(result.insertId), success: true };
    }),

  // 检查客户是否可以转正式
  checkReadiness: publicQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const docs = await db
        .select()
        .from(customerDocuments)
        .where(eq(customerDocuments.customerId, input.id));

      const hasRiskAssessment = docs.some(
        (d) => d.documentType === "风险评估表"
      );
      const hasInfoForm = docs.some(
        (d) => d.documentType === "信息登记表"
      );

      return {
        ready: hasRiskAssessment && hasInfoForm,
        hasRiskAssessment,
        hasInfoForm,
        totalDocuments: docs.length,
      };
    }),
});
