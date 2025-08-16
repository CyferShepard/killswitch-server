import { Context, Router } from "https://deno.land/x/oak@v17.1.3/mod.ts";
import { dbSqLiteHandler } from "../classes/db-sqlite.ts";
import authMiddleware from "../utils/auth_middleware.ts";

const logRouter = new Router({ prefix: "/logs" });

logRouter.get("/", authMiddleware, async (context) => {
  const days = context.request.url.searchParams.get("days") || "1";
  const where: string = `WHERE accessTime >= datetime('now', '-${days} day') and endpoint not like '/logs%'`;

  const requestLogs = await dbSqLiteHandler.getRequestLogs(where);

  context.response.body = requestLogs;
});

logRouter.get("/stats", authMiddleware, async (context) => {
  const days = context.request.url.searchParams.get("days") || "1";
  const where: string = `WHERE accessTime >= datetime('now', '-${days} day') and endpoint not like '/logs%'`;
  const requestLogs = await dbSqLiteHandler.getRequestLogsStats(where);

  context.response.body = requestLogs;
});
logRouter.get("/statsByUniqueIP", authMiddleware, async (context) => {
  const days = context.request.url.searchParams.get("days") || "1";
  const where: string = `WHERE accessTime >= datetime('now', '-${days} day') and endpoint not like '/logs%'`;
  const groupBy: string = "GROUP BY endpoint,ip_address";
  const requestLogs = await dbSqLiteHandler.getRequestLogsStats(where, groupBy);

  context.response.body = requestLogs;
});

export default logRouter;
