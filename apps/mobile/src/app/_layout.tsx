import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AppProviders } from "@/providers/AppProviders";
import { useTheme } from "@/theme";

/**
 * Root layout.
 *
 * It composes the providers every screen depends on and declares the pushed areas
 * of the app: the tab shell, a community (with its member list), a post and a
 * student profile.
 *
 * Screens inside `(tabs)` draw their own header (so they can carry a subtitle
 * and trailing actions), while every pushed screen keeps the native stack header
 * so the platform back gesture and button come for free.
 */
export default function RootLayout() {
  const { colors } = useTheme();

  /** Options shared by every pushed detail screen. */
  const detailScreenOptions = {
    headerShown: true,
    headerTintColor: colors.accent,
    headerStyle: { backgroundColor: colors.surface },
    headerShadowVisible: false,
    headerBackButtonDisplayMode: "minimal" as const,
  };

  return (
    <AppProviders>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
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
      </Stack>
    </AppProviders>
  );
}
