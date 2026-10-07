import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AuthSession, AuthenticatedUser } from "@bridgeed/shared";
import { resolveApiBaseUrl } from "@/config/env";
import { describeApiLocation, logAuthEvent } from "@/features/auth/dev-log";
import {
  attachApiAuth,
  confirmSession,
  detachApiAuth,
  getSession,
  restoreFromStorage,
  signIn,
  signOut,
  signUp,
  subscribe,
} from "@/features/auth/session";

/** Where the app is in resolving who is signed in. */
export type AuthStatus = "restoring" | "anonymous" | "authenticated";

export interface AuthContextValue {
  status: AuthStatus;
  /** The signed-in account, or null. */
  user: AuthenticatedUser | null;
  /**
   * The acting student id, or null. The content endpoints still take an explicit
   * `actorId`, so this is the value screens pass to them; it is now derived from
   * the session instead of the bundle environment.
   */
  actorId: string | null;
  isAuthenticated: boolean;
  isRestoring: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

interface AuthState {
  status: AuthStatus;
  user: AuthenticatedUser | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export interface AuthProviderProps {
  children: ReactNode;
}

/**
 * Publishes the signed-in account to the whole app.
 *
 * React state is a mirror of the framework free session module: sign-in,
 * sign-out and the transport's own refresh-and-retry all flow through
 * `subscribe`, so the guards react to a session that was retired by a background
 * request just as they do to one retired by the Profile screen.
 *
 * On mount it restores the persisted session and then confirms it against
 * `GET /auth/me`. Until that first read is done the app reports `restoring`, and
 * the root navigator shows a single splash instead of flashing the sign-in
 * screen at a user who is already signed in.
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>(() => {
    const session = getSession();

    return session === null
      ? { status: "restoring", user: null }
      : { status: "authenticated", user: session.user };
  });

  useEffect(() => {
    let isActive = true;

    const applySession = (session: AuthSession | null) => {
      logAuthEvent("AUTH_STATE_CHANGED", {
        state: session === null ? "anonymous" : "authenticated",
      });

      setState(
        session === null
          ? { status: "anonymous", user: null }
          : { status: "authenticated", user: session.user },
      );
    };

    // Which API the device is about to call is the first thing to check when a
    // request never arrives: on a phone, "localhost" would resolve to the phone.
    const api = resolveApiBaseUrl();

    logAuthEvent("AUTH_API_BASE_URL", {
      source: api.source,
      ...describeApiLocation(api.baseUrl),
    });

    attachApiAuth();

    const unsubscribe = subscribe((session) => {
      if (isActive) {
        applySession(session);
      }
    });

    void (async () => {
      const restored = await restoreFromStorage();

      if (!isActive) {
        return;
      }

      applySession(restored);

      if (restored !== null) {
        // The stored session is shown immediately; this only retires it when the
        // API says the credential is no longer good.
        await confirmSession();
      }
    })();

    return () => {
      isActive = false;
      unsubscribe();
      detachApiAuth();
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    await signIn(email, password);
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    await signUp(email, password);
  }, []);

  const logout = useCallback(async () => {
    await signOut();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status: state.status,
      user: state.user,
      actorId: state.user?.id ?? null,
      isAuthenticated: state.status === "authenticated",
      isRestoring: state.status === "restoring",
      login,
      register,
      logout,
    }),
    [login, logout, register, state],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Reads the session. Must be used inside an `AuthProvider`. */
export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);

  if (!value) {
    throw new Error("useAuth must be used inside an <AuthProvider>.");
  }

  return value;
}

/** How the acting student was obtained. */
export type ActorSource = "session" | "missing";

export interface ActorContextValue {
  /** The acting student id, or null when nobody is signed in. */
  actorId: string | null;
  source: ActorSource;
  /** Plain language explanation, surfaced by screens that need an actor. */
  detail: string;
  /** True when the app knows which student it is acting as. */
  isConfigured: boolean;
}

/**
 * The acting student, read from the session.
 *
 * The content endpoints take an explicit `actorId`, so screens that load per
 * student data keep asking for it here. This hook is the seam the old
 * environment-derived identity used to sit behind: swapping its source for a real
 * session did not require changing those screens.
 */
export function useActor(): ActorContextValue {
  const { user } = useAuth();

  return useMemo<ActorContextValue>(() => {
    if (user === null) {
      return {
        actorId: null,
        source: "missing",
        detail: "Sign in to see content ranked for your account.",
        isConfigured: false,
      };
    }

    return {
      actorId: user.id,
      source: "session",
      detail: `Signed in as ${user.email}.`,
      isConfigured: true,
    };
  }, [user]);
}
