import { Router } from "express";
import { AuthController } from "../controllers/auth.controller";
import { AuthService } from "../services/auth.service";
import { SessionRepository } from "../repositories/session.repository";
import { UserRepository } from "../repositories/user.repository";
import { requireAuth } from "../middleware/require-auth";
import {
  loginRateLimiter,
  refreshRateLimiter,
  registerRateLimiter,
} from "../middleware/rate-limit";

const authService = new AuthService(
  new UserRepository(),
  new SessionRepository(),
);

const authController = new AuthController(authService);

/** Mounted at /api/v1/auth */
export const authRouter = Router();

/**
 * The three unauthenticated endpoints: they are the ones a stranger can spend
 * work on, so they are the three that carry a rate limit. Registering, signing
 * in and refreshing are separate budgets because a client that rotates often
 * should not use up the budget it needs to sign in again.
 */
authRouter.post("/register", registerRateLimiter, authController.register);
authRouter.post("/login", loginRateLimiter, authController.login);
authRouter.post("/refresh", refreshRateLimiter, authController.refresh);

/**
 * The three authenticated endpoints. `requireAuth` is what establishes
 * `req.auth`; the controllers below read the caller only from there.
 */
authRouter.post("/logout", requireAuth, authController.logout);
authRouter.post("/logout-all", requireAuth, authController.logoutAll);
authRouter.get("/me", requireAuth, authController.me);
