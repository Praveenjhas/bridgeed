import type { Request, Response } from "express";
import { readPagination, readSearchQuery } from "../utils/request";
import { SubjectService } from "../services/subject.service";

export class SubjectController {
  constructor(private readonly subjectService: SubjectService) {}

  /**
   * One page of the subject catalog.
   *
   * It reads the same `page`/`limit`/`search` shape as the university directory,
   * so an unparseable `page` or `limit` is a bad request rather than a silently
   * clamped read.
   */
  getSubjects = async (req: Request, res: Response): Promise<void> => {
    try {
      const pagination = readPagination(req);

      if (!pagination) {
        res.status(400).json({
          error: "page and limit must be positive integers",
        });
        return;
      }

      const search = readSearchQuery(req);

      if (search === null) {
        res.status(400).json({
          error: "search must be a single string",
        });
        return;
      }

      const subjects = await this.subjectService.listSubjects({
        page: pagination.page,
        limit: pagination.limit,
        search: search === undefined ? undefined : search,
      });

      res.json(subjects);
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error: "Internal server error",
      });
    }
  };
}
