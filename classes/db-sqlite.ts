import { Database } from "jsr:@db/sqlite@0.11";
import { User } from "../models/users.ts";
import { Service } from "./services.ts";
import { UUID } from "node:crypto";

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
      url TEXT,
      name TEXT UNIQUE NOT NULL,
      key TEXT NOT NULL,
      grace_period INTEGER NOT NULL DEFAULT '30 days',
      active INTEGER DEFAULT 1,
      created_by int NOT NULL,
      FOREIGN KEY (created_by) REFERENCES users(id)
      )
    `);

    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS request_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ip_address TEXT NOT NULL,
        client TEXT,
        valid INTEGER DEFAULT 1,
        reason TEXT,
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
    const stmt = this.db!.prepare(`SELECT s.id, s.url, s.name, s.key, s.grace_period, s.active,
        json_object('username',u.username,'password',u.password,'active',u.active ) created_by
        FROM services s JOIN users u ON s.created_by = u.id`);
    const results = await stmt.all();
    return results.map((result: Record<string, unknown>) => ({
      id: result.id,
      url: result.url,
      name: result.name,
      key: result.key,
      grace_period: typeof result.grace_period === "number" ? result.grace_period : parseInt(result.grace_period as string),
      active: result.active === 1,
      created_by: User.fromResult(result.created_by as Record<string, unknown>),
    }));
  }

  public async getServiceByKey(key: UUID): Promise<Service | undefined> {
    if (!this.db) {
      await this.initialize();
    }

    const stmt = this.db!.prepare(`SELECT s.id, s.url, s.name, s.key, s.grace_period, s.active FROM services s WHERE key=:key`);
    const result: Record<string, unknown> | undefined = await stmt.get({ key: key.toString() });

    if (result) {
      return Service.fromResult(result);
    }
  }

  public async getServiceByName(name: string): Promise<Service | undefined> {
    if (!this.db) {
      await this.initialize();
    }
    const stmt = this.db!.prepare(`SELECT s.id, s.url, s.name, s.key, s.grace_period, s.active FROM services s WHERE name=:name`);
    const result: Record<string, unknown> | undefined = await stmt.get({ name: name });
    if (result) {
      return Service.fromResult(result);
    }
  }

  public async getServiceById(id: number): Promise<Service | undefined> {
    if (!this.db) {
      await this.initialize();
    }
    const stmt = this.db!.prepare(`SELECT s.id, s.url, s.name, s.key, s.grace_period, s.active FROM services s WHERE id=:id`);
    const result: Record<string, unknown> | undefined = await stmt.get({ id: id });
    if (result) {
      return Service.fromResult(result);
    }
  }

  public async getRequestLogs(): Promise<any[]> {
    if (!this.db) {
      await this.initialize();
    }

    const stmt = this.db!.prepare("SELECT * FROM request_logs ORDER BY accessTime DESC");
    const results = await stmt.all();

    return results.map((result: Record<string, unknown>) => ({
      id: result.id,
      ip_address: result.ip_address,
      client: result.client,
      accessTime: result.accessTime,
      valid: result.valid === 1,
      reason: result.reason || null,
    }));
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

    const stmt = this.db!.prepare(
      "INSERT INTO services (url, name, key, grace_period, active, created_by) VALUES (:url, :name, :key, :grace_period, :active, :created_by)"
    );
    console.log("Inserting service:", service);
    console.log("Service data:", {
      url: service.url,
      name: service.name,
      key: service.key,
      grace_period: service.grace_period,
      active: service.active ? 1 : 0,
      created_by: service.createdBy!.id,
    });
    await stmt.run({
      url: service.url || null,
      name: service.name,
      key: service.key,
      grace_period: service.grace_period,
      active: service.active ? 1 : 0,
      created_by: service.createdBy!.id,
    });
  }

  public async insertRequestLog(ipAddress: string, client: string | null, valid: boolean = true, reason?: string) {
    if (!this.db) {
      await this.initialize();
    }

    const stmt = this.db!.prepare(
      "INSERT INTO request_logs (ip_address, client, valid, reason) VALUES (:ip_address, :client,:valid, :reason)"
    );
    await stmt.run({ ip_address: ipAddress, client: client || null, valid: valid ? 1 : 0, reason: reason || null });
    if (valid) {
      console.info(`Request log inserted: IP:${ipAddress}, Client:${client}, Valid:${valid}`);
    } else {
      console.warn(`Request log inserted: IP:${ipAddress}, Client:${client}, Valid:${valid}, Reason:${reason}`);
    }
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

    const stmt = this.db!.prepare(
      "UPDATE services SET url = :url, name = :name, grace_period = :grace_period, active = :active WHERE id = :id"
    );
    await stmt.run({
      id: service.id,
      url: service.url || null,
      name: service.name,
      grace_period: service.grace_period,
      active: service.active ? 1 : 0,
    });
  }
}

export const dbSqLiteHandler = new DBSqLiteHandler();
