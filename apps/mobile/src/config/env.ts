import Constants from "expo-constants";

/**
 * Port the BridgeEd API listens on when `PORT` is not set in the backend
 * environment. Only used to derive a URL from the Expo dev server host.
 */
const DEFAULT_API_PORT = 4000;

/** Name of the environment variable that points the app at the API. */
export const API_URL_ENV_VAR = "EXPO_PUBLIC_API_URL";

/** Name of the environment variable that selects the development actor. */
export const ACTOR_ID_ENV_VAR = "EXPO_PUBLIC_ACTOR_ID";

/** Where the resolved API base URL came from. */
export type ApiBaseUrlSource = "env" | "dev-server" | "none";

export interface ApiBaseUrlResolution {
  /** Base URL without a trailing slash, or null when it cannot be determined. */
  baseUrl: string | null;
  source: ApiBaseUrlSource;
  /** Plain language explanation of the result, surfaced in development UI. */
  detail: string;
}

/**
 * Raised when a request is attempted before the app knows where the API lives.
 *
 * This is a configuration problem, not a server problem, so it is kept separate
 * from `ApiError`: the UI has to tell the developer what to fix rather than
 * suggesting they retry.
 */
export class ApiConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiConfigurationError";
  }
}

function normalizeBaseUrl(raw: string | undefined): string | null {
  if (typeof raw !== "string") {
    return null;
  }

  const trimmed = raw.trim();

  if (trimmed.length === 0) {
    return null;
  }

  // A trailing slash would produce `//api/v1` once the path prefix is added.
  return trimmed.replace(/\/+$/, "");
}

/**
 * Reads `EXPO_PUBLIC_API_URL`.
 *
 * The property is accessed literally because Expo substitutes
 * `process.env.EXPO_PUBLIC_*` at bundle time; destructuring or indexing
 * `process.env` would leave the value as undefined at runtime.
 */
function readConfiguredBaseUrl(): string | null {
  return normalizeBaseUrl(process.env.EXPO_PUBLIC_API_URL);
}

/**
 * Last resort for local development: reuse the host Metro is served from.
 *
 * A phone in Expo Go can never reach `localhost`, because that resolves to the
 * phone itself. The dev server host, however, is exactly the machine running
 * both Metro and (normally) the API, so it is the best guess available. This
 * also makes the first run work without creating a `.env` file.
 */
function readDevServerHost(): string | null {
  const hostUri = Constants.expoConfig?.hostUri;

  if (typeof hostUri !== "string" || hostUri.length === 0) {
    return null;
  }

  const host = hostUri.split(":")[0]?.trim();

  if (!host) {
    return null;
  }

  return `http://${host}:${DEFAULT_API_PORT}`;
}

/**
 * Resolves the API base URL, preferring explicit configuration and falling back
 * to the dev server host.
 */
export function resolveApiBaseUrl(): ApiBaseUrlResolution {
  const configured = readConfiguredBaseUrl();

  if (configured) {
    return {
      baseUrl: configured,
      source: "env",
      detail: `Using ${API_URL_ENV_VAR} (${configured}).`,
    };
  }

  const devServer = readDevServerHost();

  if (devServer && __DEV__) {
    return {
      baseUrl: devServer,
      source: "dev-server",
      detail: `${API_URL_ENV_VAR} is not set, so the app is calling the API on the Expo dev server host (${devServer}).`,
    };
  }

  return {
    baseUrl: null,
    source: "none",
    detail: `${API_URL_ENV_VAR} is not set and the Expo dev server host could not be detected. Copy apps/mobile/.env.example to apps/mobile/.env and set ${API_URL_ENV_VAR} to the address of the machine running the BridgeEd API.`,
  };
}

/**
 * The API base URL, or a thrown `ApiConfigurationError` explaining how to set
 * it. Callers that can render an explanation should use `resolveApiBaseUrl`
 * instead of catching this.
 */
export function getApiBaseUrl(): string {
  const { baseUrl, detail } = resolveApiBaseUrl();

  if (!baseUrl) {
    throw new ApiConfigurationError(detail);
  }

  return baseUrl;
}

/** True when the app currently runs against a development bundle. */
export function isDevelopmentBuild(): boolean {
  return __DEV__;
}
