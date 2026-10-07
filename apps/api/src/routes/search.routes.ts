import { Router } from "express";
import { SearchController } from "../controllers/search.controller";
import { SearchService } from "../services/search.service";
import { SearchRepository } from "../repositories/search.repository";
import { requireAuth } from "../middleware/require-auth";

const searchRepository = new SearchRepository();

const searchService = new SearchService(searchRepository);

const searchController = new SearchController(searchService);

/**
 * Global search: `GET /search?q=&type=&page=&limit=`.
 *
 * It is guarded for the same reason the student directory is: one of its
 * categories names accounts that have a profile, and the caller's own profile has
 * to be left out of that category. The viewer therefore comes from the token, and
 * there is no unauthenticated shape of this route to preserve.
 */
export const searchRouter = Router();

searchRouter.get("/", requireAuth, searchController.search);
