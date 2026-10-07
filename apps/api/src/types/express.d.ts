import type { AuthenticatedContext } from "../services/auth.service";

/**
 * Augments Express with the authenticated identity a guarded route reads.
 *
 * The property is optional because it only exists on requests that passed
 * through `requireAuth`; a route that needs it reads it through
 * `requireAuthContext`, which turns the programming error of mounting a route
 * without the guard into a 500 instead of a silent `undefined` dereference.
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthenticatedContext;
    }
  }
}
