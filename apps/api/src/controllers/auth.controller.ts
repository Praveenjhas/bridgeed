import type { Request, Response } from "express";
import type { LogoutResponse } from "@bridgeed/shared/src/types/auth";
import { requireAuthContext } from "../middleware/require-auth";
import { AuthService } from "../services/auth.service";
import { sendAuthError } from "../utils/auth-errors";

/**
 * Request-shape rejections. They are produced here, before any credential is
 * looked at, because an absent field is a malformed request rather than a failed
 * sign-in; everything that depends on what is in the database is left to the
 * service so its rejection is uniform.
 */
export const AUTH_CREDENTIALS_REQUIRED_MESSAGE =
  "email and password are required";
export const AUTH_REFRESH_TOKEN_REQUIRED_MESSAGE = "refreshToken is required";

/** The device and network a session is opened from, for the "signed in on" list. */
function readClientContext(req: Request): {
  userAgent: string | null;
  ipAddress: string | null;
} {
  const userAgent = req.get("user-agent");

  return {
    userAgent: userAgent && userAgent.trim().length > 0 ? userAgent : null,
    ipAddress: req.ip ?? null,
  };
}

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /** `POST /auth/register` */
  register = async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, password } = (req.body ?? {}) as {
        email?: unknown;
        password?: unknown;
      };

      if (typeof email !== "string" || typeof password !== "string") {
        res.status(400).json({ error: AUTH_CREDENTIALS_REQUIRED_MESSAGE });
        return;
      }

      const session = await this.authService.register({
        email,
        password,
        ...readClientContext(req),
      });

      res.status(201).json(session);
    } catch (error) {
      sendAuthError(error, res);
    }
  };

  /** `POST /auth/login` */
  login = async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, password } = (req.body ?? {}) as {
        email?: unknown;
        password?: unknown;
      };

      if (typeof email !== "string" || typeof password !== "string") {
        res.status(400).json({ error: AUTH_CREDENTIALS_REQUIRED_MESSAGE });
        return;
      }

      const session = await this.authService.login({
        email,
        password,
        ...readClientContext(req),
      });

      res.json(session);
    } catch (error) {
      sendAuthError(error, res);
    }
  };

  /** `POST /auth/refresh` */
  refresh = async (req: Request, res: Response): Promise<void> => {
    try {
      const { refreshToken } = (req.body ?? {}) as { refreshToken?: unknown };

      if (typeof refreshToken !== "string" || refreshToken.trim().length === 0) {
        res.status(400).json({ error: AUTH_REFRESH_TOKEN_REQUIRED_MESSAGE });
        return;
      }

      const session = await this.authService.refresh({ refreshToken });

      res.json(session);
    } catch (error) {
      sendAuthError(error, res);
    }
  };

  /**
   * `POST /auth/logout`. Signs out the session named by the presented access
   * token and nothing else, so the other devices the account is signed in on
   * stay signed in.
   */
  logout = async (req: Request, res: Response): Promise<void> => {
    try {
      const { sessionId } = requireAuthContext(req);

      const revokedSessions = await this.authService.logout(sessionId);

      const body: LogoutResponse = { success: true, revokedSessions };

      res.json(body);
    } catch (error) {
      sendAuthError(error, res);
    }
  };

  /**
   * `POST /auth/logout-all`. Signs out every session of the authenticated
   * account. The account is taken from `req.auth`, so a `userId` in the body or
   * the query string can never reach this call.
   */
  logoutAll = async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = requireAuthContext(req);

      const revokedSessions = await this.authService.logoutAll(userId);

      const body: LogoutResponse = { success: true, revokedSessions };

      res.json(body);
    } catch (error) {
      sendAuthError(error, res);
    }
  };

  /**
   * `GET /auth/me`. Returns the public identity of the authenticated account.
   * The id comes from `req.auth`, never from the body or the query string, and
   * no StudentProfile is created as a side effect.
   */
  me = async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = requireAuthContext(req);

      const user = await this.authService.getCurrentUser(userId);

      res.json(user);
    } catch (error) {
      sendAuthError(error, res);
    }
  };
}
