export class User {
  id?: number;
  username: string;
  password: string;
  active: boolean;

  constructor(username: string, password: string, active: boolean, id?: number) {
    this.username = username;
    this.password = password;
    this.active = active;
    this.id = id;
  }

  static fromResult(data: any): User {
    return new User(data.username, data.password, data.active === 1, data.id);
  }

  toJSON(): object {
    return {
      username: this.username,
      //   password: this.password,
      active: this.active,
      id: this.id,
    };
  }
}
