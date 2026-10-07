import { ApiConfigurationError } from "@/config/env";
import { ApiError } from "@/services/api";

/**
 * Development-only tracing for the credential flows.
 *
 * Signing in crosses four layers — the screen, the session module, the auth API
 * and the transport — and every one of them is asynchronous. When a submit looks
 * like it did nothing, the only useful question is *where* the flow stopped, so
 * each hop announces itself through `logAuthEvent` and the sequence reads
 * top to bottom in the Metro log.
 *
 * Two rules keep this safe to leave in the bundle:
 *
 * - It is inert outside development (`__DEV__`), so a release build logs
 *   nothing at all.
 * - It only prints the metadata a call site hands it. Credential material — a
 *   password, an access or refresh token, the contents of the secure store, the
 *   `Authorization` header — is never passed in, and `sanitize` drops any key
 *   that looks like it could carry one as a second line of defence.
 */

/** A value a diagnostic may carry. */
export type AuthLogMetaValue = string | number | boolean | null | undefined;

/** Safe metadata attached to a diagnostic. */
export type AuthLogMeta = Record<string, AuthLogMetaValue>;

/** Every step the credential flows can report. */
export type AuthLogEvent =
  | "LOGIN_BUTTON_PRESSED"
  | "LOGIN_VALIDATION_PASSED"
  | "LOGIN_API_START"
  | "LOGIN_API_SUCCESS"
  | "LOGIN_AUTH_STATE_UPDATED"
  | "LOGIN_ERROR"
  | "REGISTER_BUTTON_PRESSED"
  | "REGISTER_VALIDATION_PASSED"
  | "REGISTER_API_START"
  | "REGISTER_API_SUCCESS"
  | "REGISTER_AUTH_STATE_UPDATED"
  | "REGISTER_ERROR"
  | "AUTH_STATE_CHANGED"
  | "ROUTER_GUARD_UPDATED"
  | "AUTH_API_BASE_URL";

/** Prefix that makes the auth trace greppable in the Metro log. */
const LOG_PREFIX = "[bridgeed:auth]";

/**
 * Keys that could carry a credential. They are dropped rather than printed, so
 * a future call site cannot leak one by accident.
 */
const SECRET_KEY =
  /pass|secret|token|credential|cookie|header|bearer|authorization/i;

function sanitize(meta: AuthLogMeta): AuthLogMeta {
  const safe: AuthLogMeta = {};

  for (const [key, value] of Object.entries(meta)) {
    if (SECRET_KEY.test(key)) {
      continue;
    }

    safe[key] = value;
  }

  return safe;
}

/** Writes one development-only step of the credential flow. */
export function logAuthEvent(event: AuthLogEvent, meta?: AuthLogMeta): void {
  if (!__DEV__) {
    return;
  }

  if (meta === undefined) {
    console.log(`${LOG_PREFIX} ${event}`);

    return;
  }

  console.log(`${LOG_PREFIX} ${event}`, sanitize(meta));
}

/**
 * Plain description of a thrown failure, for the `*_ERROR` events.
 *
 * The HTTP status is what separates "the API said no" from "the API was never
 * reached"; the message is the same one the screen shows, so the log and the UI
 * never disagree.
 */
export function describeAuthError(error: unknown): AuthLogMeta {
  if (error instanceof ApiError) {
    return {
      category: error.isNetworkError ? "network" : "api",
      status: error.status,
      message: error.message,
      ...describeApiLocation(error.url),
    };
  }

  if (error instanceof ApiConfigurationError) {
    return { category: "configuration", message: error.message };
  }

  if (error instanceof Error) {
    return { category: error.name, message: error.message };
  }

  return { category: "unknown" };
}

/**
 * Host and port of an API URL, and nothing else.
 *
 * A phone running Expo Go can only reach the development machine over the LAN,
 * so which host the app resolved is the first thing worth checking when a
 * request never arrives. The path and any credentials are deliberately not
 * reported.
 */
export function describeApiLocation(baseUrl: string | null): AuthLogMeta {
  if (baseUrl === null) {
    return { host: null, port: null };
  }

  const match = /^[a-z][a-z0-9+.-]*:\/\/([^/:?#]+)(?::(\d+))?/i.exec(baseUrl);

  return {
    host: match?.[1] ?? null,
    port: match?.[2] ?? null,
  };
}
