import { ActivityIndicator, Alert, StyleSheet, View } from "react-native";
import { AppText, Badge, Button, InlineError } from "@/components";
import { useTheme } from "@/theme";
import {
  describeRelationship,
  relationshipLabel,
  relationshipTone,
} from "../labels";
import {
  canBlockRelationship,
  RELATIONSHIP_STATES,
  type RelationshipState,
} from "../relationships";

export interface ConnectionActionsProps {
  /** Where the reader stands with the student, derived from the API's row. */
  state: RelationshipState;
  /** True while the relationship of the reader is still being read. */
  isChecking: boolean;
  /** Explains a failed relationship read, which blocks every action. */
  readErrorMessage?: string | null;
  onRetryRead?: () => void;
  /** True while an action on this relationship is in flight. */
  isActionPending: boolean;
  actionErrorMessage: string | null;
  onDismissActionError: () => void;
  onConnect: () => void;
  onAccept: () => void;
  onDecline: () => void;
  onCancelRequest: () => void;
  onRemoveConnection: () => void;
  onBlock: () => void;
}

/**
 * The connection block of a student profile: where the reader stands, and the
 * actions that can change it.
 *
 * The controls follow the backend's own rules rather than the screen's optimism.
 * A connect button is never offered for a request already pending or a connection
 * already accepted, the API's participants-only and recipient-only rules are
 * respected by only rendering the action the reader can actually perform, and a
 * blocked relationship offers nothing at all because no request can cross it.
 *
 * Every destructive action asks first. Remove, block, decline and withdraw all
 * end something, so none of them is wired straight to a button.
 */
export function ConnectionActions({
  state,
  isChecking,
  readErrorMessage = null,
  onRetryRead,
  isActionPending,
  actionErrorMessage,
  onDismissActionError,
  onConnect,
  onAccept,
  onDecline,
  onCancelRequest,
  onRemoveConnection,
  onBlock,
}: ConnectionActionsProps) {
  const { colors, spacing } = useTheme();

  const confirmRemove = () => {
    Alert.alert(
      "Remove connection?",
      "You will have to send a new request to reconnect.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: onRemoveConnection },
      ],
    );
  };

  const confirmBlock = () => {
    Alert.alert(
      "Block this person?",
      "This connection is closed, and neither of you will be able to send a new request.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Block", style: "destructive", onPress: onBlock },
      ],
    );
  };

  const confirmDecline = () => {
    Alert.alert(
      "Decline request?",
      "They will not be added to your connections. They can send another request later.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Decline", style: "destructive", onPress: onDecline },
      ],
    );
  };

  const confirmWithdraw = () => {
    Alert.alert(
      "Withdraw request?",
      "Your connection request will be removed.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Withdraw",
          style: "destructive",
          onPress: onCancelRequest,
        },
      ],
    );
  };

  if (isChecking) {
    return (
      <View style={[styles.row, { gap: spacing.sm }]}>
        <ActivityIndicator size="small" color={colors.textMuted} />
        <AppText variant="caption" tone="muted">
          Checking where you stand
        </AppText>
      </View>
    );
  }

  if (readErrorMessage) {
    return (
      <View style={{ gap: spacing.sm }}>
        <InlineError
          message={readErrorMessage}
          onRetry={onRetryRead}
          retryLabel="Check again"
        />
        <AppText variant="caption" tone="muted">
          Connection actions stay hidden until the app knows where you stand.
        </AppText>
      </View>
    );
  }

  if (state === RELATIONSHIP_STATES.SELF) {
    return (
      <AppText variant="caption" tone="muted">
        {describeRelationship(state)}
      </AppText>
    );
  }

  const canBlock = canBlockRelationship(state);

  return (
    <View style={{ gap: spacing.md }}>
      <Badge label={relationshipLabel(state)} tone={relationshipTone(state)} />
      <AppText variant="caption" tone="muted">
        {describeRelationship(state)}
      </AppText>

      {actionErrorMessage ? (
        <InlineError
          message={actionErrorMessage}
          onDismiss={onDismissActionError}
        />
      ) : null}

      <View style={[styles.actions, { gap: spacing.sm }]}>
        {state === RELATIONSHIP_STATES.NOT_CONNECTED ? (
          <Button
            label="Connect"
            icon="person-add-outline"
            accessibilityLabel="Send connection request"
            loading={isActionPending}
            onPress={onConnect}
          />
        ) : null}

        {state === RELATIONSHIP_STATES.PENDING_INCOMING ? (
          <>
            <Button
              label="Accept"
              icon="checkmark"
              accessibilityLabel="Accept connection request"
              loading={isActionPending}
              onPress={onAccept}
            />
            <Button
              label="Decline"
              variant="destructive"
              accessibilityLabel="Decline connection request"
              disabled={isActionPending}
              onPress={confirmDecline}
            />
          </>
        ) : null}

        {state === RELATIONSHIP_STATES.PENDING_OUTGOING ? (
          <Button
            label="Withdraw request"
            variant="secondary"
            accessibilityLabel="Withdraw connection request"
            loading={isActionPending}
            onPress={confirmWithdraw}
          />
        ) : null}

        {state === RELATIONSHIP_STATES.ACCEPTED ? (
          <Button
            label="Remove connection"
            variant="destructive"
            icon="trash-outline"
            accessibilityLabel="Remove connection"
            loading={isActionPending}
            onPress={confirmRemove}
          />
        ) : null}

        {canBlock ? (
          <Button
            label="Block"
            variant="destructive"
            icon="ban-outline"
            accessibilityLabel="Block user"
            disabled={isActionPending}
            onPress={confirmBlock}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
});
