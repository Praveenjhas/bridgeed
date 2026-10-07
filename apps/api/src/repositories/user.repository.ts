import type { User } from "@bridgeed/shared";
import type { UserRole as UserRoleRecord } from "../generated/prisma/enums";
import { prisma } from "../config/prisma";
import { normalizeEmail } from "../utils/email";
import { toDatabaseRole, toWireRole } from "../utils/roles";

interface UserRecord {
  id: string;
  email: string;
  role: UserRoleRecord;
  createdAt: Date;
  updatedAt: Date;
}

function toUser(user: UserRecord): User {
  return {
    id: user.id,
    email: user.email,
    role: toWireRole(user.role),
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export class UserRepository {
  async findById(id: string): Promise<User | null> {
    const user = await prisma.user.findUnique({
      where: {
        id,
      },
    });

    return user ? toUser(user) : null;
  }

  /**
   * Looks an account up by email. The address is normalized first, so sign-in
   * and duplicate detection find the row however the client cased or padded the
   * input, and an address that cannot be valid simply matches nothing.
   */
  async findByEmail(email: string): Promise<User | null> {
    const normalizedEmail = normalizeEmail(email);

    if (normalizedEmail === null) {
      return null;
    }

    const user = await prisma.user.findUnique({
      where: {
        email: normalizedEmail,
      },
    });

    return user ? toUser(user) : null;
  }

  /**
   * Creates the account row. The email is stored exactly as the service handed
   * it over — the service normalizes and validates before it gets here — and the
   * row is written without credentials: `passwordHash` stays null until the
   * account is given a password, which is what every pre-authentication account
   * already looks like.
   */
  async create(user: User): Promise<User> {
    const createdUser = await prisma.user.create({
      data: {
        id: user.id,
        email: user.email,
        role: toDatabaseRole(user.role),
        createdAt: new Date(user.createdAt),
        updatedAt: new Date(user.updatedAt),
      },
    });

    return toUser(createdUser);
  }

  async findAll(): Promise<User[]> {
    const users = await prisma.user.findMany();

    return users.map(toUser);
  }
}
