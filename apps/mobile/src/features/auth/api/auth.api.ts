import type {
  AuthSession,
  CurrentUserResponse,
  LogoutResponse,
} from "@bridgeed/shared";
import { resolveApiBaseUrl } from "@/config/env";
import { apiClient } from "@/services/api";
import {
  describeApiLocation,
  logAuthEvent,
  type AuthLogMeta,
} from "../dev-log";

/**
 * Safe trace for one credential request: which account, which route, and the
 * host/port the app resolved. Never the body, so the password stays out of the
 * log by construction.
 */
function credentialTrace(path: string, email: string): AuthLogMeta {
  return {
    email,
    path,
    ...describeApiLocation(resolveApiBaseUrl().baseUrl),
  };
}

export interface Credentials {
  email: string;
  password: string;
  signal?: AbortSignal;
}

export interface RefreshSessionParams {
  /** The opaque refresh token, passed back exactly as it was received. */
  refreshToken: string;
  signal?: AbortSignal;
}

/**
 * Creates an account and signs it in.
 *
 * The API answers with a full session, so a successful registration needs no
 * second round trip: the client is signed in the moment this resolves.
 */
export async function registerAccount({
  email,
  password,
  signal,
}: Credentials): Promise<AuthSession> {
  logAuthEvent("REGISTER_API_START", credentialTrace("/auth/register", email));

  const session = await apiClient.post<AuthSession>("/auth/register", {
    body: { email, password },
    signal,
  });

  logAuthEvent(
    "REGISTER_API_SUCCESS",
    credentialTrace("/auth/register", email),
  );

  return session;
}

/** Exchanges an email and password for a session. */
export async function login({
  email,
  password,
  signal,
}: Credentials): Promise<AuthSession> {
  logAuthEvent("LOGIN_API_START", credentialTrace("/auth/login", email));

  const session = await apiClient.post<AuthSession>("/auth/login", {
    body: { email, password },
    signal,
  });

  logAuthEvent("LOGIN_API_SUCCESS", credentialTrace("/auth/login", email));

  return session;
}

/**
 * Rotates the session: the presented refresh token is retired and a new token
 * pair is returned. Only the newest refresh token is ever accepted, so the
 * caller must persist the response before using the access token.
 */
export async function refreshSession({
  refreshToken,
  signal,
}: RefreshSessionParams): Promise<AuthSession> {
  return apiClient.post<AuthSession>("/auth/refresh", {
    body: { refreshToken },
    signal,
  });
}

/**
 * Signs out the session named by the current access token, leaving the account's
 * other devices signed in. Requires an `Authorization` header, which the client
 * attaches on its own.
 */
export async function logout(signal?: AbortSignal): Promise<LogoutResponse> {
  return apiClient.post<LogoutResponse>("/auth/logout", { signal });
}

/**
 * Reads the public identity of the authenticated account. Used to confirm that a
 * restored access token is still valid and to refresh the cached account.
 */
export async function fetchCurrentUser(
  signal?: AbortSignal,
): Promise<CurrentUserResponse> {
  return apiClient.get<CurrentUserResponse>("/auth/me", { signal });
}
