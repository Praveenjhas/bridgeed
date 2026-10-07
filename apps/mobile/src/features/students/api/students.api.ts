import type {
  Interest,
  Skill,
  StudentProfile,
  University,
} from "@bridgeed/shared";
import { apiClient } from "@/services/api";

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
