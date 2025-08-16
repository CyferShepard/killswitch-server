import { Database } from "jsr:@db/sqlite@0.11";
import { User } from "../models/users.ts";
import { Service } from "../models/services.ts";
import { UUID } from "node:crypto";
import { License } from "../models/licenses.ts";
import { V4 } from "https://deno.land/x/uuid@v0.1.2/mod.ts";

class DBSqLiteHandler {
  private db: Database | undefined;

  private async initialize() {
    this.db = await new Database("./data/killswitch.db");

    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        active INTEGER DEFAULT 1
        
      )
    `);

    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      client TEXT UNIQUE NOT NULL,
      email TEXT NOT NULL

      )
    `);

    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS licenses (
      key TEXT PRIMARY KEY UNIQUE NOT NULL,
      name TEXT UNIQUE NOT NULL,
      service_id INTEGER NOT NULL,
      grace_period INTEGER NOT NULL DEFAULT 86400000,
      active INTEGER DEFAULT 1,
      expiration_date TEXT NOT NULL DEFAULT (datetime('now', '+1 year')),
      auto_renew INTEGER DEFAULT 1,
      FOREIGN KEY (service_id) REFERENCES services(id)
      )
    `);

    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS registered_licenses (
      key TEXT PRIMARY KEY UNIQUE NOT NULL,
      machineId TEXT NOT NULL,
      machineName TEXT
      registrationTime TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS request_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ip_address TEXT NOT NULL,
        client TEXT,
        valid INTEGER DEFAULT 1,
        reason TEXT,
        url TEXT,
        endpoint TEXT,
        method TEXT,
        headers TEXT,
        body TEXT,
        accessTime TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const users = await this.getAllUser();

    if (users.length === 0) {
      const user = new User("admin", "$2a$10$ZG7ZuVE.MfN9HTPj1GLluegeA.wsVYn75dkv6R5ItVMBwSxnZS7WG", true);
      await this.insertUser(user);
    }
  }

  //select
  public async getAllUser(): Promise<User[]> {
    if (!this.db) {
      await this.initialize();
    }

    const stmt = this.db!.prepare("SELECT * FROM users");
    const results = stmt.all();

    return results.map((result: Record<string, unknown>) => User.fromResult(result));
  }

  public async getUser(username: string) {
    if (!this.db) {
      await this.initialize();
    }

    const stmt = this.db!.prepare("SELECT * FROM users WHERE username=:username");
    const result: Record<string, unknown> | undefined = await stmt.get({ username: username });

    if (result) {
      return User.fromResult(result);
    }
  }

  public async getAllServices(): Promise<any[]> {
    if (!this.db) {
      await this.initialize();
    }
    const stmt = this.db!.prepare(`SELECT * FROM services`);
    const results = await stmt.all();
    return results.map((result: Record<string, unknown>) => Service.fromResult(result));
  }

  public async getServiceByName(name: string): Promise<Service | undefined> {
    if (!this.db) {
      await this.initialize();
    }
    const stmt = this.db!.prepare(`SELECT * FROM services s WHERE name=:name`);
    const result: Record<string, unknown> | undefined = await stmt.get({ name: name });
    if (result) {
      return Service.fromResult(result);
    }
  }

  public async getServiceByKey(key: UUID): Promise<Service | undefined> {
    if (!this.db) {
      await this.initialize();
    }
    const stmt = this.db!.prepare(
      `SELECT s.* FROM services s join licenses l on l.service_id = s.id WHERE l.key=:key and l.active = 1`
    );
    const result: Record<string, unknown> | undefined = await stmt.get({ key: key.toString() });
    if (result) {
      return Service.fromResult(result);
    }
  }

  public async getServiceById(id: number): Promise<Service | undefined> {
    if (!this.db) {
      await this.initialize();
    }
    const stmt = this.db!.prepare(`SELECT s.* FROM services s WHERE id=:id`);
    const result: Record<string, unknown> | undefined = await stmt.get({ id: id });
    if (result) {
      return Service.fromResult(result);
    }
  }

  public async getAllLicenses(): Promise<License[]> {
    if (!this.db) {
      await this.initialize();
    }

    const stmt = this.db!.prepare(`SELECT * FROM licenses`);
    const results = await stmt.all();

    return results.map((result: Record<string, unknown>) => License.fromResult(result));
  }

  public async getLicenseByServiceId(service_id: number): Promise<License[]> {
    if (!this.db) {
      await this.initialize();
    }

    const stmt = this.db!.prepare(`SELECT * FROM licenses WHERE service_id=:service_id`);
    const result = await stmt.all({ service_id: service_id });

    return result.map((result: Record<string, unknown>) => License.fromResult(result));
  }

  public async getLicenseByKey(key: UUID): Promise<License | undefined> {
    if (!this.db) {
      await this.initialize();
    }

    const stmt = this.db!.prepare(`SELECT * FROM licenses WHERE key=:key`);
    const result: Record<string, unknown> | undefined = await stmt.get({ key: key.toString() });

    if (result) {
      return License.fromResult(result);
    }
  }

  public async getRequestLogs(where?: string): Promise<any[]> {
    if (!this.db) {
      await this.initialize();
    }

    const stmt = this.db!.prepare(`SELECT * FROM request_logs ${where}  ORDER BY accessTime DESC`);
    const results = await stmt.all();

    return results.map((result: Record<string, unknown>) => ({
      id: result.id,
      ip_address: result.ip_address,
      client: result.client,
      accessTime: result.accessTime,
      valid: result.valid === 1,
      reason: result.reason || null,
      url: result.url || null,
      endpoint: result.endpoint || null,
      method: result.method || null,
      headers: result.headers ? JSON.parse(result.headers as string) : null,
      body: result.body ? JSON.parse(result.body as string) : null,
    }));
  }

  public async getRequestLogsStats(where?: string, groupBy?: string, orderBy?: string): Promise<any[]> {
    if (!this.db) {
      await this.initialize();
    }

    groupBy = groupBy || "GROUP BY endpoint";
    orderBy = orderBy || "ORDER BY accessTime DESC";

    const stmt = this.db!.prepare(
      `SELECT count(*) count, method, endpoint,accessTime,ip_address FROM request_logs ${where} ${groupBy} ${orderBy}`
    );
    const results = await stmt.all();

    return results.map((result: Record<string, unknown>) => ({
      count: result.count,
      accessTime: result.accessTime,
      endpoint: result.endpoint || null,
      method: result.method || null,
      ip_address: result.ip_address || null,
    }));
  }

  public async getRegisteredLicenseByKey(key: UUID): Promise<Record<string, unknown> | undefined> {
    if (!this.db) {
      await this.initialize();
    }

    const stmt = this.db!.prepare(`SELECT * FROM registered_licenses WHERE key=:key`);
    const result: Record<string, unknown> | undefined = await stmt.get({ key: key.toString() });

    return result;
  }

  //insert

  public async insertUser(user: User) {
    if (!this.db) {
      await this.initialize();
    }

    const stmt = this.db!.prepare("INSERT OR REPLACE INTO users (username,password,active) VALUES (:username,:password,:active)");
    await stmt.run({ username: user.username, password: user.password, active: user.active ? 1 : 0 });
  }

  public async insertService(service: Service) {
    if (!this.db) {
      await this.initialize();
    }

    const stmt = this.db!.prepare("INSERT INTO services (name, client, email) VALUES (:name, :client, :email)");

    await stmt.run({
      name: service.name,
      client: service.client,
      email: service.email,
    });
  }

  public async insertLicense(license: License) {
    if (!this.db) {
      await this.initialize();
    }

    const stmt = this.db!.prepare(
      "INSERT INTO licenses (key, name, service_id, grace_period, active, expiration_date, auto_renew) VALUES (:key, :name, :service_id, :grace_period, :active, :expiration_date, :auto_renew)"
    );

    await stmt.run({
      key: V4.uuid(),
      name: license.name,
      service_id: license.service_id,
      grace_period: license.grace_period,
      active: license.active ? 1 : 0,
      expiration_date: license.expiration_date,
      auto_renew: license.auto_renew ? 1 : 0,
    });
  }

  public async insertRequestLog(
    ipAddress: string,
    client: string | null,
    valid: boolean = true,
    reason?: string,
    url?: string,
    endpoint?: string,
    method?: string,
    headers?: string,
    body?: string
  ) {
    if (!this.db) {
      await this.initialize();
    }

    const stmt = this.db!.prepare(
      "INSERT INTO request_logs (ip_address, client, valid, reason, url,endpoint, method,headers, body) VALUES (:ip_address, :client,:valid, :reason, :url,:endpoint, :method, :headers, :body)"
    );
    await stmt.run({
      ip_address: ipAddress,
      client: client || null,
      valid: valid ? 1 : 0,
      reason: reason || null,
      url: url || null,
      endpoint: endpoint || null,
      method: method || null,
      headers: headers || null,
      body: body || null,
    });
  }

  public async insertRegisteredLicense(key: UUID, machineId: string, machineName?: string) {
    if (!this.db) {
      await this.initialize();
    }

    const stmt = this.db!.prepare(
      "INSERT INTO registered_licenses (key, machineId, machineName) VALUES (:key, :machineId, :machineName)"
    );

    await stmt.run({
      key: key.toString(),
      machineId: machineId,
      machineName: machineName || null,
    });
  }

  //update
  public async updateUser(user: User) {
    if (!this.db) {
      await this.initialize();
    }

    const stmt = this.db!.prepare("UPDATE users SET password = :password, active = :active WHERE username = :username");
    await stmt.run({ username: user.username, password: user.password, active: user.active ? 1 : 0 });
  }

  public async updateUserPassword(username: string, newPassword: string) {
    if (!this.db) {
      await this.initialize();
    }

    const stmt = this.db!.prepare("UPDATE users SET password=:password WHERE username=:username");
    await stmt.run({ username: username, password: newPassword });
  }

  public async updateService(service: Service) {
    if (!this.db) {
      await this.initialize();
    }

    const stmt = this.db!.prepare("UPDATE services SET name = :name, client =:client , email = :email WHERE id = :id");
    await stmt.run({
      id: service.id,
      name: service.name,
      client: service.client,
      email: service.email,
    });
  }

  public async updateLicense(license: License) {
    if (!this.db) {
      await this.initialize();
    }

    const stmt = this.db!.prepare(
      "UPDATE licenses SET name = :name, service_id = :service_id, grace_period = :grace_period, active = :active, expiration_date = :expiration_date, auto_renew = :auto_renew WHERE key = :key"
    );

    await stmt.run({
      key: license.key,
      name: license.name,
      service_id: license.service_id,
      grace_period: license.grace_period,
      active: license.active ? 1 : 0,
      expiration_date: license.expiration_date,
      auto_renew: license.auto_renew ? 1 : 0,
    });
  }

  public async updateRegisteredLicense(key: UUID, machineId: string, machineName?: string) {
    if (!this.db) {
      await this.initialize();
    }

    const stmt = this.db!.prepare(
      "UPDATE registered_licenses SET machineId = :machineId, machineName = :machineName WHERE key = :key"
    );

    await stmt.run({
      key: key.toString(),
      machineId: machineId,
      machineName: machineName || null,
    });
  }
}

export const dbSqLiteHandler = new DBSqLiteHandler();
