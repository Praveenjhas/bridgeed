import { ApiConfigurationError } from "@/config/env";
import { ApiError } from "@/services/api/client";

const FALLBACK_MESSAGE = "Something went wrong. Please try again.";

/**
 * Turns anything that was thrown into one sentence that can be shown to a user.
 *
 * API errors already carry a server authored message, which is more useful than
 * anything the client could invent (for example "You are not a member of this
 * community"). Unexpected errors are only revealed in development, because a
 * stack trace or a JavaScript error has no place in front of a student.
 */
export function toUserMessage(error: unknown): string {
  if (error instanceof ApiConfigurationError || error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return __DEV__ && error.message.length > 0
      ? error.message
      : FALLBACK_MESSAGE;
  }

  return FALLBACK_MESSAGE;
}

/**
 * True when the failure is worth retrying by hand.
 *
 * Cancellations and 4xx answers are decisions, not accidents: retrying them
 * would fail again for the same reason, so the UI hides its retry affordance.
 */
export function isRetryable(error: unknown): boolean {
  if (error instanceof ApiError) {
    return error.isNetworkError || error.status >= 500;
  }

  return !(error instanceof ApiConfigurationError);
}

/** True when the value is an abort, which every hook treats as "ignore me". */
export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}
