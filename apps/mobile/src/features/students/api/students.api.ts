import type {
  Interest,
  Skill,
  StudentProfile,
  University,
} from "@bridgeed/shared";
import { apiClient, ApiError } from "@/services/api";

export interface FetchStudentProfileParams {
  /** The student whose profile is read. This is the profile's `userId`. */
  userId: string;
  signal?: AbortSignal;
}

/**
 * Reads one student profile.
 *
 * The endpoint is the only source of a student's name, username, course,
 * university and bio, so every list that shows a person (connections, requests,
 * a profile screen) resolves them through it. A missing profile answers 404 with
 * "Student profile not found", which is already written for a reader.
 */
export async function fetchStudentProfile({
  userId,
  signal,
}: FetchStudentProfileParams): Promise<StudentProfile> {
  return apiClient.get<StudentProfile>(
    `/student-profiles/${encodeURIComponent(userId)}`,
    { signal },
  );
}

export interface FetchUniversityParams {
  universityId: string;
  signal?: AbortSignal;
}

/**
 * Reads one university.
 *
 * A student profile only carries a `universityId`, so this second read is what
 * turns that id into the name and location a person can recognise.
 */
export async function fetchUniversity({
  universityId,
  signal,
}: FetchUniversityParams): Promise<University> {
  return apiClient.get<University>(
    `/universities/${encodeURIComponent(universityId)}`,
    { signal },
  );
}

export interface FetchStudentSkillsParams {
  userId: string;
  signal?: AbortSignal;
}

/** Reads every skill attached to one student profile. */
export async function fetchStudentSkills({
  userId,
  signal,
}: FetchStudentSkillsParams): Promise<Skill[]> {
  return apiClient.get<Skill[]>(
    `/student-profiles/${encodeURIComponent(userId)}/skills`,
    { signal },
  );
}

export interface FetchStudentInterestsParams {
  userId: string;
  signal?: AbortSignal;
}

/** Reads every interest attached to one student profile. */
export async function fetchStudentInterests({
  userId,
  signal,
}: FetchStudentInterestsParams): Promise<Interest[]> {
  return apiClient.get<Interest[]>(
    `/student-profiles/${encodeURIComponent(userId)}/interests`,
    { signal },
  );
}

export interface FetchMyStudentProfileParams {
  signal?: AbortSignal;
}

/**
 * Reads the signed-in student's own profile.
 *
 * `null` is an answer, not a failure: `/student-profiles/me` replies 404 while
 * the account has no profile yet, which is exactly the state onboarding starts
 * from. That is why this sits beside `fetchStudentProfile` instead of replacing
 * it: the route guard has to tell "nobody has set this account up" apart from
 * "the API could not answer", and only a null-versus-throw difference carries
 * that. Every other failure still throws.
 */
export async function fetchMyStudentProfile({
  signal,
}: FetchMyStudentProfileParams = {}): Promise<StudentProfile | null> {
  try {
    return await apiClient.get<StudentProfile>("/student-profiles/me", {
      signal,
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }

    throw error;
  }
}

/** The fields onboarding collects. Only the name and handle are required. */
export interface CreateMyStudentProfileInput {
  name: string;
  username: string;
  bio?: string | null;
  universityId?: string | null;
  degree?: string | null;
  branch?: string | null;
  graduationYear?: number | null;
  location?: string | null;
}

export interface CreateMyStudentProfileParams {
  input: CreateMyStudentProfileInput;
  signal?: AbortSignal;
}

/**
 * Creates the signed-in student's profile.
 *
 * The owner is deliberately absent from the body: the API reads it from the
 * bearer token, so this call cannot create a profile for somebody else. A 409
 * means either "this account already has a profile" or "this username is taken",
 * and the API's own message says which.
 */
export async function createMyStudentProfile({
  input,
  signal,
}: CreateMyStudentProfileParams): Promise<StudentProfile> {
  return apiClient.post<StudentProfile>("/student-profiles/me", {
    body: input,
    signal,
  });
}

export interface FetchCatalogParams {
  signal?: AbortSignal;
}

/** Every university the API knows about, for the pickers that name one. */
export async function fetchUniversities({
  signal,
}: FetchCatalogParams = {}): Promise<University[]> {
  return apiClient.get<University[]>("/universities", { signal });
}

/** Every skill a profile can carry. */
export async function fetchSkills({ signal }: FetchCatalogParams = {}): Promise<
  Skill[]
> {
  return apiClient.get<Skill[]>("/skills", { signal });
}

/** Every interest a profile can carry. */
export async function fetchInterests({
  signal,
}: FetchCatalogParams = {}): Promise<Interest[]> {
  return apiClient.get<Interest[]>("/interests", { signal });
}

export interface AttachStudentSkillParams {
  userId: string;
  skillId: string;
  signal?: AbortSignal;
}

/**
 * Attaches one skill to a profile.
 *
 * A 409 is left for the caller to interpret: onboarding reads it as "already
 * attached", because repeating a submit that was interrupted after this call
 * must not fail on the tags it has already written.
 */
export async function attachStudentSkill({
  userId,
  skillId,
  signal,
}: AttachStudentSkillParams): Promise<Skill> {
  return apiClient.post<Skill>(
    `/student-profiles/${encodeURIComponent(userId)}/skills/${encodeURIComponent(skillId)}`,
    { signal },
  );
}

export interface AttachStudentInterestParams {
  userId: string;
  interestId: string;
  signal?: AbortSignal;
}

/** Attaches one interest to a profile. 409 means it is already attached. */
export async function attachStudentInterest({
  userId,
  interestId,
  signal,
}: AttachStudentInterestParams): Promise<Interest> {
  return apiClient.post<Interest>(
    `/student-profiles/${encodeURIComponent(userId)}/interests/${encodeURIComponent(interestId)}`,
    { signal },
  );
}
