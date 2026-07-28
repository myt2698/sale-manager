import { authRouter } from "./auth-router";
import { createRouter, publicQuery } from "./middleware";
import { customerRouter } from "./customer-router";
import { sampleOrderRouter } from "./sample-order-router";
import { salesOrderRouter } from "./sales-order-router";
import { financeRouter } from "./finance-router";
import { dashboardRouter } from "./dashboard-router";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  auth: authRouter,
  customer: customerRouter,
  sampleOrder: sampleOrderRouter,
  salesOrder: salesOrderRouter,
  finance: financeRouter,
  dashboard: dashboardRouter,
});

export type AppRouter = typeof appRouter;
