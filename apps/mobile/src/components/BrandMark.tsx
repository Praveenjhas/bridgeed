import { View, type StyleProp, type ViewStyle } from "react-native";
import { AppText } from "./AppText";
import { useTheme } from "@/theme";

/** Name of the product, spelled once so the lockup is the only place it lives. */
const PRODUCT_NAME = "BridgeEd";

/** The letter that stands in for the product inside the mark itself. */
const MONOGRAM = "B";

export type BrandMarkSize = "sm" | "md";

export interface BrandMarkProps {
  /** Size of the mark. The wordmark follows it. */
  size?: BrandMarkSize;
  style?: StyleProp<ViewStyle>;
}

/** Tile edge and the type it carries, per size. */
const MARK: Record<
  BrandMarkSize,
  { tile: number; fontSize: number; lineHeight: number }
> = {
  sm: { tile: 32, fontSize: 15, lineHeight: 19 },
  md: { tile: 44, fontSize: 20, lineHeight: 25 },
};

/**
 * The BridgeEd lockup: a monogram tile beside the product name.
 *
 * The product needs one consistent way to introduce itself, and the app
 * previously had none — each screen that mentioned the brand set its own text.
 * Putting it in one component means the sign-in screen, the feed header and any
 * future splash all say the same thing in the same voice.
 *
 * It is deliberately typographic: a tinted tile and the wordmark, no illustration
 * and no image asset, so it renders identically on every device and stays in
 * step with `colors.accent`, which is also the colour of every primary action.
 * That shared colour is what ties the brand to the interaction.
 */
export function BrandMark({ size = "md", style }: BrandMarkProps) {
  const { colors, radius, spacing } = useTheme();
  const mark = MARK[size];

  return (
    <View
      accessible
      accessibilityLabel={PRODUCT_NAME}
      style={[
        { flexDirection: "row", alignItems: "center", gap: spacing.sm },
        style,
      ]}
    >
      <View
        style={{
          width: mark.tile,
          height: mark.tile,
          borderRadius: radius.md,
          backgroundColor: colors.accent,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <AppText
          tone="onAccent"
          style={{
            fontSize: mark.fontSize,
            lineHeight: mark.lineHeight,
            fontWeight: "700",
            letterSpacing: -0.4,
          }}
        >
          {MONOGRAM}
        </AppText>
      </View>
      <AppText
        variant={size === "sm" ? "subheading" : "heading"}
        style={{ letterSpacing: -0.2 }}
      >
        {PRODUCT_NAME}
      </AppText>
    </View>
  );
}
