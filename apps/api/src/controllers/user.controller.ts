import type { Request, Response } from "express";
import {
  USER_ROLES,
  type UserRole,
} from "@bridgeed/shared/src/constants/roles";
import {
  USER_EMAIL_INVALID_MESSAGE,
  USER_EMAIL_TAKEN_MESSAGE,
  UserService,
} from "../services/user.services";
import { parseRequestedRole } from "../utils/roles";

/**
 * `POST /users` is a legacy, unauthenticated development endpoint kept alive for
 * the existing smoke tests. Public account creation is going to live on
 * `POST /auth/register`, where the role is never taken from the client, so this
 * endpoint always creates an ordinary user: a client may send `user` (or the
 * database spelling `USER`), but never `admin`.
 */
export const ADMIN_CREATION_FORBIDDEN_MESSAGE =
  "Administrator accounts cannot be created through this endpoint";

/** Rejection for a role that is neither `user` nor `admin`. */
export const USER_ROLE_INVALID_MESSAGE = `role must be one of ${Object.values(
  USER_ROLES,
).join(", ")}`;

export class UserController {
  constructor(private readonly userService: UserService) {}

  createUser = async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, role } = (req.body ?? {}) as {
        email?: unknown;
        role?: unknown;
      };

      // The role defaults to an ordinary user, and a client can never ask for
      // an administrator here: the only public account creation path will be
      // /auth/register, which fixes the role server side.
      let requestedRole: UserRole = USER_ROLES.USER;

      if (role !== undefined) {
        const parsedRole = parseRequestedRole(role);

        if (parsedRole === null) {
          res.status(400).json({
            error: USER_ROLE_INVALID_MESSAGE,
          });
          return;
        }

        if (parsedRole === USER_ROLES.ADMIN) {
          res.status(403).json({
            error: ADMIN_CREATION_FORBIDDEN_MESSAGE,
          });
          return;
        }

        requestedRole = parsedRole;
      }

      const user = await this.userService.createUser({
        email,
        role: requestedRole,
      });

      res.status(201).json(user);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === USER_EMAIL_TAKEN_MESSAGE
      ) {
        res.status(409).json({
          error: error.message,
        });
        return;
      }

      if (
        error instanceof Error &&
        error.message === USER_EMAIL_INVALID_MESSAGE
      ) {
        res.status(400).json({
          error: error.message,
        });
        return;
      }

      console.error(error);

      res.status(500).json({
        error: "Internal server error",
      });
    }
  };

  getUserById = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      if (typeof id !== "string") {
        res.status(400).json({
          error: "Invalid user ID",
        });
        return;
      }

      const user = await this.userService.getUserById(id);

      if (!user) {
        res.status(404).json({
          error: "User not found",
        });
        return;
      }

      res.json(user);
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error: "Internal server error",
      });
    }
  };
}
