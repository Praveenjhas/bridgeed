import { View, type StyleProp, type ViewStyle } from "react-native";
import { AppText } from "./AppText";
import {
  BrandMark,
  PRODUCT_NAME,
  type BrandMarkSize,
  type BrandMarkVariant,
} from "./BrandMark";
import { useTheme } from "@/theme";

export interface BrandWordmarkProps {
  size?: BrandMarkSize;
  variant?: BrandMarkVariant;
  /** Text colour. `onAccent` for a brand or dark surface. */
  tone?: "primary" | "onAccent";
  style?: StyleProp<ViewStyle>;
}

/** Type step the wordmark text uses at each size. */
const WORDMARK_VARIANT = {
  sm: "subheading",
  md: "heading",
  lg: "title",
} as const;

/**
 * The BridgeEd lockup: the brand mark beside the product name.
 *
 * One component so the sign-in screen, onboarding and any future splash
 * introduce the product the same way. The mark carries the identity; the name is
 * set in the heading face with slightly tightened tracking so the lockup reads as
 * one drawn unit rather than a logo plus a caption.
 */
export function BrandWordmark({
  size = "md",
  variant = "tile",
  tone = "primary",
  style,
}: BrandWordmarkProps) {
  const { colors, spacing } = useTheme();

  return (
    <View
      accessible
      accessibilityLabel={PRODUCT_NAME}
      style={[
        { flexDirection: "row", alignItems: "center", gap: spacing.sm },
        style,
      ]}
    >
      <BrandMark size={size} variant={variant} />
      <AppText
        variant={WORDMARK_VARIANT[size]}
        style={{
          letterSpacing: -0.4,
          color: tone === "onAccent" ? colors.onAccent : colors.textPrimary,
        }}
      >
        {PRODUCT_NAME}
      </AppText>
    </View>
  );
}
