import { Context, Router } from "https://deno.land/x/oak@v17.1.3/mod.ts";
import { dbSqLiteHandler } from "../classes/db-sqlite.ts";
import authMiddleware from "../utils/auth_middleware.ts";

const logRouter = new Router({ prefix: "/logs" });

logRouter.get("/", authMiddleware, async (context) => {
  const requestLogs = await dbSqLiteHandler.getRequestLogs();

  context.response.body = requestLogs;
});

export default logRouter;
