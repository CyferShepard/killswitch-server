import authRouter from "./routes/auth.ts";
import { Application, Router } from "https://deno.land/x/oak@v17.1.3/mod.ts";
import { oakCors } from "https://deno.land/x/cors@v1.2.2/mod.ts";
import servicesRouter from "./routes/services.ts";
import logRouter from "./routes/logs.ts";
import licensesRouter, { licenseCacheInstance } from "./routes/licenses.ts";
import { dbSqLiteHandler } from "./classes/db-sqlite.ts";

const app = new Application();
const router = new Router();

// Use the oakCors middleware
app.use(
  oakCors({
    origin: "*", // Allow all origins
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"], // Allow specific methods
    allowedHeaders: ["Content-Type", "Authorization"], // Allow specific headers
  })
);

// Log all incoming requests (method, path, IP, headers, and payload without consuming the body)
app.use(async (context, next) => {
  const start = Date.now();
  const { request, response } = context;

  const method = request.method;
  const url = request.url;
  const path = `${url.pathname}${url.search}`;
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || (request as any).ip || "unknown";
  const headers = Object.fromEntries(request.headers.entries());
  const endpoint = url.pathname;

  let payload: unknown = undefined;
  const ctype = request.headers.get("content-type") || "";

  try {
    const bodyApi: any = (request as any).body; // matches your usage: await context.request.body.json()
    if (bodyApi) {
      if (ctype.includes("application/json") && typeof bodyApi.json === "function") {
        // Will consume the body; we store it for downstream handlers.
        payload = await bodyApi.json();
      } else if (ctype.includes("application/x-www-form-urlencoded") && typeof bodyApi.text === "function") {
        const text = await bodyApi.text();
        payload = Object.fromEntries(new URLSearchParams(text));
      } else if (ctype.includes("multipart/form-data") && typeof bodyApi.formData === "function") {
        const fd = await bodyApi.formData();
        payload = Object.fromEntries([...fd.entries()].map(([k, v]) => [k, typeof v === "string" ? v : `[file:${v.name}]`]));
      } else if ((ctype.startsWith("text/") || ctype === "") && typeof bodyApi.text === "function") {
        const text = await bodyApi.text();
        payload = text.length > 4096 ? text.slice(0, 4096) + "…(truncated)" : text;
      }
    }
  } catch (err) {
    payload = `Failed to read body: ${err instanceof Error ? err.message : String(err)}`;
  }

  // console.log(`[${new Date().toISOString()}] ${method} ${path} from ${ip}`);
  // console.log("Headers:", headers);
  // if (payload !== undefined) console.log("Payload:", payload);

  await next();

  // console.log(`Response: ${response.status} - ${Date.now() - start}ms`);

  await dbSqLiteHandler.insertRequestLog(
    ip,
    headers["client"] || null,
    response.status < 400,
    response.status >= 400 ? `Error: ${response.status}` : undefined,
    url.toString(),
    endpoint,
    method,
    JSON.stringify(headers),
    payload !== undefined ? JSON.stringify(payload) : undefined
  );
});

router.get("/ping", (context) => {
  context.response.body = "Hello, world!";
});

app.use(router.routes(), router.allowedMethods());
app.use(authRouter.routes(), authRouter.allowedMethods());
app.use(logRouter.routes(), logRouter.allowedMethods());
app.use(licensesRouter.routes(), licensesRouter.allowedMethods());
app.use(servicesRouter.routes(), servicesRouter.allowedMethods());

console.log("Initializing database and caching licenses...");
console.log("Caching services...");
await licenseCacheInstance.cacheLicenses();
console.log("Services Cached successfully.");
console.log("Caching licenses...");
await licenseCacheInstance.cacheServices();
console.log("Licenses Cached successfully.");
console.log("Database initialized and caches updated successfully.");

const port = 8100;
console.log(`Server is running on http://localhost:${port}`);

await app.listen({ port });
