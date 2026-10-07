import type { Request, Response } from "express";
import { SEARCH_TYPE_VALUES } from "@bridgeed/shared";
import {
  readPagination,
  readSearchTerm,
  readSearchType,
} from "../utils/request";
import { requireAuthContext } from "../middleware/require-auth";
import { SearchService } from "../services/search.service";

/**
 * The search endpoint's bad requests.
 *
 * "You sent no term" and "you sent a term that is not one" are different answers,
 * so a missing or blank `q` is reported as a required parameter while a repeated
 * `?q=a&q=b` is reported as a malformed one. The type list in the message is
 * derived from `SEARCH_TYPE_VALUES`, so it cannot drift from the contract.
 */
export const SEARCH_QUERY_REQUIRED_MESSAGE = "q is required";
export const SEARCH_QUERY_INVALID_MESSAGE = "q must be a single string";
export const SEARCH_UNKNOWN_TYPE_MESSAGE = `type must be one of: ${SEARCH_TYPE_VALUES.join(
  ", ",
)}`;

/** The message the paged reads return for an unusable `page` or `limit`. */
const INVALID_PAGINATION_MESSAGE = "page and limit must be positive integers";

export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  /**
   * `GET /search?q=&type=&page=&limit=` — the one search entry point.
   *
   * The term is validated first because it is what makes the request a search at
   * all, then `type` because an unknown category is a client bug rather than an
   * empty result, then the page window. The viewer is read from the authenticated
   * context and never from the query string, so a caller cannot search as somebody
   * else and the student category always excludes the caller's own profile.
   */
  search = async (req: Request, res: Response): Promise<void> => {
    try {
      const term = readSearchTerm(req);

      if (term === null) {
        res.status(400).json({ error: SEARCH_QUERY_INVALID_MESSAGE });
        return;
      }

      if (term === undefined || term.length === 0) {
        res.status(400).json({ error: SEARCH_QUERY_REQUIRED_MESSAGE });
        return;
      }

      const type = readSearchType(req);

      if (type === null) {
        res.status(400).json({ error: SEARCH_UNKNOWN_TYPE_MESSAGE });
        return;
      }

      const pagination = readPagination(req);

      if (!pagination) {
        res.status(400).json({ error: INVALID_PAGINATION_MESSAGE });
        return;
      }

      const { userId } = requireAuthContext(req);

      const results = await this.searchService.search({
        term,
        type: type ?? null,
        page: pagination.page,
        limit: pagination.limit,
        viewerId: userId,
      });

      res.json(results);
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error: "Internal server error",
      });
    }
  };
}
