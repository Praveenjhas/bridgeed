import { ApiConfigurationError, getApiBaseUrl } from "@/config/env";

/** Every backend route is mounted under this prefix. */
const API_PATH_PREFIX = "/api/v1";

/** Requests are aborted after this long, so a dead server cannot hang the UI. */
const DEFAULT_TIMEOUT_MS = 15_000;

export type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

/** Query values accepted by the client; nullish entries are dropped. */
export type QueryValue = string | number | boolean | null | undefined;
export type QueryParams = Record<string, QueryValue>;

export interface ApiErrorOptions {
  /** HTTP status, or 0 when the request never produced a response. */
  status: number;
  /** Full URL that failed, which makes device logs actionable. */
  url: string;
  /** Message safe to show to a user. */
  message: string;
  /** Parsed error body, when the server sent one. */
  body?: unknown;
  /** Original failure, kept for logging. */
  cause?: unknown;
}

/**
 * Error raised for every failed API call, whether the failure came from the
 * network, from the transport or from the API itself.
 *
 * Keeping one error type means callers never have to distinguish between
 * "fetch threw" and "the server answered 4xx/5xx", and the message is already
 * fit for display.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly url: string;
  readonly body: unknown;
  /** True when the request never reached the server. */
  readonly isNetworkError: boolean;

  constructor({ status, url, message, body, cause }: ApiErrorOptions) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.url = url;
    this.body = body;
    this.isNetworkError = status === 0;

    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}

export interface RequestOptions {
  /** Query parameters; entries that are null or undefined are omitted. */
  query?: QueryParams;
  /** Body serialised as JSON. `undefined` sends no body. */
  body?: unknown;
  /** Caller owned cancellation, linked with the internal timeout. */
  signal?: AbortSignal;
  /** Per request timeout override, mainly for tests. */
  timeoutMs?: number;
}

/**
 * The credential callbacks the session layer installs on the transport.
 *
 * The client owns no knowledge of sessions, storage or features: it only asks
 * these questions. Keeping them in the transport (rather than importing the auth
 * feature here) is what stops a cycle between `services/api` and the provider
 * that consumes it.
 */
export interface AuthInterceptor {
  /** Bearer token to send with the next request, or null while signed out. */
  getAccessToken: () => string | null;
  /**
   * Exchanges the refresh token for a new access token and returns it, or
   * returns null when the session cannot be renewed.
   */
  refreshAccessToken: () => Promise<string | null>;
  /** Called once a request has been rejected and could not be recovered. */
  onAuthFailure?: () => void;
}

let authInterceptor: AuthInterceptor | null = null;

/**
 * Installs (or clears, by passing `null`) the credential callbacks. The session
 * provider owns the lifecycle; the transport only reads the current value.
 */
export function setAuthInterceptor(interceptor: AuthInterceptor | null): void {
  authInterceptor = interceptor;
}

/**
 * Credential endpoints that must never trigger a refresh-and-retry.
 *
 * Replaying a sign-in, a sign-up or the refresh call itself would either loop or
 * spend a rate-limit budget on a request that is already known to be answered in
 * a single attempt.
 */
const NON_RETRYABLE_PATHS = ["/auth/refresh", "/auth/login", "/auth/register"];

function isRetryablePath(path: string): boolean {
  return !NON_RETRYABLE_PATHS.some(
    (blocked) =>
      path === blocked ||
      path.startsWith(`${blocked}/`) ||
      path.startsWith(`${blocked}?`),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function appendQuery(url: string, query: QueryParams | undefined): string {
  if (!query) {
    return url;
  }

  const search = Object.entries(query)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`,
    )
    .join("&");

  return search.length > 0 ? `${url}?${search}` : url;
}

function buildUrl(path: string, query: QueryParams | undefined): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return appendQuery(
    `${getApiBaseUrl()}${API_PATH_PREFIX}${normalizedPath}`,
    query,
  );
}

/**
 * Forwards cancellation from the caller to the internal controller, because
 * `AbortSignal.any` is not available in the React Native runtime.
 */
function linkSignals(
  external: AbortSignal | undefined,
  controller: AbortController,
): () => void {
  if (!external) {
    return () => {};
  }

  if (external.aborted) {
    controller.abort();
    return () => {};
  }

  const forward = () => controller.abort();

  external.addEventListener("abort", forward);

  return () => external.removeEventListener("abort", forward);
}

function readErrorMessage(payload: unknown, status: number): string {
  if (isRecord(payload)) {
    const error = payload.error;

    if (typeof error === "string" && error.length > 0) {
      return error;
    }
  }

  return `The BridgeEd API answered with status ${status}.`;
}

async function readResponse<TResponse>(
  response: Response,
  url: string,
): Promise<TResponse> {
  // DELETE endpoints answer 204 with no body, which is a success, not an error.
  if (response.status === 204) {
    return undefined as TResponse;
  }

  const text = await response.text();
  let payload: unknown;

  if (text.length > 0) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = undefined;
    }
  }

  if (!response.ok) {
    throw new ApiError({
      status: response.status,
      url,
      message: readErrorMessage(payload, response.status),
      body: payload ?? text,
    });
  }

  if (payload === undefined) {
    throw new ApiError({
      status: response.status,
      url,
      message: "The BridgeEd API returned a response that is not JSON.",
      body: text,
    });
  }

  return payload as TResponse;
}

/**
 * Sends one attempt and normalises every failure into an `ApiError`, except for
 * a missing API address which stays an `ApiConfigurationError` because it is a
 * setup problem rather than a request failure.
 */
async function performRequest<TResponse>(
  method: HttpMethod,
  path: string,
  options: RequestOptions,
  accessToken: string | null,
): Promise<TResponse> {
  // Throws ApiConfigurationError before any network work when the address is
  // unknown, so the caller can render setup instructions instead of "offline".
  const url = buildUrl(path, options.query);

  const controller = new AbortController();
  const unlink = linkSignals(options.signal, controller);
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const hasBody = options.body !== undefined;

  try {
    const response = await fetch(url, {
      method,
      headers: {
        Accept: "application/json",
        ...(hasBody ? { "Content-Type": "application/json" } : null),
        // The bearer token is the only credential the API accepts; absent while
        // signed out, which the API answers with 401 for guarded routes.
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : null),
      },
      body: hasBody ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });

    return await readResponse<TResponse>(response, url);
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    if (options.signal?.aborted) {
      throw new ApiError({
        status: 0,
        url,
        message: "The request was cancelled.",
        cause: error,
      });
    }

    if (controller.signal.aborted) {
      throw new ApiError({
        status: 0,
        url,
        message: `The BridgeEd API did not respond within ${Math.round(timeoutMs / 1000)} seconds.`,
        cause: error,
      });
    }

    throw new ApiError({
      status: 0,
      url,
      message:
        "Could not reach the BridgeEd API. Check that the backend is running and that this device can reach it.",
      cause: error,
    });
  } finally {
    clearTimeout(timer);
    unlink();
  }
}

/**
 * Performs one JSON request against the BridgeEd API and returns the parsed
 * body.
 *
 * When a session is installed and a guarded route answers 401, the access token
 * is refreshed once and the request replayed with the new credential. A second
 * 401, or a refresh that returns nothing, clears the session so the route guards
 * can send the user back to sign-in.
 */
export async function request<TResponse>(
  method: HttpMethod,
  path: string,
  options: RequestOptions = {},
): Promise<TResponse> {
  const interceptor = authInterceptor;
  const accessToken = interceptor?.getAccessToken() ?? null;

  try {
    return await performRequest<TResponse>(method, path, options, accessToken);
  } catch (error) {
    const isUnauthorized = error instanceof ApiError && error.status === 401;

    if (
      !isUnauthorized ||
      interceptor === null ||
      accessToken === null ||
      !isRetryablePath(path)
    ) {
      throw error;
    }

    const refreshedToken = await interceptor.refreshAccessToken();

    if (refreshedToken === null) {
      interceptor.onAuthFailure?.();
      throw error;
    }

    return performRequest<TResponse>(method, path, options, refreshedToken);
  }
}

/**
 * Thin, typed wrapper around `fetch`, used by every feature service.
 *
 * Services own their routes, their parameters and their response types; this
 * module owns transport concerns only: base URL, JSON encoding, timeouts,
 * cancellation and error normalisation.
 */
export const apiClient = {
  get: <TResponse>(path: string, options?: RequestOptions) =>
    request<TResponse>("GET", path, options),
  post: <TResponse>(path: string, options?: RequestOptions) =>
    request<TResponse>("POST", path, options),
  patch: <TResponse>(path: string, options?: RequestOptions) =>
    request<TResponse>("PATCH", path, options),
  remove: <TResponse>(path: string, options?: RequestOptions) =>
    request<TResponse>("DELETE", path, options),
};

export { ApiConfigurationError };
