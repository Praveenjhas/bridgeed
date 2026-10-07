import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ErrorState, LoadingState, Screen } from "@/components";
import { logAuthEvent } from "@/features/auth/dev-log";
import { AppProviders } from "@/providers/AppProviders";
import { useAuth } from "@/providers/AuthProvider";
import { useStudentProfileStatus } from "@/providers/StudentProfileProvider";
import { useTheme } from "@/theme";

/**
 * Route the stack returns to when a screen it was showing stops being available,
 * which is what happens the moment a session is retired.
 *
 * The tabs are the home of a signed-in student, so they are the anchor; the
 * navigator falls back to the first available screen when the anchor itself is
 * guarded off.
 */
export const unstable_settings = {
  anchor: "(tabs)",
};

/**
 * Root layout.
 *
 * It composes the providers every screen depends on and declares the pushed areas
 * of the app: the tab shell, a community (with its member list), a post and a
 * student profile.
 *
 * The three groups are guarded by the session and by the profile it owns. A
 * signed-in account that has no student profile yet cannot reach the tabs, and an
 * account that has one cannot reach onboarding — the guard is what makes that
 * true, not a redirect. `Stack.Protected` means the screens in a group do not
 * exist while its guard is false, so the unwanted route is never in the tree.
 */
export default function RootLayout() {
  return (
    <AppProviders>
      <StatusBar style="dark" />
      <RootNavigator />
    </AppProviders>
  );
}

function RootNavigator() {
  const { colors } = useTheme();
  const { isAuthenticated, isRestoring } = useAuth();
  const {
    status: profileStatus,
    profile,
    errorMessage: profileError,
    refresh: refreshProfile,
  } = useStudentProfileStatus();

  // The three states the guards below can be in. They are exhaustive on purpose:
  // a signed-in account has a profile, needs one, or is being asked about — and
  // while it is being asked neither group exists, which is why that wait is shown
  // here rather than by a screen.
  const isProfilePending =
    isAuthenticated && profileStatus === "loading" && profile === null;
  const needsOnboarding = isAuthenticated && profileStatus === "missing";
  const isOnboarded = isAuthenticated && profile !== null;

  // Development-only echo of the values the `Stack.Protected` guards below are
  // reading, so "signed in but still on the auth screen" can be told apart from
  // "never signed in at all".
  useEffect(() => {
    logAuthEvent("ROUTER_GUARD_UPDATED", {
      isAuthenticated,
      isRestoring,
      profileStatus,
    });
  }, [isAuthenticated, isRestoring, profileStatus]);

  // The session is read from secure storage and confirmed against `/auth/me`
  // before a single route is created. Waiting here is what stops a returning user
  // from seeing the sign-in form for a frame, so no redirect or splash plugin is
  // needed to hide it.
  if (isRestoring) {
    return (
      <Screen>
        <LoadingState label="Restoring your session" />
      </Screen>
    );
  }

  // The same reasoning one step later: until the profile has been read there is
  // no honest answer to whether this account belongs in the tabs or in
  // onboarding, and guessing would flash the wrong screen at a student who has
  // just signed in.
  if (isProfilePending) {
    return (
      <Screen>
        <LoadingState label="Checking your student profile" />
      </Screen>
    );
  }

  // A profile that could not be read is not an empty account. Sending the student
  // into onboarding would attempt a second profile for someone who already has
  // one, so the failure is shown with a retry instead.
  if (isAuthenticated && profileStatus === "error") {
    return (
      <Screen>
        <ErrorState
          title="We could not check your profile"
          message={profileError ?? "Check your connection and try again."}
          onRetry={refreshProfile}
        />
      </Screen>
    );
  }

  /** Options shared by every pushed detail screen. */
  const detailScreenOptions = {
    headerShown: true,
    headerTintColor: colors.accent,
    headerStyle: { backgroundColor: colors.surface },
    headerShadowVisible: false,
    headerBackButtonDisplayMode: "minimal" as const,
  };

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Protected guard={isOnboarded}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="community/[communityId]"
          options={{ ...detailScreenOptions, title: "Community" }}
        />
        <Stack.Screen
          name="community/[communityId]/members"
          options={{ ...detailScreenOptions, title: "Members" }}
        />
        <Stack.Screen
          name="post/[postId]"
          options={{ ...detailScreenOptions, title: "Post" }}
        />
        <Stack.Screen
          name="student/[studentId]"
          options={{ ...detailScreenOptions, title: "Student" }}
        />
        <Stack.Screen
          name="profile/edit"
          options={{ ...detailScreenOptions, title: "Edit profile" }}
        />
        <Stack.Screen
          name="create-post"
          options={{ ...detailScreenOptions, title: "Create post" }}
        />
      </Stack.Protected>

      {/*
        Onboarding is its own area rather than a screen inside the auth group: it
        is reached while signed in, and it has to disappear the moment the profile
        exists. Being a guard means the transition out of it is the same mechanism
        as the transition into it, so there is no navigation to get wrong.
      */}
      <Stack.Protected guard={needsOnboarding}>
        <Stack.Screen name="(onboarding)" options={{ headerShown: false }} />
      </Stack.Protected>

      <Stack.Protected guard={!isAuthenticated}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}
