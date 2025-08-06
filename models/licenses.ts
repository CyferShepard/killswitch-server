export class License {
  key: string;
  name: string;
  service_id: number;
  grace_period: number | Date;
  active: boolean;
  expiration_date: string;
  auto_renew: boolean;

  constructor(
    key: string,
    name: string,
    service_id: number,
    grace_period: number = 86400000,
    active: boolean = true,
    expiration_date: string,
    auto_renew: boolean = true
  ) {
    this.key = key;
    this.name = name;
    this.service_id = service_id;
    this.grace_period = grace_period;
    this.active = active;
    this.expiration_date = expiration_date;
    this.auto_renew = auto_renew;
  }

  static fromResult(data: any): License {
    return new License(
      data.key,
      data.name,
      data.service_id,
      typeof data.grace_period === "number" ? data.grace_period : parseInt(data.grace_period),
      data.active === 1,
      data.expiration_date,
      data.auto_renew === 1
    );
  }

  toJSON(): object {
    return {
      key: this.key,
      name: this.name,
      service_id: this.service_id,
      grace_period: this.grace_period,
      active: this.active,
      expiration_date: this.expiration_date,
      auto_renew: this.auto_renew,
    };
  }

  copyWith({
    key,
    name,
    service_id,
    grace_period,
    active,
    expiration_date,
    auto_renew,
  }: {
    key?: string;
    name?: string;
    service_id?: number;
    grace_period?: number | Date;
    active?: boolean;
    expiration_date?: string;
    auto_renew?: boolean;
  }): License {
    return new License(
      key ?? this.key,
      name ?? this.name,
      service_id ?? this.service_id,
      (grace_period ?? this.grace_period) as number,
      active ?? this.active,
      expiration_date ?? this.expiration_date,
      auto_renew ?? this.auto_renew
    );
  }
}
