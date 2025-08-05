import { Router } from "https://deno.land/x/oak@v17.1.3/mod.ts";
import { dbSqLiteHandler } from "../classes/db-sqlite.ts";
import { User } from "../models/users.ts";
import { create, getNumericDate } from "https://deno.land/x/djwt@v3.0.2/mod.ts";
import { SECRET_KEY } from "../utils/secret_key.ts";
import authMiddleware, { decodeAndVerifyToken } from "../utils/auth_middleware.ts";
import { allowRegistration } from "../utils/config.ts";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

const authRouter = new Router({ prefix: "/auth" });

//METHODS

async function generateTokens(user: User): Promise<{ accessToken: string; refreshToken: string }> {
  // Remove password from user object before creating token
  (user as any).password = undefined;

  const accessPayload = {
    userId: user.id,
    username: user.username,
    user: user,
    type: "access",
    exp: getNumericDate(60 * 60 * 1), // 1 hour
  };

  const refreshPayload = {
    userId: user.id,
    username: user.username,
    type: "refresh",
    exp: getNumericDate(60 * 60 * 24 * 7), // 7 days
  };

  const accessToken = await create({ alg: "HS256", typ: "JWT" }, accessPayload, SECRET_KEY);
  const refreshToken = await create({ alg: "HS256", typ: "JWT" }, refreshPayload, SECRET_KEY);

  return { accessToken, refreshToken };
}

///

authRouter.post("/login", async (context) => {
  const { username, password } = await context.request.body.json();

  if (!username || !password || username.trim() === "" || password.trim() === "") {
    context.response.status = 400;
    context.response.body = { error: "Username and password are required" };
    return;
  }

  const user = await dbSqLiteHandler.getUser(username);

  if (!user) {
    context.response.status = 401;
    context.response.body = { error: "User not found" };
    return;
  }

  const isPasswordValid = await bcrypt.compare(password, user!.password as string);

  if (!isPasswordValid) {
    context.response.status = 401;
    context.response.body = { error: "Unauthorized" };
    return;
  }

  const { accessToken, refreshToken } = await generateTokens(user!);
  const forwarded = context.request.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0].trim() : context.request.ip;
  console.log(`User ${user.username} logged in successfully. IP: ${ip}`);

  // await dbSqLiteHandler.insertToken(token, user);

  context.response.body = { accessToken, refreshToken };
});

authRouter.post("/refresh", async (context) => {
  const { token } = await context.request.body.json();

  if (!token || token.trim() === "") {
    context.response.status = 400;
    context.response.body = { error: "Token is required" };
    return;
  }

  const forwarded = context.request.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0].trim() : context.request.ip;

  const decodedToken = await decodeAndVerifyToken(token, ip, "refresh");
  if (!decodedToken) {
    context.response.status = 401;
    context.response.body = { error: "Unauthorized" };
    return;
  }

  const user = await dbSqLiteHandler.getUser(decodedToken!.username as string);

  if (!user) {
    context.response.status = 401;
    context.response.body = { error: "User not found" };
    return;
  }

  const { accessToken, refreshToken } = await generateTokens(user!);

  console.log(`User ${user.username} logged in successfully. IP: ${ip}`);
  // await dbSqLiteHandler.insertToken(token, user);
  context.response.body = { accessToken, refreshToken };
});

authRouter.post("/resetPassword", authMiddleware, async (context) => {
  const { password } = await context.request.body.json();

  const auth_username = context.state.user.username;

  if (!password || password.trim() === "") {
    context.response.status = 400;
    context.response.body = { error: "New Password is required" };
    return;
  }

  const hash = await bcrypt.hash(password);

  await dbSqLiteHandler
    .updateUserPassword(auth_username, hash)
    .then(async () => {
      const user = await dbSqLiteHandler.getUser(auth_username);
      if (!user) {
        context.response.status = 404;
        context.response.body = { error: "User not found" };
        return;
      }
      const { accessToken, refreshToken } = await generateTokens(user!);

      context.response.body = { accessToken, refreshToken };
    })
    .catch((error) => {
      console.error("Error updating password:", error);
      context.response.status = 500;
      context.response.body = { error: "Failed to update password" };
    });
});

authRouter.post("/register", async (context) => {
  const { username, password } = await context.request.body.json();

  if (!username || !password) {
    context.response.status = 400;
    context.response.body = { error: "Username and password are required" };
    return;
  }

  if (allowRegistration === false) {
    context.response.status = 403;
    context.response.body = { error: "Registration is not allowed" };
    return;
  }

  const existingUser = await dbSqLiteHandler.getUser(username);
  if (existingUser) {
    context.response.status = 409;
    context.response.body = { error: "Username already exists" };
    return;
  }

  const hash = await bcrypt.hash(password);

  const newUser = new User(username, hash, true);
  await dbSqLiteHandler.insertUser(newUser);

  const { accessToken, refreshToken } = await generateTokens(newUser);
  // await dbSqLiteHandler.insertToken(token, newUser);
  context.response.body = { accessToken, refreshToken };
});

export default authRouter;
