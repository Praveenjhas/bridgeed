import { Router } from "express";
import { UserController } from "../controllers/user.controller";
import { UserService } from "../services/user.services";
import { UserRepository } from "../repositories/user.repository";

const userRepository = new UserRepository();
const userService = new UserService(userRepository);
const userController = new UserController(userService);

export const userRouter = Router();

/**
 * Legacy account endpoints. `POST /users` exists for development and for the
 * existing smoke tests only: it is unauthenticated, so it always creates an
 * ordinary user and rejects `admin`. Public registration will go through
 * `POST /auth/register`, and reading `/users/:id` becomes authenticated in the
 * same phase.
 */
userRouter.post("/", userController.createUser);
userRouter.get("/:id", userController.getUserById);
