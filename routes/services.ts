import { Context, Router } from "https://deno.land/x/oak@v17.1.3/mod.ts";
import { dbSqLiteHandler } from "../classes/db-sqlite.ts";
import authMiddleware from "../utils/auth_middleware.ts";
import { V4 } from "https://deno.land/x/uuid/mod.ts";
import { Service } from "../classes/services.ts";
import { User } from "../models/users.ts";

const servicesRouter = new Router({ prefix: "/services" });

servicesRouter.get("/list", authMiddleware, async (context) => {
  const services = await dbSqLiteHandler.getAllServices();

  for (const service of services) {
    const expiryDate = new Date(Date.now() + (service.grace_period as number));
    service.grace_period = expiryDate;
  }

  context.response.body = services;
});

servicesRouter.post("/validate", async (context) => {
  const { key } = await context.request.body.json();

  if (!key || !V4.isValid(key)) {
    context.response.status = 400;
    context.response.body = { error: "A valid serive key is required" };
    return;
  }

  const service = await dbSqLiteHandler.getServiceByKey(key);

  if (!service) {
    context.response.status = 404;
    context.response.body = { error: "Service not found" };
    return;
  }

  if (service.active === false) {
    context.response.status = 403;
    context.response.body = { error: "Service is inactive" };
    return;
  }
  const clientHeader = context.request.headers.get("Client");

  if (!clientHeader || clientHeader !== service.name) {
    context.response.status = 403;
    context.response.body = { error: "Access Denied" };
    return;
  }

  const expiryDate = new Date(Date.now() + (service.grace_period as number));
  service.grace_period = expiryDate;

  context.response.body = service;
});

servicesRouter.put("/create", authMiddleware, async (context) => {
  const { url, grace_period = 24 * 60 * 60 * 1000, active = true, name } = await context.request.body.json();

  if (!name) {
    context.response.status = 400;
    context.response.body = { error: "All inputs are requred" };
    return;
  }

  if (grace_period < 60 * 60 * 1000) {
    context.response.status = 400;
    context.response.body = { error: "Grace period must be at least 1 hour" };
    return;
  }

  const key: string = V4.uuid();

  const user = new User("", "", true, context.state.user.userId);
  if (!user.id) {
    context.response.status = 400;
    context.response.body = { error: "User not found", state: context.state };
    return;
  }
  const service = new Service(name, key, grace_period, active, user, url);

  const existingService = await dbSqLiteHandler.getServiceByName(name);
  if (existingService) {
    context.response.status = 400;
    context.response.body = { error: "Service with this name already exists" };
    return;
  }

  await dbSqLiteHandler.insertService(service);

  context.response.body = service;
});

servicesRouter.patch("/update", authMiddleware, async (context) => {
  const { id, name, grace_period, active, url } = await context.request.body.json();

  if (!id) {
    context.response.status = 400;
    context.response.body = { error: "An ID is required" };
    return;
  }

  if (grace_period && grace_period < 60 * 60 * 1000) {
    context.response.status = 400;
    context.response.body = { error: "Grace period must be at least 1 hour" };
    return;
  }

  let service = await dbSqLiteHandler.getServiceById(id);
  if (!service) {
    context.response.status = 404;
    context.response.body = { error: "Service not found" };
    return;
  }

  service = service.copyWith({
    name: name ?? service.name,
    key: service.key,
    grace_period: grace_period ?? service.grace_period,
    active: active ?? service.active,
    url: url ?? service.url,
    createdBy: service.createdBy,
  });

  await dbSqLiteHandler.updateService(service);

  context.response.body = service;
});

export default servicesRouter;
