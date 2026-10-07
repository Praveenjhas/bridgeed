import type { StyleProp, TextStyle } from "react-native";
import { POST_TYPE_LABELS, type PostType } from "@bridgeed/shared";
import { AppText } from "./AppText";

export interface PostTypeLabelProps {
  type: PostType;
  style?: StyleProp<TextStyle>;
}

/**
 * What a post is, said in one word.
 *
 * The type is a marker rather than a badge: sentence case at the label size, in
 * the brand colour, so a reader can tell a question from a resource while the
 * author and the content stay the loudest things on the card. Uppercase banners
 * and colour-coded boxes are deliberately avoided — hierarchy here is carried by
 * type and space, the way the rest of the editorial system carries it.
 */
export function PostTypeLabel({ type, style }: PostTypeLabelProps) {
  return (
    <AppText
      variant="label"
      tone="accent"
      style={style}
      accessibilityLabel={`Type: ${POST_TYPE_LABELS[type]}`}
    >
      {POST_TYPE_LABELS[type]}
    </AppText>
  );
}
