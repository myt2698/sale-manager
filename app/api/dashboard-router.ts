import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import {
  salesOrders,
  customers,
  sampleOrders,
  paymentRecords,
} from "@db/schema";
import { eq, sql, and, gte, desc } from "drizzle-orm";

export const dashboardRouter = createRouter({
  stats: publicQuery.query(async () => {
    const db = getDb();

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // 订单统计
    const [orderStats] = await db
      .select({
        total: sql<number>`count(*)`,
        pending: sql<number>`sum(case when ${salesOrders.orderStatus} = '待预审' then 1 else 0 end)`,
        inProgress: sql<number>`sum(case when ${salesOrders.orderStatus} in ('待生产确认', '生产中', '待出库', '待发货', '待签收') then 1 else 0 end)`,
        toFinance: sql<number>`sum(case when ${salesOrders.orderStatus} in ('待对账', '待开票', '待付款') then 1 else 0 end)`,
        overdue: sql<number>`sum(case when ${salesOrders.isOverdue} = true then 1 else 0 end)`,
        completed: sql<number>`sum(case when ${salesOrders.orderStatus} = '已完结' then 1 else 0 end)`,
        totalAmount: sql<string>`coalesce(sum(${salesOrders.totalAmount}), 0)`,
        receivedAmount: sql<string>`coalesce(sum(${salesOrders.receivedAmount}), 0)`,
      })
      .from(salesOrders);

    // 客户统计
    const [customerStats] = await db
      .select({
        total: sql<number>`count(*)`,
        active: sql<number>`sum(case when ${customers.status} = '正式' then 1 else 0 end)`,
        potential: sql<number>`sum(case when ${customers.status} = '潜在' then 1 else 0 end)`,
      })
      .from(customers);

    // 本月回款
    const [monthPayment] = await db
      .select({
        total: sql<string>`coalesce(sum(${paymentRecords.amount}), 0)`,
        count: sql<number>`count(*)`,
      })
      .from(paymentRecords)
      .where(gte(paymentRecords.createdAt, thirtyDaysAgo));

    // 样品单统计
    const [sampleStats] = await db
      .select({
        total: sql<number>`count(*)`,
        pending: sql<number>`sum(case when ${sampleOrders.status} = '待处理' then 1 else 0 end)`,
        completed: sql<number>`sum(case when ${sampleOrders.status} = '已完成' then 1 else 0 end)`,
      })
      .from(sampleOrders);

    return {
      orders: {
        total: orderStats?.total ?? 0,
        pending: Number(orderStats?.pending ?? 0),
        inProgress: Number(orderStats?.inProgress ?? 0),
        toFinance: Number(orderStats?.toFinance ?? 0),
        overdue: Number(orderStats?.overdue ?? 0),
        completed: Number(orderStats?.completed ?? 0),
        totalAmount: orderStats?.totalAmount ?? "0",
        receivedAmount: orderStats?.receivedAmount ?? "0",
      },
      customers: {
        total: customerStats?.total ?? 0,
        active: Number(customerStats?.active ?? 0),
        potential: Number(customerStats?.potential ?? 0),
      },
      payments: {
        monthTotal: monthPayment?.total ?? "0",
        monthCount: monthPayment?.count ?? 0,
      },
      sampleOrders: {
        total: sampleStats?.total ?? 0,
        pending: Number(sampleStats?.pending ?? 0),
        completed: Number(sampleStats?.completed ?? 0),
      },
    };
  }),

  // AR账龄分析
  arAging: publicQuery.query(async () => {
    const db = getDb();

    const now = new Date();
    const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const d60 = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const d90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    const orders = await db
      .select()
      .from(salesOrders)
      .where(
        and(
          sql`${salesOrders.receivedAmount} < ${salesOrders.totalAmount}`,
          sql`${salesOrders.orderStatus} in ('待付款', '部分付款', '待开票')`
        )
      );

    const aging = {
      current: { count: 0, amount: 0 },
      d30: { count: 0, amount: 0 },
      d60: { count: 0, amount: 0 },
      d90: { count: 0, amount: 0 },
      over90: { count: 0, amount: 0 },
    };

    for (const order of orders) {
      const balance = Number(order.totalAmount) - Number(order.receivedAmount);
      if (balance <= 0) continue;

      const due = order.dueDate;
      if (!due) {
        aging.current.count++;
        aging.current.amount += balance;
        continue;
      }

      if (due > d30) {
        aging.current.count++;
        aging.current.amount += balance;
      } else if (due > d60) {
        aging.d30.count++;
        aging.d30.amount += balance;
      } else if (due > d90) {
        aging.d60.count++;
        aging.d60.amount += balance;
      } else {
        aging.d90.count++;
        aging.d90.amount += balance;
      }
    }

    return aging;
  }),

  // 最近订单
  recentOrders: publicQuery.query(async () => {
    const db = getDb();
    return await db
      .select({
        id: salesOrders.id,
        orderNo: salesOrders.orderNo,
        orderStatus: salesOrders.orderStatus,
        totalAmount: salesOrders.totalAmount,
        receivedAmount: salesOrders.receivedAmount,
        createdAt: salesOrders.createdAt,
        customerName: customers.companyName,
      })
      .from(salesOrders)
      .leftJoin(customers, eq(salesOrders.customerId, customers.id))
      .orderBy(desc(salesOrders.createdAt))
      .limit(10);
  }),

  // 逾期订单
  overdueOrders: publicQuery.query(async () => {
    const db = getDb();
    return await db
      .select({
        id: salesOrders.id,
        orderNo: salesOrders.orderNo,
        totalAmount: salesOrders.totalAmount,
        receivedAmount: salesOrders.receivedAmount,
        dueDate: salesOrders.dueDate,
        overdueDays: salesOrders.overdueDays,
        createdAt: salesOrders.createdAt,
        customerName: customers.companyName,
      })
      .from(salesOrders)
      .leftJoin(customers, eq(salesOrders.customerId, customers.id))
      .where(eq(salesOrders.isOverdue, true))
      .orderBy(desc(salesOrders.overdueDays))
      .limit(10);
  }),
});
