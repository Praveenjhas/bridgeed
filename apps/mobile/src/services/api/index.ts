/**
 * Public surface of the API layer.
 *
 * Features import from here rather than from `./client`, so transport details
 * stay in one place.
 */
export {
  apiClient,
  request,
  setAuthInterceptor,
  ApiError,
  type ApiErrorOptions,
  type AuthInterceptor,
  type HttpMethod,
  type QueryParams,
  type QueryValue,
  type RequestOptions,
} from "./client";
export { ApiConfigurationError } from "@/config/env";
