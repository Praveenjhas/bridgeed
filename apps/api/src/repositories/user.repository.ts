import type { User } from "@bridgeed/shared/src/types/user";
export class UserRepository {
  private readonly users = new Map<string, User>();

  findById(id: string): User | null {
    return this.users.get(id) ?? null;
  }

  findByEmail(email: string): User | null {
    for (const user of this.users.values()) {
      if (user.email === email) {
        return user;
      }
    }

    return null;
  }

  create(user: User): User {
    this.users.set(user.id, user);
    return user;
  }

  findAll(): User[] {
    return Array.from(this.users.values());
  }
}
