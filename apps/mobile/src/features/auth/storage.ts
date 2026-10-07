import * as SecureStore from "expo-secure-store";
import type { AuthSession } from "@bridgeed/shared";

/**
 * Where the token pair is kept between launches.
 *
 * A single JSON document holds the whole session, so a rotation is one atomic
 * write: there is never a moment where the access token on disk belongs to a
 * different refresh token than the one stored next to it. SecureStore allows
 * letters, digits, `.`, `-` and `_` in a key, which the constant below respects.
 */
const SESSION_KEY = "bridgeed.session.v1";

/**
 * Resolved once per launch. `isAvailableAsync` reports `false` on the web and on
 * any device whose secure keystore is missing, in which case the session lives
 * in memory only: still usable for the current run, just not remembered.
 */
let availability: Promise<boolean> | null = null;

function isSecureStoreAvailable(): Promise<boolean> {
  if (availability === null) {
    availability = SecureStore.isAvailableAsync().catch(() => false);
  }

  return availability;
}

/** In-memory fallback used when the secure keystore is unavailable. */
let memorySession: string | null = null;

function parseSession(raw: string | null): AuthSession | null {
  if (raw === null || raw.length === 0) {
    return null;
  }

  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    // A truncated or reshaped document is treated as "not signed in" rather than
    // crashing the launch; the next successful sign-in overwrites it.
    return null;
  }
}

/**
 * Reads the persisted session, or null when there is none.
 *
 * A read failure never propagates: storage is a convenience, and an unreadable
 * keystore should degrade to a signed-out app rather than a broken start.
 */
export async function readStoredSession(): Promise<AuthSession | null> {
  if (!(await isSecureStoreAvailable())) {
    return parseSession(memorySession);
  }

  try {
    return parseSession(await SecureStore.getItemAsync(SESSION_KEY));
  } catch {
    return null;
  }
}

/** Persists the session, so the next launch starts signed in. */
export async function writeStoredSession(session: AuthSession): Promise<void> {
  const raw = JSON.stringify(session);

  if (!(await isSecureStoreAvailable())) {
    memorySession = raw;
    return;
  }

  try {
    await SecureStore.setItemAsync(SESSION_KEY, raw);
  } catch {
    // Falling back to memory keeps the current run signed in even when the
    // device refuses to write, which is better than signing the user out.
    memorySession = raw;
  }
}

/** Removes the persisted session. Safe to call when nothing is stored. */
export async function clearStoredSession(): Promise<void> {
  memorySession = null;

  if (!(await isSecureStoreAvailable())) {
    return;
  }

  try {
    await SecureStore.deleteItemAsync(SESSION_KEY);
  } catch {
    // Nothing to recover: the in-memory copy is already gone, and the account is
    // signed out for this run regardless.
  }
}
