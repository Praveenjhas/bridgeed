import type { User } from "@bridgeed/shared/src/types/user";
import type { UserRole } from "@bridgeed/shared/src/constants/roles.ts";
import { UserRepository } from "../repositories/user.repository";

export interface CreateUserInput {
  email: string;
  role: UserRole;
}

export class UserService {
  constructor(private readonly userRepository: UserRepository) {}

  createUser(input: CreateUserInput): User {
    const existingUser = this.userRepository.findByEmail(input.email);

    if (existingUser) {
      throw new Error("A user with this email already exists");
    }

    const now = new Date().toISOString();

    const user: User = {
      id: crypto.randomUUID(),
      email: input.email,
      role: input.role,
      createdAt: now,
      updatedAt: now,
    };

    return this.userRepository.create(user);
  }

  getUserById(id: string): User | null {
    return this.userRepository.findById(id);
  }
}
