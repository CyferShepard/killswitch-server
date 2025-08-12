import { Context, Router } from "https://deno.land/x/oak@v17.1.3/mod.ts";
import { dbSqLiteHandler } from "../classes/db-sqlite.ts";
import authMiddleware from "../utils/auth_middleware.ts";
import { V4 } from "https://deno.land/x/uuid@v0.1.2/mod.ts";
import { License } from "../models/licenses.ts";
import { Service } from "../models/services.ts";

const licensesRouter = new Router({ prefix: "/license" });

let licenseCache: Array<License> = [];

let serviceCache: Array<Service> = [];

class LicenseCache {
  public async cacheLicenses() {
    const licenses = await dbSqLiteHandler.getAllLicenses();
    licenseCache = licenses;
  }

  public async cacheServices() {
    const services = await dbSqLiteHandler.getAllServices();
    serviceCache = services;
  }
}

export const licenseCacheInstance = new LicenseCache();

licensesRouter.get("/list", authMiddleware, async (context) => {
  const service_id = context.request.url.searchParams.get("service_id");
  console.log("Service ID:", service_id);
  if (!service_id || isNaN(Number(service_id))) {
    context.response.status = 400;
    context.response.body = { error: "A valid service Id is required" };
    return;
  }

  const service = await dbSqLiteHandler.getServiceById(parseInt(service_id));
  if (!service) {
    context.response.status = 404;
    context.response.body = { error: "Service not found" };
    return;
  }

  const licenses = await dbSqLiteHandler.getLicenseByServiceId(service.id!);

  for (const license of licenses) {
    const expiryDate = new Date(Date.now() + (license.grace_period as number));
    license.grace_period = expiryDate;
  }

  context.response.body = licenses;
});

licensesRouter.post("/validate", async (context) => {
  const { key } = await context.request.body.json();
  const clientHeader = context.request.headers.get("Client");

  const forwarded = context.request.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0].trim() : context.request.ip;

  //input validation

  if (!clientHeader || serviceCache.map((s) => s.client).includes(clientHeader) === false) {
    context.response.status = 400;
    context.response.body = { error: "Invalid request" };
    await dbSqLiteHandler.insertRequestLog(ip, clientHeader || null, false, "Client header is missing or is invalid");
    return;
  }

  if (!key || !V4.isValid(key)) {
    context.response.status = 400;
    context.response.body = { error: "A valid serive key is required" };
    await dbSqLiteHandler.insertRequestLog(ip, clientHeader || null, false, "Invalid service key");
    return;
  }

  //find license and service

  const service = serviceCache.find((s) => s.client === clientHeader);
  // console.log("Service:", service);

  if (!service) {
    context.response.status = 404;
    context.response.body = { error: "Service not found" };
    await dbSqLiteHandler.insertRequestLog(ip, clientHeader || null, false, "Service not found: Key:" + key);
    return;
  }

  const license = licenseCache.find((l) => l.key === key);

  if (!license) {
    context.response.status = 404;
    context.response.body = { error: "License not found" };
    await dbSqLiteHandler.insertRequestLog(ip, clientHeader || null, false, "License not found: Key:" + key);
    return;
  }

  if (license.active === false) {
    context.response.status = 403;
    context.response.body = { error: "license is inactive" };
    await dbSqLiteHandler.insertRequestLog(ip, clientHeader || null, false, "license is inactive: Key:" + key);
    return;
  }

  if (license.expiration_date && new Date(license.expiration_date) < new Date()) {
    context.response.status = 403;
    context.response.body = { error: "License has expired" };
    await dbSqLiteHandler.insertRequestLog(ip, clientHeader, false, "License has expired: Key:" + key);
    return;
  }
  // Check if the client header matches the service client

  if (clientHeader !== service.client) {
    context.response.status = 403;
    context.response.body = { error: "Access Denied" };
    await dbSqLiteHandler.insertRequestLog(
      ip,
      clientHeader,
      false,
      "Client header does not match service name: " + service.name + ".\n Key: " + key
    );
    return;
  }

  const gracePeriodDate = new Date(Date.now() + (license.grace_period as number));

  const licenseJson = {
    ...license.toJSON(),
    client: service.client,
    grace_period: gracePeriodDate.toISOString(),
  };
  await dbSqLiteHandler.insertRequestLog(ip, clientHeader, true);

  context.response.body = licenseJson;
});

licensesRouter.put("/create", authMiddleware, async (context) => {
  const {
    name,
    service_id,
    grace_period = 24 * 60 * 60 * 1000,
    active = true,
    expiration_date = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    auto_renew = false,
  } = await context.request.body.json();

  if (!name || !service_id) {
    context.response.status = 400;
    context.response.body = { error: "All inputs are requred" };
    return;
  }

  if (grace_period < 60 * 60 * 1000) {
    context.response.status = 400;
    context.response.body = { error: "Grace period must be at least 1 hour" };
    return;
  }

  if (expiration_date && new Date(expiration_date) < new Date()) {
    context.response.status = 400;
    context.response.body = { error: "Expiration date must be in the future" };
    return;
  }

  const existingService = await dbSqLiteHandler.getServiceById(service_id);
  if (!existingService) {
    context.response.status = 404;
    context.response.body = { error: "Service not found" };
    return;
  }

  const key: string = V4.uuid();

  const license = new License(key, name, service_id, grace_period, active, expiration_date.toISOString(), auto_renew);

  await dbSqLiteHandler.insertLicense(license);
  await licenseCacheInstance.cacheLicenses();

  context.response.body = license;
});

licensesRouter.patch("/update", authMiddleware, async (context) => {
  const { key, name, service_id, grace_period, active, expiration_date, auto_renew } = await context.request.body.json();

  if (!key) {
    context.response.status = 400;
    context.response.body = { error: "A key is required" };
    return;
  }

  if (grace_period && grace_period < 60 * 60 * 1000) {
    context.response.status = 400;
    context.response.body = { error: "Grace period must be at least 1 hour" };
    return;
  }

  if (service_id) {
    const service = await dbSqLiteHandler.getServiceById(service_id);
    if (!service) {
      context.response.status = 404;
      context.response.body = { error: "Service not found" };
      return;
    }
  }
  if (expiration_date && new Date(expiration_date) < new Date()) {
    context.response.status = 400;
    context.response.body = { error: "Expiration date must be in the future" };
    return;
  }

  const license = await dbSqLiteHandler.getLicenseByKey(key);
  if (!license) {
    context.response.status = 404;
    context.response.body = { error: "License not found" };
    return;
  }

  const updatedLicense = license.copyWith({
    key: key,
    name: name || license.name,
    service_id: service_id || license.service_id,
    grace_period: grace_period ?? license.grace_period,
    active: active ?? license.active,
    expiration_date: expiration_date ? new Date(expiration_date).toISOString() : license.expiration_date,
    auto_renew: auto_renew ?? license.auto_renew,
  });

  await dbSqLiteHandler.updateLicense(updatedLicense);
  await licenseCacheInstance.cacheLicenses();

  context.response.body = updatedLicense;
});

export default licensesRouter;
