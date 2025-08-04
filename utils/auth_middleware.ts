import { Context } from "https://deno.land/x/oak@v17.1.3/mod.ts";
import { SECRET_KEY } from "./secret_key.ts";
import { Payload, verify } from "https://deno.land/x/djwt@v3.0.2/mod.ts";

// Middleware to check for authorization

export async function decodeAndVerifyToken(token: string, ip: string, allowedType: string = "access"): Promise<Payload | null> {
  try {
    const payload = await verify(token, SECRET_KEY);

    if (!payload || payload.type !== allowedType) {
      return null;
    }

    return payload;
  } catch (error) {
    if (error instanceof Error) {
      console.error(`[Unauthorized]: (${ip}) Failed to verify token: ${error.message}`);
    } else {
      console.error(`[Unauthorized]: (${ip}) Failed to verify token: ${error}`);
    }
    return null;
    // throw error;
  }
}

export default async function authMiddleware(context: Context, next: () => Promise<unknown>) {
  let authHeader: string | null = context.request.headers.get("Authorization");
  if (context.request.url.pathname.startsWith("/wss")) {
    authHeader = context.request.headers.get("Sec-WebSocket-Protocol");
  }

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    context.response.status = 401;
    context.response.body = { error: "Unauthorized" };
    return;
  }

  const token = authHeader.replace("Bearer ", "");

  const user = await (async () => {
    try {
      const forwarded = context.request.headers.get("x-forwarded-for");
      const ip = forwarded ? forwarded.split(",")[0].trim() : context.request.ip;
      return await decodeAndVerifyToken(token, ip);
    } catch (e) {
      console.error("Failed to decode token:", e);
      return null;
    }
  })();

  if (!user) {
    context.response.status = 401;
    context.response.body = { error: "Unauthorized" };
    return;
  }

  context.state.user = user;
  await next();
}
