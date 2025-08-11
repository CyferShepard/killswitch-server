import { Context, Router } from "https://deno.land/x/oak@v17.1.3/mod.ts";
import { dbSqLiteHandler } from "../classes/db-sqlite.ts";
import authMiddleware from "../utils/auth_middleware.ts";
import { Service } from "../models/services.ts";
import { licenseCacheInstance } from "./licenses.ts";

const servicesRouter = new Router({ prefix: "/services" });

servicesRouter.get("/list", authMiddleware, async (context) => {
  const services = await dbSqLiteHandler.getAllServices();

  for (const service of services) {
    const expiryDate = new Date(Date.now() + (service.grace_period as number));
    service.grace_period = expiryDate;
  }

  context.response.body = services;
});

servicesRouter.put("/create", authMiddleware, async (context) => {
  const { client, name, email } = await context.request.body.json();

  if (!name || !client) {
    context.response.status = 400;
    context.response.body = { error: "All inputs are requred" };
    return;
  }

  const service = new Service(name, client, email || "");

  const existingService = await dbSqLiteHandler.getServiceByName(name);
  if (existingService) {
    context.response.status = 400;
    context.response.body = { error: "Service with this name already exists" };
    return;
  }

  await dbSqLiteHandler.insertService(service);
  await licenseCacheInstance.cacheServices();

  context.response.body = service;
});

servicesRouter.patch("/update", authMiddleware, async (context) => {
  const { id, name, client, email } = await context.request.body.json();

  if (!id) {
    context.response.status = 400;
    context.response.body = { error: "An ID is required" };
    return;
  }

  let service = await dbSqLiteHandler.getServiceById(id);
  if (!service) {
    context.response.status = 404;
    context.response.body = { error: "Service not found" };
    return;
  }

  service = service.copyWith({
    id: id,
    name: name || service.name,
    client: client || service.client,
    email: email || service.email,
  });

  await dbSqLiteHandler.updateService(service);
  await licenseCacheInstance.cacheServices();

  context.response.body = service;
});

export default servicesRouter;
