import type { StyleProp, ViewStyle } from "react-native";
import { Button } from "./Button";
import { EmptyState } from "./EmptyState";

export interface ErrorStateProps {
  /** Message from the API or from the transport layer. */
  message: string;
  title?: string;
  /** Adds a retry button when the failure can be retried by hand. */
  onRetry?: () => void;
  retryLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * A failure that left the screen with nothing to show.
 *
 * The message is the one produced by `toUserMessage`, so it is already written
 * for a person: either the API's own wording or a sentence about connectivity.
 */
export function ErrorState({
  message,
  title = "We could not load this",
  onRetry,
  retryLabel = "Try again",
  style,
}: ErrorStateProps) {
  return (
    <EmptyState
      tone="danger"
      icon="cloud-offline-outline"
      title={title}
      message={message}
      style={style}
      action={
        onRetry ? (
          <Button label={retryLabel} onPress={onRetry} icon="refresh" />
        ) : null
      }
    />
  );
}
