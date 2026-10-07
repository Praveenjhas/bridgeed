import type { AuthSession, AuthenticatedUser } from "@bridgeed/shared";
import { ApiError, setAuthInterceptor } from "@/services/api";
import {
  fetchCurrentUser,
  login as loginRequest,
  logout as logoutRequest,
  refreshSession as refreshRequest,
  registerAccount,
} from "./api/auth.api";
import { logAuthEvent } from "./dev-log";
import {
  clearStoredSession,
  readStoredSession,
  writeStoredSession,
} from "./storage";

/**
 * The single source of truth for "who is signed in".
 *
 * It is deliberately framework free: React state lives in `AuthProvider`, which
 * mirrors this module rather than driving it. Keeping the session outside React
 * is what lets the transport attach a credential on a plain request, refresh a
 * token and sign the user out — from outside the component tree — and still have
 * every screen follow.
 */

/** Called with the new session, or null when signed out. */
type SessionListener = (session: AuthSession | null) => void;

let current: AuthSession | null = null;

const listeners = new Set<SessionListener>();

/**
 * The refresh currently in flight, if any.
 *
 * Several requests can be rejected within the same moment (the feed, its
 * comments and a profile, all at once). Sharing one refresh means they all
 * recover from a single rotation instead of racing, which matters because a
 * refresh token is single use.
 */
let refreshInFlight: Promise<string | null> | null = null;

function isUnauthorized(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

function emit(): void {
  const session = current;

  listeners.forEach((listener) => listener(session));
}

async function persist(session: AuthSession | null): Promise<void> {
  current = session;

  if (session === null) {
    await clearStoredSession();
  } else {
    await writeStoredSession(session);
  }

  emit();
}

/** Subscribes to session changes. Returns the unsubscribe function. */
export function subscribe(listener: SessionListener): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

/** The current session, or null. */
export function getSession(): AuthSession | null {
  return current;
}

/** The current access token, or null. Read by the transport on every request. */
export function getAccessToken(): string | null {
  return current?.accessToken ?? null;
}

/** The signed-in account, or null. */
export function getUser(): AuthenticatedUser | null {
  return current?.user ?? null;
}

/**
 * Loads the persisted session into memory without touching the network.
 *
 * Called once at startup so a relaunch starts signed in even when the API cannot
 * be reached; `confirmSession` is what then decides whether the credential is
 * still good.
 */
export async function restoreFromStorage(): Promise<AuthSession | null> {
  current = await readStoredSession();

  return current;
}

/**
 * Confirms the restored credential against `GET /auth/me`.
 *
 * Returns true when the app should stay signed in. A rejected credential signs
 * the user out; anything else (offline, a 500) keeps the cached session, because
 * a failed request is not evidence that the token is invalid.
 */
export async function confirmSession(): Promise<boolean> {
  if (current === null) {
    return false;
  }

  try {
    const user = await fetchCurrentUser();
    const latest = current;

    // A 401 during the call may have rotated the tokens, so the account is
    // written onto whatever session is current rather than onto the stale one.
    if (latest !== null) {
      await persist({ ...latest, user });
    }

    return true;
  } catch (error) {
    if (isUnauthorized(error)) {
      await persist(null);
      return false;
    }

    return true;
  }
}

/** Signs in and persists the resulting session. */
export async function signIn(
  email: string,
  password: string,
): Promise<AuthSession> {
  const session = await loginRequest({ email, password });

  await persist(session);

  // Logged here rather than in the screen: this is the moment the session was
  // published to every listener, so a screen that never sees the account can be
  // told apart from a session that was never stored.
  logAuthEvent("LOGIN_AUTH_STATE_UPDATED", {
    state: "authenticated",
    email: session.user.email,
  });

  return session;
}

/** Registers an account; the API signs it in, so no second call is needed. */
export async function signUp(
  email: string,
  password: string,
): Promise<AuthSession> {
  const session = await registerAccount({ email, password });

  await persist(session);

  logAuthEvent("REGISTER_AUTH_STATE_UPDATED", {
    state: "authenticated",
    email: session.user.email,
  });

  return session;
}

/**
 * Signs out.
 *
 * The server-side session is retired best effort: the local session is cleared
 * either way, so a user on a plane still gets out, and the refresh token is left
 * to expire on its own.
 */
export async function signOut(): Promise<void> {
  try {
    if (current !== null) {
      await logoutRequest();
    }
  } catch {
    // Ignored on purpose; see the doc comment above.
  }

  await persist(null);
}

/**
 * Exchanges the refresh token for a new access token.
 *
 * Serialised through `refreshInFlight`. A rejected refresh token retires the
 * session; a transport failure leaves it in place for a later attempt.
 */
function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight !== null) {
    return refreshInFlight;
  }

  const refreshToken = current?.refreshToken;

  if (refreshToken === undefined) {
    return Promise.resolve(null);
  }

  refreshInFlight = (async () => {
    try {
      const session = await refreshRequest({ refreshToken });

      await persist(session);

      return session.accessToken;
    } catch (error) {
      if (isUnauthorized(error)) {
        await persist(null);
      }

      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

/**
 * Gives the transport access to the credential. The provider calls this on
 * mount, so every feature request carries the bearer token and recovers from an
 * expired one without knowing sessions exist.
 */
export function attachApiAuth(): void {
  setAuthInterceptor({
    getAccessToken,
    refreshAccessToken,
    onAuthFailure: emit,
  });
}

/** Removes the transport callbacks, used when the provider unmounts. */
export function detachApiAuth(): void {
  setAuthInterceptor(null);
}
