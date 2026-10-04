import type { User } from "@bridgeed/shared/src/types/user";
import { prisma } from "../config/prisma";

export class UserRepository {
  async findById(id: string): Promise<User | null> {
    const user = await prisma.user.findUnique({
      where: {
        id,
      },
    });

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role.toLowerCase() as User["role"],
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  async findByEmail(email: string): Promise<User | null> {
    const user = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role.toLowerCase() as User["role"],
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  async create(user: User): Promise<User> {
    const createdUser = await prisma.user.create({
      data: {
        id: user.id,
        email: user.email,
        role: user.role.toUpperCase() as
          "STUDENT" | "MENTOR" | "EDUCATOR" | "ADMIN",
        createdAt: new Date(user.createdAt),
        updatedAt: new Date(user.updatedAt),
      },
    });

    return {
      id: createdUser.id,
      email: createdUser.email,
      role: createdUser.role.toLowerCase() as User["role"],
      createdAt: createdUser.createdAt.toISOString(),
      updatedAt: createdUser.updatedAt.toISOString(),
    };
  }

  async findAll(): Promise<User[]> {
    const users = await prisma.user.findMany();

    return users.map((user) => ({
      id: user.id,
      email: user.email,
      role: user.role.toLowerCase() as User["role"],
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    }));
  }
}
