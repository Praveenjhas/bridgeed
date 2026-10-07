import { View } from "react-native";
import type { Interest, Skill } from "@bridgeed/shared";
import { SectionHeading } from "@/components";
import { useTheme } from "@/theme";
import type { CatalogState } from "@/features/students";
import { TagPicker } from "./TagPicker";
import type { OnboardingStepProps } from "./stepProps";

export interface TagsStepProps extends OnboardingStepProps {
  skills: CatalogState<Skill>;
  interests: CatalogState<Interest>;
}

/** Adds an id when it is absent and removes it when it is present. */
function toggle(id: string, ids: string[]): string[] {
  return ids.includes(id)
    ? ids.filter((existing) => existing !== id)
    : [...ids, id];
}

/**
 * Skills and interests.
 *
 * Both lists feed the parts of the app that are not the profile: skills rank
 * posts and power matching with other students, interests place a student in
 * groups. They are asked for together because they are one question to the person
 * answering it, and both are optional so nobody is forced to tag themselves just
 * to get into the app. The tags are written after the profile is created, because
 * the API attaches them to a profile that has to exist first.
 */
export function TagsStep({ draft, onEdit, skills, interests }: TagsStepProps) {
  const { spacing } = useTheme();

  return (
    <View style={{ gap: spacing.xl }}>
      <View style={{ gap: spacing.md }}>
        <SectionHeading
          title="Skills"
          hint="What you can do — coursework, tools, languages."
        />
        <TagPicker
          options={skills.items}
          selectedIds={draft.skillIds}
          onToggle={(id) => onEdit({ skillIds: toggle(id, draft.skillIds) })}
          searchPlaceholder="Search skills"
          emptyMessage="No skills are listed yet. You can add them later from your profile."
          noun="skill"
          isLoading={skills.status === "loading"}
          errorMessage={skills.errorMessage}
          onRetry={skills.refresh}
        />
      </View>

      <View style={{ gap: spacing.md }}>
        <SectionHeading
          title="Interests"
          hint="What you follow and want to hear about."
        />
        <TagPicker
          options={interests.items}
          selectedIds={draft.interestIds}
          onToggle={(id) =>
            onEdit({ interestIds: toggle(id, draft.interestIds) })
          }
          searchPlaceholder="Search interests"
          emptyMessage="No interests are listed yet. You can add them later from your profile."
          noun="interest"
          isLoading={interests.status === "loading"}
          errorMessage={interests.errorMessage}
          onRetry={interests.refresh}
        />
      </View>
    </View>
  );
}
