import { View } from "react-native";
import type { University } from "@bridgeed/shared";
import { useTheme } from "@/theme";
import type { CatalogState } from "@/features/students";
import { OptionList } from "./OptionList";
import type { OnboardingStepProps } from "./stepProps";

export interface UniversityStepProps extends OnboardingStepProps {
  /** The university catalog, with its own loading and failure states. */
  catalog: CatalogState<University>;
}

/** `Bengaluru, Karnataka, India`, or null when the record has no place on it. */
function locationOf(university: University): string | null {
  const parts = [university.city, university.state, university.country].filter(
    (part): part is string => part !== null && part.trim().length > 0,
  );

  return parts.length > 0 ? parts.join(", ") : null;
}

/**
 * The university the student attends.
 *
 * Picked from the catalog rather than typed, because a profile stores a
 * `universityId` and a name typed by hand would produce a record nothing else in
 * the app could group a student with. The step can be skipped, so a student whose
 * university is missing from the list is not blocked from finishing.
 */
export function UniversityStep({
  draft,
  onEdit,
  catalog,
}: UniversityStepProps) {
  const { spacing } = useTheme();

  return (
    <View style={{ gap: spacing.lg }}>
      <OptionList
        options={catalog.items}
        keyOf={(university) => university.id}
        labelOf={(university) => university.name}
        secondaryLabelOf={locationOf}
        searchTextOf={(university) =>
          [university.name, university.city, university.country]
            .filter((part): part is string => part !== null)
            .join(" ")
        }
        selectedKey={draft.universityId}
        onSelect={(university) => onEdit({ universityId: university.id })}
        onClear={() => onEdit({ universityId: null })}
        isLoading={catalog.status === "loading"}
        errorMessage={catalog.errorMessage}
        onRetry={catalog.refresh}
        emptyMessage="No universities are listed yet. You can skip this and add one later."
        searchPlaceholder="Search universities"
        clearLabel="Clear university"
      />
    </View>
  );
}
