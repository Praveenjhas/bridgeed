import type { User } from "@bridgeed/shared/src/types/user";
import type { UserRole } from "@bridgeed/shared/src/constants/roles";
import { UserRepository } from "../repositories/user.repository";
import { normalizeEmail } from "../utils/email";

/** Raised when a client sends an email that cannot be an address. */
export const USER_EMAIL_INVALID_MESSAGE = "A valid email address is required";

/**
 * Raised when the email is already registered. Kept as a stable message because
 * the controller maps it to 409 and the registration flow will reuse it.
 */
export const USER_EMAIL_TAKEN_MESSAGE = "A user with this email already exists";

export interface CreateUserInput {
  /** Raw client value; the service normalizes it and rejects what cannot be an address. */
  email: unknown;
  role: UserRole;
}

export class UserService {
  constructor(private readonly userRepository: UserRepository) {}

  /**
   * Creates an ordinary account. The email is normalized here so the stored row
   * and the duplicate check agree, and the account starts without credentials:
   * a password is only attached when the account is registered.
   */
  async createUser(input: CreateUserInput): Promise<User> {
    const email = normalizeEmail(input.email);

    if (email === null) {
      throw new Error(USER_EMAIL_INVALID_MESSAGE);
    }

    const existingUser = await this.userRepository.findByEmail(email);

    if (existingUser) {
      throw new Error(USER_EMAIL_TAKEN_MESSAGE);
    }

    const now = new Date().toISOString();

    const user: User = {
      id: crypto.randomUUID(),
      email,
      role: input.role,
      createdAt: now,
      updatedAt: now,
    };

    return this.userRepository.create(user);
  }

  async getUserById(id: string): Promise<User | null> {
    return this.userRepository.findById(id);
  }
}
