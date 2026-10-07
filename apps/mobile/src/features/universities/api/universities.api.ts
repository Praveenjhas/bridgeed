import {
  DEFAULT_PAGE,
  type Paginated,
  type Program,
  type ProgramDetail,
  type Subject,
  type UniversityDetail,
  type UniversitySummary,
} from "@bridgeed/shared";
import { apiClient } from "@/services/api";
import { SUBJECTS_PAGE_LIMIT, UNIVERSITIES_PAGE_LIMIT } from "../constants";

export interface FetchUniversityDirectoryParams {
  /** One based page number, matching the API's paged listings. */
  page?: number;
  limit?: number;
  /** Optional name term; the API matches it case-insensitively. */
  search?: string;
  signal?: AbortSignal;
}

/**
 * Reads one page of the university directory.
 *
 * Each row carries its programme, student and community counts, which the API
 * computes in one batched subquery rather than a read per relation. `search` is
 * sent only when there is a term, so an empty field is not a different request.
 */
export async function fetchUniversityDirectory({
  page = DEFAULT_PAGE,
  limit = UNIVERSITIES_PAGE_LIMIT,
  search,
  signal,
}: FetchUniversityDirectoryParams = {}): Promise<Paginated<UniversitySummary>> {
  return apiClient.get<Paginated<UniversitySummary>>("/universities", {
    query: { page, limit, search: search?.trim() || undefined },
    signal,
  });
}

export interface FetchUniversityDetailParams {
  universityId: string;
  signal?: AbortSignal;
}

/** Reads one university with its counts, programmes and communities. */
export async function fetchUniversityDetail({
  universityId,
  signal,
}: FetchUniversityDetailParams): Promise<UniversityDetail> {
  return apiClient.get<UniversityDetail>(
    `/universities/${encodeURIComponent(universityId)}`,
    { signal },
  );
}

export interface FetchUniversityBySlugParams {
  slug: string;
  signal?: AbortSignal;
}

/** Reads the same document as `fetchUniversityDetail`, by canonical slug. */
export async function fetchUniversityBySlug({
  slug,
  signal,
}: FetchUniversityBySlugParams): Promise<UniversityDetail> {
  return apiClient.get<UniversityDetail>(
    `/universities/slug/${encodeURIComponent(slug)}`,
    { signal },
  );
}

export interface FetchUniversityProgramsParams {
  universityId: string;
  signal?: AbortSignal;
}

/**
 * Every programme a university offers.
 *
 * The list is returned whole rather than paged: a single university offers a
 * handful of programmes, and the screen shows them all at once.
 */
export async function fetchUniversityPrograms({
  universityId,
  signal,
}: FetchUniversityProgramsParams): Promise<Program[]> {
  return apiClient.get<Program[]>(
    `/universities/${encodeURIComponent(universityId)}/programs`,
    { signal },
  );
}

export interface FetchProgramDetailParams {
  programId: string;
  signal?: AbortSignal;
}

/** Reads one programme with its university and the subjects it teaches. */
export async function fetchProgramDetail({
  programId,
  signal,
}: FetchProgramDetailParams): Promise<ProgramDetail> {
  return apiClient.get<ProgramDetail>(
    `/programs/${encodeURIComponent(programId)}`,
    { signal },
  );
}

export interface FetchSubjectsParams {
  page?: number;
  limit?: number;
  search?: string;
  signal?: AbortSignal;
}

/** Reads one page of the subject catalog. */
export async function fetchSubjects({
  page = DEFAULT_PAGE,
  limit = SUBJECTS_PAGE_LIMIT,
  search,
  signal,
}: FetchSubjectsParams = {}): Promise<Paginated<Subject>> {
  return apiClient.get<Paginated<Subject>>("/subjects", {
    query: { page, limit, search: search?.trim() || undefined },
    signal,
  });
}
