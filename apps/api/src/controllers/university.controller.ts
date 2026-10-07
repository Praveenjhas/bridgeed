import type { Request, Response } from "express";
import { readPagination, readSearchQuery } from "../utils/request";
import { UniversityService } from "../services/university.service";

export class UniversityController {
  constructor(private readonly universityService: UniversityService) {}

  createUniversity = async (req: Request, res: Response): Promise<void> => {
    try {
      const { name, country, state, city, websiteUrl, description, logoUrl, verified } =
        req.body as {
          name?: unknown;
          country?: unknown;
          state?: unknown;
          city?: unknown;
          websiteUrl?: unknown;
          description?: unknown;
          logoUrl?: unknown;
          verified?: unknown;
        };

      if (typeof name !== "string" || typeof country !== "string") {
        res.status(400).json({
          error: "name and country are required",
        });
        return;
      }

      if (state !== undefined && state !== null && typeof state !== "string") {
        res.status(400).json({
          error: "state must be a string or null",
        });
        return;
      }

      if (city !== undefined && city !== null && typeof city !== "string") {
        res.status(400).json({
          error: "city must be a string or null",
        });
        return;
      }

      if (
        websiteUrl !== undefined &&
        websiteUrl !== null &&
        typeof websiteUrl !== "string"
      ) {
        res.status(400).json({
          error: "websiteUrl must be a string or null",
        });
        return;
      }

      if (
        description !== undefined &&
        description !== null &&
        typeof description !== "string"
      ) {
        res.status(400).json({
          error: "description must be a string or null",
        });
        return;
      }

      if (
        logoUrl !== undefined &&
        logoUrl !== null &&
        typeof logoUrl !== "string"
      ) {
        res.status(400).json({
          error: "logoUrl must be a string or null",
        });
        return;
      }

      if (verified !== undefined && typeof verified !== "boolean") {
        res.status(400).json({
          error: "verified must be a boolean",
        });
        return;
      }

      const university = await this.universityService.createUniversity({
        name,
        country,
        state: state as string | null | undefined,
        city: city as string | null | undefined,
        websiteUrl: websiteUrl as string | null | undefined,
        description: description as string | null | undefined,
        logoUrl: logoUrl as string | null | undefined,
        verified: verified as boolean | undefined,
      });

      res.status(201).json(university);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "A university with this name already exists"
      ) {
        res.status(409).json({
          error: error.message,
        });
        return;
      }

      console.error(error);

      res.status(500).json({
        error: "Internal server error",
      });
    }
  };

  getUniversityById = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      if (typeof id !== "string" || id.trim().length === 0) {
        res.status(400).json({
          error: "Invalid university ID",
        });
        return;
      }

      const university = await this.universityService.getUniversityDetail(id);

      if (!university) {
        res.status(404).json({
          error: "University not found",
        });
        return;
      }

      res.json(university);
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error: "Internal server error",
      });
    }
  };

  /**
   * One page of the university directory, with an optional name search.
   *
   * `page`/`limit` are validated rather than clamped, so a typo is a bad request
   * instead of a silently different page.
   */
  listUniversities = async (req: Request, res: Response): Promise<void> => {
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

      const universities = await this.universityService.listUniversities({
        page: pagination.page,
        limit: pagination.limit,
        search: search === undefined ? undefined : search,
      });

      res.json(universities);
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error: "Internal server error",
      });
    }
  };

  /** The same document as `getUniversityById`, addressed by canonical slug. */
  getUniversityBySlug = async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    try {
      const { slug } = req.params;

      if (typeof slug !== "string" || slug.trim().length === 0) {
        res.status(400).json({
          error: "Invalid university slug",
        });
        return;
      }

      const university =
        await this.universityService.getUniversityDetailBySlug(slug);

      if (!university) {
        res.status(404).json({
          error: "University not found",
        });
        return;
      }

      res.json(university);
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error: "Internal server error",
      });
    }
  };
}
