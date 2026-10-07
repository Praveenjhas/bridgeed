import {
  ActivityIndicator,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { AppText } from "./AppText";
import { useTheme } from "@/theme";

export interface LoadingStateProps {
  /** What is being loaded, for example "Loading the feed". */
  label?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Centered spinner for a screen that has nothing to show yet.
 *
 * It always names what it is waiting for, so a slow request never looks like a
 * frozen app.
 */
export function LoadingState({ label = "Loading", style }: LoadingStateProps) {
  const { colors, spacing } = useTheme();

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      style={[
        {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          padding: spacing.xxxl,
          gap: spacing.md,
        },
        style,
      ]}
    >
      <ActivityIndicator size="large" color={colors.accent} />
      <AppText variant="caption" tone="muted">
        {label}
      </AppText>
    </View>
  );
}
