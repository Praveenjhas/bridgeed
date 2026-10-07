import { Stack } from "expo-router";
import { useTheme } from "@/theme";

/**
 * First screen of the group, used as the anchor: signing out lands back here.
 *
 * Because the group only exists while nobody is signed in, the anchor can never
 * point at a screen the guard has removed.
 */
export const unstable_settings = {
  anchor: "login",
};

/**
 * Layout for the signed-out area.
 *
 * A stack is used so sign-in and sign-up can push and pop with the platform
 * gesture, even though the group is currently only two screens tall. The header
 * is hidden because each screen draws its own title.
 */
export default function AuthLayout() {
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
