import { useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  AppText,
  Avatar,
  Button,
  Divider,
  EmptyState,
  ErrorState,
  Icon,
  InlineError,
  LoadingState,
  Screen,
  SectionHeading,
  type IconName,
} from "@/components";
import { formatCourse, formatGraduationYear, TagList } from "@/features/students";
import { useAuth } from "@/providers/AuthProvider";
import { useStudentProfileStatus } from "@/providers/StudentProfileProvider";
import { useTheme } from "@/theme";
import { toUserMessage } from "@/utils/errors";

interface FactProps {
  icon: IconName;
  label: string;
  value: string;
}

/** One recorded detail of the profile, rendered only when the API actually has it. */
function Fact({ icon, label, value }: FactProps) {
  const { layout, spacing } = useTheme();

  return (
    <View style={[styles.row, { gap: spacing.md, alignItems: "flex-start" }]}>
      <Icon name={icon} size={layout.icon.md} tone="textMuted" />
      <View style={{ flex: 1, gap: spacing.xxs }}>
        <AppText variant="overline" tone="muted">
          {label}
        </AppText>
        <AppText variant="bodyStrong">{value}</AppText>
      </View>
    </View>
  );
}

/**
 * Profile tab.
 *
 * It shows the signed-in student's own profile — name, university, course,
 * graduation, bio, skills and interests — from the one document the app already
 * holds, so there is no second read and no chance of the tab and the editor
 * disagreeing. Every section renders honestly when it is empty: a profile
 * without a bio says so rather than showing a blank space.
 *
 * Signing out lives here rather than in a settings screen because it is the one
 * account action the app currently has.
 */
export default function ProfileScreen() {
  const { colors, layout, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const { status, profile, errorMessage, refresh } = useStudentProfileStatus();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  // The provider keeps the profile it has while it re-reads, so a refresh is
  // "loading with something on screen" rather than an empty screen.
  const isRefreshing = status === "loading" && profile !== null;

  async function handleSignOut() {
    setIsSigningOut(true);
    setSignOutError(null);

    try {
      await logout();
    } catch (error) {
      setSignOutError(toUserMessage(error));
      setIsSigningOut(false);
    }
  }

  const facts = useMemo(() => {
    if (!profile) {
      return [];
    }

    const entries: {
      key: string;
      icon: IconName;
      label: string;
      value: string;
    }[] = [];

    if (profile.university) {
      entries.push({
        key: "university",
        icon: "school-outline",
        label: "University",
        value: profile.university.name,
      });
    }

    const course = formatCourse(profile);

    if (course) {
      entries.push({
        key: "course",
        icon: "book-outline",
        label: "Course",
        value: course,
      });
    }

    const graduation = formatGraduationYear(profile.graduationYear);

    if (graduation) {
      entries.push({
        key: "graduation",
        icon: "calendar-outline",
        label: "Graduation",
        value: graduation,
      });
    }

    if (profile.location) {
      entries.push({
        key: "location",
        icon: "location-outline",
        label: "Location",
        value: profile.location,
      });
    }

    return entries;
  }, [profile]);

  if (profile === null) {
    if (status === "loading") {
      return (
        <Screen>
          <LoadingState label="Loading your profile" />
        </Screen>
      );
    }

    if (status === "error") {
      return (
        <Screen>
          <ErrorState
            title="We could not load your profile"
            message={errorMessage ?? "Check your connection and try again."}
            onRetry={refresh}
          />
        </Screen>
      );
    }

    return (
      <Screen>
        <EmptyState
          icon="person-circle-outline"
          title="No profile yet"
          message="Finish onboarding to set up your student profile."
        />
      </Screen>
    );
  }

  const skillNames = profile.skills.map((skill) => skill.name);
  const interestNames = profile.interests.map((interest) => interest.name);

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: layout.screenPadding,
          paddingTop: insets.top + spacing.lg,
          paddingBottom: spacing.xxxl,
        }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
      >
        <View
          style={{
            width: "100%",
            maxWidth: layout.maxContentWidth,
            alignSelf: "center",
            gap: spacing.xxl,
          }}
        >
          {/*
            The identity is a flat block, the way a printed profile opens, rather
            than one more rounded card; the rest of the screen is sections divided
            by hairlines instead of a stack of boxes.
          */}
          <View style={{ gap: spacing.lg }}>
            <View style={{ gap: spacing.md }}>
              <Avatar
                name={profile.name}
                imageUrl={profile.profileImageUrl}
                size="xl"
              />
              <View style={{ gap: spacing.xxs }}>
                <AppText variant="title">{profile.name}</AppText>
                <AppText variant="body" tone="secondary">
                  {`@${profile.username}`}
                </AppText>
              </View>
            </View>

            {facts.length > 0 ? (
              <View style={{ gap: spacing.md }}>
                {facts.map((fact) => (
                  <Fact
                    key={fact.key}
                    icon={fact.icon}
                    label={fact.label}
                    value={fact.value}
                  />
                ))}
              </View>
            ) : null}

            <Button
              label="Edit profile"
              icon="create-outline"
              variant="secondary"
              fullWidth
              onPress={() => router.push("/profile/edit")}
            />
          </View>

          <Divider />

          <View style={{ gap: spacing.sm }}>
            <SectionHeading title="About" />
            {profile.bio ? (
              <AppText tone="secondary">{profile.bio}</AppText>
            ) : (
              <AppText variant="caption" tone="muted">
                No bio yet. Add one from Edit profile.
              </AppText>
            )}
          </View>

          <Divider />

          <View style={{ gap: spacing.md }}>
            <SectionHeading
              title="Skills"
              hint={
                skillNames.length > 0
                  ? `${skillNames.length} listed`
                  : undefined
              }
            />
            <TagList
              names={skillNames}
              emptyMessage="No skills are listed yet."
            />
          </View>

          <Divider />

          <View style={{ gap: spacing.md }}>
            <SectionHeading
              title="Interests"
              hint={
                interestNames.length > 0
                  ? `${interestNames.length} listed`
                  : undefined
              }
            />
            <TagList
              names={interestNames}
              emptyMessage="No interests are listed yet."
            />
          </View>

          <Divider />

          <View style={{ gap: spacing.md }}>
            <SectionHeading title="Account" />
            <View style={{ gap: spacing.xxs }}>
              <AppText variant="overline" tone="muted">
                Signed in as
              </AppText>
              <AppText variant="bodyStrong">
                {user?.email ?? "Not signed in"}
              </AppText>
            </View>
            {signOutError !== null ? (
              <InlineError
                message={signOutError}
                onDismiss={() => setSignOutError(null)}
              />
            ) : null}
            <Button
              label="Sign out"
              icon="log-out-outline"
              variant="secondary"
              fullWidth
              onPress={handleSignOut}
              loading={isSigningOut}
            />
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
  },
});
