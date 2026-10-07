import type { User } from "@bridgeed/shared";
import type { UserRole } from "@bridgeed/shared/src/constants/roles";
import type { UserStatus } from "@bridgeed/shared/src/constants/user-statuses";
import type {
  UserRole as UserRoleRecord,
  UserStatus as UserStatusRecord,
} from "../generated/prisma/enums";
import { prisma, type DatabaseClient } from "../config/prisma";
import { normalizeEmail } from "../utils/email";
import { toDatabaseRole, toWireRole } from "../utils/roles";
import { toDatabaseStatus, toWireStatus } from "../utils/user-status";

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

/** The account columns the credential layer reads, secrets included. */
interface AccountRow {
  id: string;
  email: string;
  role: UserRoleRecord;
  status: UserStatusRecord;
  passwordHash: string | null;
  passwordUpdatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Everything authentication needs about an account, including the two fields
 * that must never reach a client: `passwordHash` and the moment the password
 * last changed. Timestamps are ISO-8601 strings like every other value this
 * repository returns.
 */
export interface AccountRecord {
  id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  /** The scrypt digest, or null on an account that has no password yet. */
  passwordHash: string | null;
  /**
   * When the password last changed. A session created before this instant is
   * treated as stale, which is how a password change signs other devices out.
   */
  passwordUpdatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * A brand new credentialed account. The id is minted by the caller so the same
 * value can be used for the account and for the session written beside it, and
 * the email arrives already normalized by the service.
 */
export interface CreateAccountInput {
  id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  passwordHash: string;
  /** When the password was set; written in the same statement as the hash. */
  passwordUpdatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

function toAccount(account: AccountRow): AccountRecord {
  return {
    id: account.id,
    email: account.email,
    role: toWireRole(account.role),
    status: toWireStatus(account.status),
    passwordHash: account.passwordHash,
    passwordUpdatedAt: account.passwordUpdatedAt
      ? account.passwordUpdatedAt.toISOString()
      : null,
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
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

  /**
   * Creates a credentialed account: an ordinary user with a password and a
   * lifecycle status, which is what registration produces.
   *
   * `client` defaults to the pooled client; registration passes the transaction
   * handle so the account and its first session are written atomically. The
   * email must already be normalized — the service owns that rule — because a
   * second normalization here could disagree with the duplicate check.
   */
  async createAccount(
    input: CreateAccountInput,
    client: DatabaseClient = prisma,
  ): Promise<AccountRecord> {
    const account = await client.user.create({
      data: {
        id: input.id,
        email: input.email,
        role: toDatabaseRole(input.role),
        status: toDatabaseStatus(input.status),
        passwordHash: input.passwordHash,
        passwordUpdatedAt: input.passwordUpdatedAt,
        createdAt: input.createdAt,
        updatedAt: input.updatedAt,
      },
    });

    return toAccount(account);
  }

  /** Reads an account, secrets included, for the credential layer. */
  async findAccountById(id: string): Promise<AccountRecord | null> {
    const account = await prisma.user.findUnique({
      where: {
        id,
      },
    });

    return account ? toAccount(account) : null;
  }

  /**
   * Reads an account by email, secrets included. The address is normalized
   * first, exactly as `findByEmail` does, so sign-in finds the row however the
   * client cased or padded the input.
   */
  async findAccountByEmail(email: string): Promise<AccountRecord | null> {
    const normalizedEmail = normalizeEmail(email);

    if (normalizedEmail === null) {
      return null;
    }

    const account = await prisma.user.findUnique({
      where: {
        email: normalizedEmail,
      },
    });

    return account ? toAccount(account) : null;
  }

  async findAll(): Promise<User[]> {
    const users = await prisma.user.findMany();

    return users.map(toUser);
  }
}
