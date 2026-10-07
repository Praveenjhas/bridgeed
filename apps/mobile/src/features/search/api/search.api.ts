import {
  DEFAULT_PAGE,
  type SearchResponse,
  type SearchType,
} from "@bridgeed/shared";
import { apiClient } from "@/services/api";
import { SEARCH_PAGE_LIMIT, SEARCH_PREVIEW_LIMIT } from "../constants";

export interface FetchSearchParams {
  /** The term to search for. Trimmed before it is sent. */
  term: string;
  /** One category to search, or null for the grouped preview of every category. */
  type?: SearchType | null;
  page?: number;
  limit?: number;
  signal?: AbortSignal;
}

/**
 * Runs one search.
 *
 * One endpoint answers both reads. Without `type` the API searches every category
 * and returns a capped preview of each; with one it pages inside that category
 * exactly like a directory listing. `type` is sent only when there is one, so the
 * grouped read is the absence of a parameter rather than a value the API has to
 * interpret.
 */
export async function fetchSearch({
  term,
  type = null,
  page = DEFAULT_PAGE,
  limit = type === null ? SEARCH_PREVIEW_LIMIT : SEARCH_PAGE_LIMIT,
  signal,
}: FetchSearchParams): Promise<SearchResponse> {
  return apiClient.get<SearchResponse>("/search", {
    query: { q: term.trim(), type, page, limit },
    signal,
  });
}
