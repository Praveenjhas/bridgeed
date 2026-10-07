import type { Request, Response } from "express";
import {
  COMMUNITY_MEMBERSHIP_STATUSES,
  type CommunityMembershipStatus,
} from "@bridgeed/shared";
import { CommunityService } from "../services/community.service";
import { CommunityMembershipService } from "../services/community-membership.service";
import { mapCommunityDomainError } from "../utils/community-errors";

const COMMUNITY_MEMBERSHIP_STATUS_VALUES: readonly string[] =
  Object.values(COMMUNITY_MEMBERSHIP_STATUSES);

function isCommunityMembershipStatus(
  value: string,
): value is CommunityMembershipStatus {
  return COMMUNITY_MEMBERSHIP_STATUS_VALUES.includes(value);
}

interface PaginationQuery {
  page?: number;
  limit?: number;
}

export class CommunityController {
  constructor(
    private readonly communityService: CommunityService,
    private readonly communityMembershipService: CommunityMembershipService,
  ) {}

  createCommunity = async (req: Request, res: Response): Promise<void> => {
    try {
      const body = (req.body ?? {}) as {
        name?: unknown;
        slug?: unknown;
        description?: unknown;
        type?: unknown;
        createdById?: unknown;
        coverImageUrl?: unknown;
      };

      // The owner is the authenticated account; the body's `createdById` is read
      // only for the unauthenticated legacy path.
      const createdById = req.auth?.userId ?? body.createdById;

      if (
        !this.isNonEmptyString(body.name) ||
        !this.isNonEmptyString(body.slug) ||
        !this.isNonEmptyString(body.type) ||
        !this.isNonEmptyString(createdById)
      ) {
        res.status(400).json({
          error: "name, slug, type and createdById are required",
        });
        return;
      }

      const community = await this.communityService.createCommunity({
        name: body.name,
        slug: body.slug,
        description: body.description,
        type: body.type,
        createdById,
        coverImageUrl: body.coverImageUrl,
      });

      res.status(201).json(community);
    } catch (error) {
      this.sendMappedError(error, res);
    }
  };

  getCommunities = async (req: Request, res: Response): Promise<void> => {
    try {
      const pagination = this.readPagination(req);

      if (!pagination) {
        res.status(400).json({
          error: "page and limit must be positive integers",
        });
        return;
      }

      const communities =
        await this.communityService.listCommunities(pagination);

      res.json(communities);
    } catch (error) {
      this.sendMappedError(error, res);
    }
  };

  getCommunityById = async (req: Request, res: Response): Promise<void> => {
    try {
      const communityId = this.readParam(req, "communityId");

      if (!communityId) {
        res.status(400).json({
          error: "Invalid community ID",
        });
        return;
      }

      const community =
        await this.communityService.getCommunityById(communityId);

      res.json(community);
    } catch (error) {
      this.sendMappedError(error, res);
    }
  };

  getCommunityMembers = async (req: Request, res: Response): Promise<void> => {
    try {
      const communityId = this.readParam(req, "communityId");

      if (!communityId) {
        res.status(400).json({
          error: "Invalid community ID",
        });
        return;
      }

      const pagination = this.readPagination(req);

      if (!pagination) {
        res.status(400).json({
          error: "page and limit must be positive integers",
        });
        return;
      }

      const status = this.readMembershipStatus(req);

      if (status === null) {
        res.status(400).json({
          error: "Invalid membership status",
        });
        return;
      }

      const members = await this.communityMembershipService.listCommunityMembers(
        communityId,
        {
          ...pagination,
          status,
        },
      );

      res.json(members);
    } catch (error) {
      this.sendMappedError(error, res);
    }
  };

  getMembershipRequests = async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    try {
      const communityId = this.readParam(req, "communityId");

      if (!communityId) {
        res.status(400).json({
          error: "Invalid community ID",
        });
        return;
      }

      const actorId = this.readActorId(req);

      if (!actorId) {
        res.status(400).json({
          error: "actorId is required",
        });
        return;
      }

      const pagination = this.readPagination(req);

      if (!pagination) {
        res.status(400).json({
          error: "page and limit must be positive integers",
        });
        return;
      }

      const requests =
        await this.communityMembershipService.listMembershipRequests(
          communityId,
          actorId,
          pagination,
        );

      res.json(requests);
    } catch (error) {
      this.sendMappedError(error, res);
    }
  };

  joinCommunity = async (req: Request, res: Response): Promise<void> => {
    try {
      const communityId = this.readParam(req, "communityId");

      if (!communityId) {
        res.status(400).json({
          error: "Invalid community ID",
        });
        return;
      }

      // The joining member is the authenticated account; the body's `userId` is
      // read only for the unauthenticated legacy path.
      const { userId: legacyUserId } = (req.body ?? {}) as { userId?: unknown };
      const userId = req.auth?.userId ?? legacyUserId;

      if (!this.isNonEmptyString(userId)) {
        res.status(400).json({
          error: "userId is required",
        });
        return;
      }

      const membership = await this.communityMembershipService.joinCommunity(
        communityId,
        userId,
      );

      res.status(201).json(membership);
    } catch (error) {
      this.sendMappedError(error, res);
    }
  };

  leaveCommunity = async (req: Request, res: Response): Promise<void> => {
    try {
      const communityId = this.readParam(req, "communityId");

      if (!communityId) {
        res.status(400).json({
          error: "Invalid community ID",
        });
        return;
      }

      const actorId = this.readActorId(req);

      if (!actorId) {
        res.status(400).json({
          error: "actorId is required",
        });
        return;
      }

      await this.communityMembershipService.leaveCommunity(
        communityId,
        actorId,
      );

      res.status(204).send();
    } catch (error) {
      this.sendMappedError(error, res);
    }
  };

  getStudentCommunities = async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    try {
      const userId = this.readParam(req, "userId");

      if (!userId) {
        res.status(400).json({
          error: "Invalid student ID",
        });
        return;
      }

      const status = this.readMembershipStatus(req);

      if (status === null) {
        res.status(400).json({
          error: "Invalid membership status",
        });
        return;
      }

      const communities =
        await this.communityMembershipService.getStudentCommunities(
          userId,
          status,
        );

      res.json(communities);
    } catch (error) {
      this.sendMappedError(error, res);
    }
  };

  private sendMappedError(error: unknown, res: Response): void {
    const mapped = mapCommunityDomainError(error);

    if (mapped) {
      res.status(mapped.status).json({ error: mapped.error });
      return;
    }

    console.error(error);

    res.status(500).json({
      error: "Internal server error",
    });
  }

  private isNonEmptyString(value: unknown): value is string {
    return typeof value === "string" && value.trim().length > 0;
  }

  private readParam(req: Request, name: string): string | null {
    const value = req.params[name];

    return this.isNonEmptyString(value) ? value : null;
  }

  private readMembershipStatus(
    req: Request,
  ): CommunityMembershipStatus | undefined | null {
    const { status } = req.query;

    if (status === undefined) {
      return undefined;
    }

    if (typeof status !== "string" || !isCommunityMembershipStatus(status)) {
      return null;
    }

    return status;
  }

  private readPagination(req: Request): PaginationQuery | null {
    const page = this.readPositiveInteger(req.query.page);
    const limit = this.readPositiveInteger(req.query.limit);

    if (page === null || limit === null) {
      return null;
    }

    return { page, limit };
  }

  private readPositiveInteger(value: unknown): number | undefined | null {
    if (value === undefined) {
      return undefined;
    }

    if (typeof value !== "string" || !/^[0-9]+$/.test(value.trim())) {
      return null;
    }

    const parsed = Number.parseInt(value.trim(), 10);

    return parsed > 0 ? parsed : null;
  }

  /**
   * The acting account of a community action: listing join requests or leaving.
   * The authenticated account always wins; the explicit `actorId`/`userId` is a
   * legacy fallback read only for unauthenticated requests.
   */
  private readActorId(req: Request): string | null {
    if (req.auth) {
      return req.auth.userId;
    }

    const { actorId, userId } = (req.body ?? {}) as {
      actorId?: unknown;
      userId?: unknown;
    };

    if (this.isNonEmptyString(actorId)) {
      return actorId;
    }

    if (this.isNonEmptyString(userId)) {
      return userId;
    }

    const queryActorId = req.query.actorId ?? req.query.userId;

    return this.isNonEmptyString(queryActorId) ? queryActorId : null;
  }
}
