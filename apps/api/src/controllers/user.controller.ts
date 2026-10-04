import type { Request, Response } from "express";
import type { UserRole } from "@bridgeed/shared/src/constants/roles";
import { UserService } from "../services/user.services";

export class UserController {
  constructor(private readonly userService: UserService) {}

  createUser = async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, role } = req.body as {
        email?: unknown;
        role?: unknown;
      };

      if (typeof email !== "string" || typeof role !== "string") {
        res.status(400).json({
          error: "email and role are required",
        });
        return;
      }

      const user = await this.userService.createUser({
        email,
        role: role as UserRole,
      });

      res.status(201).json(user);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "A user with this email already exists"
      ) {
        res.status(409).json({
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
