import { memo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import type { StudentProfile } from "@bridgeed/shared";
import { AppText, Badge, Button, Card } from "@/components";
import {
  formatStudentHint,
  StudentIdentity,
  useUniversity,
} from "@/features/students";
import { useTheme } from "@/theme";
import { relationshipLabel, relationshipTone } from "../labels";
import { RELATIONSHIP_STATES } from "../relationships";

export interface ConnectionRequestCardProps {
  /** Id of the pending request row, which is what the API decisions act on. */
  connectionId: string;
  /** The student who sent the request. */
  studentId: string;
  /** Their profile, or null when it could not be read. */
  profile: StudentProfile | null;
  /** Opens the sender's profile so the request can be judged in context. */
  onPress: (studentId: string) => void;
  onAccept: (connectionId: string) => Promise<boolean>;
  onDecline: (connectionId: string) => Promise<boolean>;
  /** True while this request is being decided, so the row disables itself. */
  isPending: boolean;
}

/**
 * One incoming connection request.
 *
 * Accept and decline are children of the card rather than the card itself, so a
 * stray tap opens the sender's profile instead of answering for the reader. Only
 * the pressed button shows progress, and both are locked while the decision is
 * in flight, which is what keeps one request from being answered twice.
 */
export const ConnectionRequestCard = memo(function ConnectionRequestCard({
  connectionId,
  studentId,
  profile,
  onPress,
  onAccept,
  onDecline,
  isPending,
}: ConnectionRequestCardProps) {
  const { spacing } = useTheme();
  const university = useUniversity(profile?.universityId ?? null);
  const [decision, setDecision] = useState<"accept" | "decline" | null>(null);
  const isBusy = isPending || decision !== null;

  const decide = (next: "accept" | "decline") => {
    if (isBusy) {
      return;
    }

    setDecision(next);
    const request =
      next === "accept" ? onAccept(connectionId) : onDecline(connectionId);

    void request.finally(() => setDecision(null));
  };

  return (
    <Card>
      <View style={{ gap: spacing.md }}>
        {profile ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${profile.name}, @${profile.username}, wants to connect`}
            accessibilityHint="Opens this student's profile"
            onPress={() => onPress(studentId)}
          >
            <StudentIdentity
              name={profile.name}
              username={profile.username}
              imageUrl={profile.profileImageUrl}
              meta={university?.name ?? formatStudentHint(profile)}
              trailing={
                <Badge
                  label={relationshipLabel(
                    RELATIONSHIP_STATES.PENDING_INCOMING,
                  )}
                  tone={relationshipTone(RELATIONSHIP_STATES.PENDING_INCOMING)}
                />
              }
            />
          </Pressable>
        ) : (
          <View style={{ gap: spacing.xxs }}>
            <AppText variant="subheading">Connection request</AppText>
            <AppText variant="caption" tone="muted">
              This student&apos;s profile could not be read, but the request can
              still be answered.
            </AppText>
          </View>
        )}

        <View style={[styles.actions, { gap: spacing.sm }]}>
          <Button
            label="Accept"
            size="sm"
            icon="checkmark"
            loading={decision === "accept" || (isPending && decision === null)}
            disabled={isBusy}
            onPress={() => decide("accept")}
          />
          <Button
            label="Decline"
            size="sm"
            variant="secondary"
            loading={decision === "decline"}
            disabled={isBusy}
            onPress={() => decide("decline")}
          />
        </View>
      </View>
    </Card>
  );
});

const styles = StyleSheet.create({
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
});
