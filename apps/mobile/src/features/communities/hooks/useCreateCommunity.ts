import { useCallback, useState } from "react";
import {
  COMMUNITY_TYPES,
  type Community,
  type CommunityType,
} from "@bridgeed/shared";
import { toUserMessage } from "@/utils/errors";
import {
  MAX_COMMUNITY_DESCRIPTION_LENGTH,
  MAX_COMMUNITY_NAME_LENGTH,
  MAX_COMMUNITY_SLUG_LENGTH,
} from "../constants";
import { createCommunity } from "../api/communities.api";
import { notifyCommunitiesRefresh } from "../communities-refresh";

/**
 * Turns a display name into a slug the API will accept.
 *
 * It reproduces the service's own normalization
 * (`apps/api/src/services/community.service.ts`): lowercase, drop apostrophes,
 * collapse everything else to single hyphens and trim them from the ends. So
 * "IIT Mandi Students" becomes "iit-mandi-students", and the value the form
 * shows is already the value the API would store.
 */
export function slugifyCommunityName(value: string): string {
  return value
    .toLowerCase()
    .replace(/['\u2019]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Everything the create-community form needs: the draft, its validation and the
 * submit itself.
 */
export interface CreateCommunityState {
  name: string;
  setName: (value: string) => void;
  /** The handle, derived from the name until it is edited by hand. */
  slug: string;
  setSlug: (value: string) => void;
  description: string;
  setDescription: (value: string) => void;
  type: CommunityType;
  setType: (value: CommunityType) => void;
  /** True while the create request is in flight. */
  isSubmitting: boolean;
  /** Result of the last failed submit, or null. */
  submitErrorMessage: string | null;
  dismissSubmitError: () => void;
  /** Set once the name is longer than the API accepts. */
  nameError: string | null;
  /** Set once the handle is longer than the API accepts. */
  slugError: string | null;
  /** True once the description is longer than the API accepts. */
  isDescriptionOverLimit: boolean;
  /** True when the draft is complete and nothing is in flight. */
  canSubmit: boolean;
  /**
   * Creates the community. Resolves the created community, or null when the
   * draft was rejected or the API refused it.
   */
  submit: () => Promise<Community | null>;
}

/**
 * Drives the create-community form.
 *
 * The owner is never part of the request — the API takes it from the bearer
 * token — so the body carries only the name, the handle, the type and the
 * description. The handle follows the name until the writer edits it, which is
 * what lets a student type a name and go without inventing a slug, while still
 * giving them full control when the derived handle is not what they want.
 *
 * On success it asks the mounted community lists to reload, so the new group is
 * in the directory and in "My communities" the moment the creator returns.
 */
export function useCreateCommunity(): CreateCommunityState {
  const [name, setName] = useState("");
  const [editedSlug, setEditedSlug] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [type, setType] = useState<CommunityType>(COMMUNITY_TYPES.PUBLIC);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitErrorMessage, setSubmitErrorMessage] = useState<string | null>(
    null,
  );

  // Once the handle is edited it stops tracking the name; until then it is the
  // name slugified, so the two fields never disagree about what will be created.
  const slug = editedSlug ?? slugifyCommunityName(name);

  const editSlug = useCallback((value: string) => {
    setEditedSlug(slugifyCommunityName(value));
  }, []);

  const trimmedName = name.trim();
  const trimmedSlug = slug.trim();
  const trimmedDescription = description.trim();

  const nameError =
    trimmedName.length > MAX_COMMUNITY_NAME_LENGTH
      ? `Names can be at most ${MAX_COMMUNITY_NAME_LENGTH} characters.`
      : null;
  const slugError =
    trimmedSlug.length > MAX_COMMUNITY_SLUG_LENGTH
      ? `Handles can be at most ${MAX_COMMUNITY_SLUG_LENGTH} characters.`
      : null;
  const isDescriptionOverLimit =
    trimmedDescription.length > MAX_COMMUNITY_DESCRIPTION_LENGTH;

  const canSubmit =
    !isSubmitting &&
    trimmedName.length > 0 &&
    nameError === null &&
    trimmedSlug.length > 0 &&
    slugError === null &&
    !isDescriptionOverLimit;

  const dismissSubmitError = useCallback(() => {
    setSubmitErrorMessage(null);
  }, []);

  const submit = useCallback(async (): Promise<Community | null> => {
    if (trimmedName.length === 0) {
      setSubmitErrorMessage("Give your study group a name.");
      return null;
    }

    if (nameError !== null) {
      setSubmitErrorMessage(nameError);
      return null;
    }

    if (trimmedSlug.length === 0) {
      setSubmitErrorMessage("Add a handle so students can find the group.");
      return null;
    }

    if (slugError !== null) {
      setSubmitErrorMessage(slugError);
      return null;
    }

    if (isDescriptionOverLimit) {
      setSubmitErrorMessage(
        `Descriptions can be at most ${MAX_COMMUNITY_DESCRIPTION_LENGTH} characters.`,
      );
      return null;
    }

    setIsSubmitting(true);
    setSubmitErrorMessage(null);

    try {
      const community = await createCommunity({
        name: trimmedName,
        slug: trimmedSlug,
        type,
        description:
          trimmedDescription.length > 0 ? trimmedDescription : undefined,
      });
      notifyCommunitiesRefresh();
      return community;
    } catch (error) {
      setSubmitErrorMessage(toUserMessage(error));
      return null;
    } finally {
      setIsSubmitting(false);
    }
  }, [
    isDescriptionOverLimit,
    nameError,
    slugError,
    trimmedDescription,
    trimmedName,
    trimmedSlug,
    type,
  ]);

  return {
    name,
    setName,
    slug,
    setSlug: editSlug,
    description,
    setDescription,
    type,
    setType,
    isSubmitting,
    submitErrorMessage,
    dismissSubmitError,
    nameError,
    slugError,
    isDescriptionOverLimit,
    canSubmit,
    submit,
  };
}
