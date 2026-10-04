import { Router } from "express";
import { UserController } from "../controllers/user.controller";
import { UserService } from "../services/user.services";
import { UserRepository } from "../repositories/user.repository";

const userRepository = new UserRepository();
const userService = new UserService(userRepository);
const userController = new UserController(userService);

export const userRouter = Router();

userRouter.post("/", userController.createUser);
userRouter.get("/:id", userController.getUserById);
