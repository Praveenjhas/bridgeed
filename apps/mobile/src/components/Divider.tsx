import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useTheme, type SpacingToken } from "@/theme";

export interface DividerProps {
  /** Vertical space around the line, taken from the spacing scale. */
  spacing?: SpacingToken;
  style?: StyleProp<ViewStyle>;
}

/** Hairline separator used between rows and around sections. */
export function Divider({ spacing = "none", style }: DividerProps) {
  const { colors, spacing: spacingScale } = useTheme();

  return (
    <View
      style={[
        styles.line,
        {
          backgroundColor: colors.border,
          marginVertical: spacingScale[spacing],
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  line: {
    height: StyleSheet.hairlineWidth,
    width: "100%",
  },
});
