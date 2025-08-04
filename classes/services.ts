import { User } from "../models/users.ts";

export class Service {
  id?: number;
  url?: string;
  name: string;
  key: string;
  grace_period: number | Date;
  active: boolean;
  createdBy?: User;

  constructor(name: string, key: string, grace_period: number, active: boolean, createdBy?: User, url?: string, id?: number) {
    this.id = id;
    this.url = url;
    this.key = key;
    this.grace_period = grace_period;
    this.active = active;
    this.name = name;
    this.createdBy = createdBy;
  }

  static fromResult(data: any): Service {
    return new Service(
      data.name,
      data.key,
      typeof data.grace_period === "number" ? data.grace_period : parseInt(data.grace_period),
      data.active === 1,
      data.created_by != null ? User.fromResult(data.created_by) : undefined,
      data.url,
      data.id
    );
  }

  copyWith({
    name,
    key,
    grace_period,
    active,
    createdBy,
    url,
    id,
  }: {
    name?: string;
    key?: string;
    grace_period?: number | Date;
    active?: boolean;
    createdBy?: User;
    url?: string;
    id?: number;
  }): Service {
    return new Service(
      name ?? this.name,
      key ?? this.key,
      (grace_period ?? this.grace_period) as number,
      active ?? this.active,
      createdBy ?? this.createdBy,
      url ?? this.url,
      id ?? this.id
    );
  }

  toJSON(): object {
    return {
      id: this.id,
      url: this.url,
      name: this.name,
      key: this.key,
      grace_period: this.grace_period,
      active: this.active,
      createdBy: this.createdBy != null ? this.createdBy.toJSON() : null,
    };
  }
}
