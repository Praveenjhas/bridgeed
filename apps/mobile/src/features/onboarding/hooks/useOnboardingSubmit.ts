import { useCallback, useState } from "react";
import type { StudentProfile, StudentProfileDetails } from "@bridgeed/shared";
import {
  attachStudentInterest,
  attachStudentSkill,
  createMyStudentProfile,
  fetchMyStudentProfile,
  type CreateMyStudentProfileInput,
} from "@/features/students";
import { useStudentProfileStatus } from "@/providers/StudentProfileProvider";
import { ApiError } from "@/services/api";
import { toUserMessage } from "@/utils/errors";

/** What the flow should do with an attempt that came back. */
export type OnboardingSubmitOutcome =
  | { kind: "created" }
  /** The handle is claimed, so the flow sends the student back to name it. */
  | { kind: "handle-taken" }
  /** Anything else: the student stays on Review and can try again. */
  | { kind: "failed" };

export interface OnboardingSubmission {
  /** The profile fields, the catalog ids to attach, and the tags to write. */
  profile: CreateMyStudentProfileInput;
  skillIds: string[];
  interestIds: string[];
}

export interface OnboardingSubmitState {
  isSubmitting: boolean;
  /** Message for the last failure, which Review shows above the button. */
  errorMessage: string | null;
  submit: (
    submission: OnboardingSubmission,
  ) => Promise<OnboardingSubmitOutcome>;
  dismissError: () => void;
}

/**
 * The words the API uses for a handle that is already claimed.
 *
 * It is matched rather than guessed at from the status, because a 409 from this
 * endpoint means either "that handle is taken" or "this account already has a
 * profile", and the two need opposite handling.
 */
const HANDLE_TAKEN_MARKER = "username";

/**
 * Writes an onboarded student's profile and then its tags.
 *
 * The order matters. The profile is created first, because the tag endpoints
 * attach to a profile that must already exist; and the flow is handed the new
 * profile only once the tags are in, because publishing it earlier would flip the
 * root guard out of onboarding and show the student the profile without the
 * skills they had just picked.
 *
 * That leaves one interruption to survive: a submit that created the profile and
 * then failed while tagging. Retrying is therefore not a second create — a 409
 * is read as "the profile exists", the profile is read back, and only the tags
 * that are still missing are written, since each attach already on the server
 * answers 409 and is ignored.
 */
export function useOnboardingSubmit(): OnboardingSubmitState {
  const { applyProfile } = useStudentProfileStatus();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const dismissError = useCallback(() => {
    setErrorMessage(null);
  }, []);

  const submit = useCallback(
    async ({
      profile: input,
      skillIds,
      interestIds,
    }: OnboardingSubmission): Promise<OnboardingSubmitOutcome> => {
      setIsSubmitting(true);
      setErrorMessage(null);

      try {
        const profile = await readOrCreateProfile(input);

        await attachTags(profile, skillIds, interestIds);

        applyProfile(await readProfileDetails(profile));

        return { kind: "created" };
      } catch (error) {
        if (
          error instanceof ApiError &&
          error.status === 409 &&
          isHandleTaken(error)
        ) {
          // A taken handle is a field problem, not a screen problem: the flow
          // moves the student back to the handle they have to change.
          return { kind: "handle-taken" };
        }

        setErrorMessage(toUserMessage(error));

        return { kind: "failed" };
      } finally {
        setIsSubmitting(false);
      }
    },
    [applyProfile],
  );

  return { isSubmitting, errorMessage, submit, dismissError };
}

/** Shown on the handle field when the API has already given it away. */
export const HANDLE_TAKEN_MESSAGE =
  "That handle is already taken. Pick another one.";

/** True when a 409 is the API saying the handle belongs to somebody else. */
function isHandleTaken(error: ApiError): boolean {
  return error.message.toLowerCase().includes(HANDLE_TAKEN_MARKER);
}

/**
 * Creates the profile, or reads back the one an earlier attempt created.
 *
 * The second case is the recovery described on the hook: a 409 that is not about
 * the handle means this account already has a profile, so the profile is read and
 * the submit carries on with the tags it still owes.
 */
async function readOrCreateProfile(
  input: CreateMyStudentProfileInput,
): Promise<StudentProfile> {
  try {
    return await createMyStudentProfile({ input });
  } catch (error) {
    if (
      error instanceof ApiError &&
      error.status === 409 &&
      !isHandleTaken(error)
    ) {
      const existing = await fetchMyStudentProfile();

      if (existing !== null) {
        return existing;
      }
    }

    throw error;
  }
}

/** Writes every chosen skill and interest, in parallel, ignoring duplicates. */
async function attachTags(
  profile: StudentProfile,
  skillIds: string[],
  interestIds: string[],
): Promise<void> {
  await Promise.all([
    ...skillIds.map((skillId) =>
      attachIgnoringDuplicate(() =>
        attachStudentSkill({ userId: profile.userId, skillId }),
      ),
    ),
    ...interestIds.map((interestId) =>
      attachIgnoringDuplicate(() =>
        attachStudentInterest({ userId: profile.userId, interestId }),
      ),
    ),
  ]);
}

/**
 * Attaches one tag, treating 409 as success.
 *
 * "Already attached" is the answer a repeated attach gets, and a repeated attach
 * is exactly what a retry after an interruption produces. Every other failure is
 * real and has to reach the student, because a profile that silently lost the
 * skills they picked is worse than one that says it could not save them.
 */
async function attachIgnoringDuplicate(
  attach: () => Promise<unknown>,
): Promise<void> {
  try {
    await attach();
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 409) {
      throw error;
    }
  }
}

/**
 * Publishes the finished profile to the rest of the app.
 *
 * The created profile on its own carries no university or tags, and the tags
 * were written one call after the create, so the whole document is read back.
 * If that read fails the student still enters the app — the profile exists — and
 * the profile screen can refresh it, which is better than leaving them on Review
 * after a save that actually worked.
 */
async function readProfileDetails(
  created: StudentProfile,
): Promise<StudentProfileDetails> {
  try {
    const details = await fetchMyStudentProfile();

    if (details !== null) {
      return details;
    }
  } catch {
    // Fall through to the minimal document below.
  }

  return { ...created, university: null, skills: [], interests: [] };
}
