import authRouter from "./routes/auth.ts";
import { Application, Router } from "https://deno.land/x/oak@v17.1.3/mod.ts";
import { oakCors } from "https://deno.land/x/cors@v1.2.2/mod.ts";
import servicesRouter from "./routes/services.ts";
import logRouter from "./routes/logs.ts";

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

router.get("/ping", (context) => {
  context.response.body = "Hello, world!";
});

app.use(router.routes(), router.allowedMethods());
app.use(authRouter.routes(), authRouter.allowedMethods());
app.use(logRouter.routes(), logRouter.allowedMethods());
app.use(servicesRouter.routes(), servicesRouter.allowedMethods());

const port = 8100;
console.log(`Server is running on http://localhost:${port}`);

await app.listen({ port });
