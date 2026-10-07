import { useCallback, useState } from "react";
import type { StudentProfileDetails } from "@bridgeed/shared";
import {
  replaceMyStudentInterests,
  replaceMyStudentSkills,
  updateMyStudentProfile,
} from "@/features/students";
import { useStudentProfileStatus } from "@/providers/StudentProfileProvider";
import { toUserMessage } from "@/utils/errors";
import {
  ISSUE_FIELDS,
  draftFromProfile,
  toProfileUpdateInput,
  validateProfileDraft,
  type ProfileDraft,
  type ProfileFormIssues,
} from "../draft";

/** What the screen should do with a submit that came back. */
export type ProfileSaveResult = "saved" | "invalid" | "failed";

export interface EditProfileFormState {
  draft: ProfileDraft;
  issues: ProfileFormIssues;
  isSaving: boolean;
  errorMessage: string | null;
  /** Merges a change into the draft and clears the message it answers. */
  edit: (patch: Partial<ProfileDraft>) => void;
  /** Validates, saves, and publishes the result. */
  submit: () => Promise<ProfileSaveResult>;
  dismissError: () => void;
}

/**
 * Drives the Edit Profile screen.
 *
 * The profile fields and the two tag lists are saved together: the update runs
 * first because it returns the refreshed profile, then the skills and interests
 * are replaced. Their responses carry the new sets, which are merged into the
 * published profile so the Profile tab shows the change without another read. A
 * failure anywhere leaves the student on the form with the API's own message.
 * The owner is never part of any request — the API takes it from the bearer
 * token, so a stale `userId` in the app cannot point a save at somebody else.
 */
export function useEditProfileForm(
  profile: StudentProfileDetails,
): EditProfileFormState {
  const { applyProfile } = useStudentProfileStatus();
  const [draft, setDraft] = useState<ProfileDraft>(() =>
    draftFromProfile(profile),
  );
  const [issues, setIssues] = useState<ProfileFormIssues>({});
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const edit = useCallback((patch: Partial<ProfileDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));

    setIssues((current) => {
      const next: ProfileFormIssues = { ...current };

      for (const field of ISSUE_FIELDS) {
        if (field in patch) {
          next[field] = undefined;
        }
      }

      return next;
    });
  }, []);

  const dismissError = useCallback(() => {
    setErrorMessage(null);
  }, []);

  const submit = useCallback(async (): Promise<ProfileSaveResult> => {
    const currentIssues = validateProfileDraft(draft);

    if (Object.keys(currentIssues).length > 0) {
      setIssues(currentIssues);
      return "invalid";
    }

    setIssues({});
    setIsSaving(true);
    setErrorMessage(null);

    try {
      const updated = await updateMyStudentProfile({
        input: toProfileUpdateInput(draft),
      });

      const [skills, interests] = await Promise.all([
        replaceMyStudentSkills({ skillIds: draft.skillIds }),
        replaceMyStudentInterests({ interestIds: draft.interestIds }),
      ]);

      applyProfile({ ...updated, skills, interests });

      return "saved";
    } catch (error) {
      setErrorMessage(toUserMessage(error));

      return "failed";
    } finally {
      setIsSaving(false);
    }
  }, [applyProfile, draft]);

  return { draft, issues, isSaving, errorMessage, edit, submit, dismissError };
}
