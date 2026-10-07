import { View, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "@/theme";

/** Name of the product, spelled once so the lockup is the only place it lives. */
export const PRODUCT_NAME = "BridgeEd";

export type BrandMarkSize = "sm" | "md" | "lg";

/**
 * `tile` draws the mark on a filled brand tile (the default, for light
 * surfaces); `plain` draws it with no tile, for placement on a brand or dark
 * surface where a tile would disappear.
 */
export type BrandMarkVariant = "tile" | "plain";

export interface BrandMarkProps {
  size?: BrandMarkSize;
  variant?: BrandMarkVariant;
  style?: StyleProp<ViewStyle>;
}

/** Edge length of the mark's square, per size. */
const TILE: Record<BrandMarkSize, number> = { sm: 28, md: 38, lg: 56 };

/**
 * The BridgeEd brand mark: a single arch — a bridge — spanning two nodes, the
 * two students it connects.
 *
 * It is deliberately geometric and drawn from plain views rather than an image
 * or an icon glyph, so it renders identically on every device, stays crisp at
 * 28px, and shares the palette with the rest of the interface. The arch is the
 * bridge the product is named for; the two dots are the people it carries, which
 * is why the mark is a connection rather than an initial or a building.
 *
 * It is used sparingly — on the auth and entry surfaces, and on the occasional
 * empty state — never as decoration on every screen.
 */
export function BrandMark({
  size = "md",
  variant = "tile",
  style,
}: BrandMarkProps) {
  const { colors } = useTheme();
  const tile = TILE[size];
  const isTile = variant === "tile";

  // Geometry is expressed as fractions of the tile so every size is the same
  // mark, only scaled.
  const archWidth = tile * 0.62;
  const archHeight = archWidth / 2;
  const stroke = Math.max(1.5, tile * 0.09);
  const node = tile * 0.17;
  const archLeft = (tile - archWidth) / 2;
  const archTop = tile * 0.26;
  const footY = archTop + archHeight;

  const archColor = isTile ? colors.onAccent : colors.accent;
  const nodeColor = isTile ? colors.goldSoft : colors.gold;

  const mark = (
    <View
      style={{
        width: tile,
        height: tile,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/*
        The arch is the top half of a ring: a full circle of the arch's width,
        clipped to its upper half by the wrapper's `overflow: hidden`.
      */}
      <View
        style={{
          position: "absolute",
          left: archLeft,
          top: archTop,
          width: archWidth,
          height: archHeight,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            width: archWidth,
            height: archWidth,
            borderRadius: archWidth / 2,
            borderWidth: stroke,
            borderColor: archColor,
          }}
        />
      </View>

      {/* A student at each foot of the bridge. */}
      <View
        style={{
          position: "absolute",
          left: archLeft - node / 2,
          top: footY - node / 2,
          width: node,
          height: node,
          borderRadius: node / 2,
          backgroundColor: nodeColor,
        }}
      />
      <View
        style={{
          position: "absolute",
          left: archLeft + archWidth - node / 2,
          top: footY - node / 2,
          width: node,
          height: node,
          borderRadius: node / 2,
          backgroundColor: nodeColor,
        }}
      />
    </View>
  );

  if (!isTile) {
    return (
      <View accessible accessibilityLabel={PRODUCT_NAME} style={style}>
        {mark}
      </View>
    );
  }

  return (
    <View
      accessible
      accessibilityLabel={PRODUCT_NAME}
      style={[
        {
          width: tile,
          height: tile,
          borderRadius: tile * 0.3,
          backgroundColor: colors.accent,
          alignItems: "center",
          justifyContent: "center",
        },
        style,
      ]}
    >
      {mark}
    </View>
  );
}
