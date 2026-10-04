import type { Request, Response } from "express";
import { UserService } from "../services/user.services";
export class UserController {
  constructor(private readonly userService: UserService) {}

  createUser = (req: Request, res: Response): void => {
    try {
      const { email, role } = req.body;

      if (typeof email !== "string" || typeof role !== "string") {
        res.status(400).json({
          error: "email and role are required",
        });
        return;
      }

      const user = this.userService.createUser({
        email,
        role: role as Parameters<typeof this.userService.createUser>[0]["role"],
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

      res.status(500).json({
        error: "Internal server error",
      });
    }
  };

  getUserById = (req: Request, res: Response): void => {
    const { id } = req.params;

    if (typeof id !== "string") {
      res.status(400).json({
        error: "Invalid user ID",
      });
      return;
    }

    const user = this.userService.getUserById(id);

    if (!user) {
      res.status(404).json({
        error: "User not found",
      });
      return;
    }

    res.json(user);
  };
}
