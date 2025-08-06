export class Service {
  id?: number;
  name: string;
  client: string;
  email: string;

  constructor(name: string, client: string, email: string, id?: number) {
    this.id = id;
    this.name = name;
    this.client = client;
    this.email = email;
  }

  static fromResult(data: any): Service {
    return new Service(data.name, data.client, data.email, data.id);
  }

  copyWith({ name, client, email, id }: { name?: string; client?: string; email?: string; id?: number }): Service {
    return new Service(name ?? this.name, client ?? this.client, email ?? this.email, id ?? this.id);
  }

  toJSON(): object {
    return {
      id: this.id,
      name: this.name,
      client: this.client,
      email: this.email,
    };
  }
}
