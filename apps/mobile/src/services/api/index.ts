/**
 * Public surface of the API layer.
 *
 * Features import from here rather than from `./client`, so transport details
 * stay in one place.
 */
export {
  apiClient,
  request,
  ApiError,
  type ApiErrorOptions,
  type HttpMethod,
  type QueryParams,
  type QueryValue,
  type RequestOptions,
} from "./client";
export { ApiConfigurationError } from "@/config/env";
