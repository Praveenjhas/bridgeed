import { View } from "react-native";
import { TextField } from "@/components";
import { useTheme } from "@/theme";
import {
  BIO_MAX_LENGTH,
  NAME_MAX_LENGTH,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
} from "../draft";
import type { OnboardingStepProps } from "./stepProps";

/**
 * Name, handle and bio.
 *
 * The only step with a required field, and both of them are required because
 * everything else in the app refers to a student by one of them: the name on a
 * post, the handle on their profile. The bio is optional and says so, because a
 * line that is asked for under a rule reads as a demand.
 */
export function BasicsStep({
  draft,
  issues,
  onEdit,
  isBusy,
}: OnboardingStepProps) {
  const { spacing } = useTheme();
  const bioLength = draft.bio.trim().length;

  return (
    <View style={{ gap: spacing.lg }}>
      <TextField
        label="Name"
        icon="person-outline"
        value={draft.name}
        onChangeText={(name) => onEdit({ name })}
        placeholder="Asha Menon"
        error={issues.name}
        hint="This is what other students see on your posts and comments."
        autoCapitalize="words"
        autoComplete="name"
        textContentType="name"
        maxLength={NAME_MAX_LENGTH}
        returnKeyType="next"
        editable={!isBusy}
      />

      <TextField
        label="Handle"
        icon="at-outline"
        value={draft.username}
        onChangeText={(username) => onEdit({ username })}
        placeholder="asha.menon"
        error={issues.username}
        hint={`Unique to you, at least ${USERNAME_MIN_LENGTH} characters, no spaces.`}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="off"
        maxLength={USERNAME_MAX_LENGTH}
        returnKeyType="next"
        editable={!isBusy}
      />

      <TextField
        label="Bio"
        icon="chatbubble-ellipses-outline"
        value={draft.bio}
        onChangeText={(bio) => onEdit({ bio })}
        placeholder="Second year CS student, into systems and badminton."
        error={issues.bio}
        hint={`Optional · ${bioLength}/${BIO_MAX_LENGTH}`}
        maxLength={BIO_MAX_LENGTH}
        multiline
        numberOfLines={3}
        textAlignVertical="top"
        editable={!isBusy}
      />
    </View>
  );
}
