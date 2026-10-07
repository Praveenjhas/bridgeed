import { Stack } from "expo-router";
import { useTheme } from "@/theme";

/**
 * First screen of the group, used as the anchor: signing out, or a session that
 * expires mid-flow, lands back here.
 */
export const unstable_settings = {
  anchor: "onboarding",
};

/**
 * Layout for the onboarding area.
 *
 * It is a stack even though the flow is one screen, so that the group has the
 * same shape as the others and a later step that genuinely needs its own route
 * can be added without moving anything. The flow itself keeps its steps inside
 * one screen because they share one draft: a route per step would either lose
 * the draft on a back gesture or force it into a store the rest of the app would
 * then have to know about.
 *
 * The header is hidden because the screen draws its own, and because the flow
 * has to be read in order — a title bar with a back arrow would invite a student
 * to walk backwards out of a form they cannot leave yet anyway.
 */
export default function OnboardingLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
