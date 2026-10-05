import type { Request, Response } from "express";
import { CommunityMembershipService } from "../services/community-membership.service";
import { mapCommunityDomainError } from "../utils/community-errors";

export class CommunityMembershipController {
  constructor(
    private readonly communityMembershipService: CommunityMembershipService,
  ) {}

  getMembershipById = async (req: Request, res: Response): Promise<void> => {
    try {
      const membershipId = this.readMembershipId(req);

      if (!membershipId) {
        res.status(400).json({
          error: "Invalid membership ID",
        });
        return;
      }

      const membership =
        await this.communityMembershipService.getMembershipById(membershipId);

      res.json(membership);
    } catch (error) {
      this.sendMappedError(error, res);
    }
  };

  approveMembership = async (req: Request, res: Response): Promise<void> =>
    this.decideRequest(req, res, (membershipId, actorId) =>
      this.communityMembershipService.approveMembership(membershipId, actorId),
    );

  rejectMembership = async (req: Request, res: Response): Promise<void> =>
    this.decideRequest(req, res, (membershipId, actorId) =>
      this.communityMembershipService.rejectMembership(membershipId, actorId),
    );

  private async decideRequest(
    req: Request,
    res: Response,
    decision: (membershipId: string, actorId: string) => Promise<unknown>,
  ): Promise<void> {
    try {
      const membershipId = this.readMembershipId(req);
      const actorId = this.readActorId(req);

      if (!membershipId) {
        res.status(400).json({
          error: "Invalid membership ID",
        });
        return;
      }

      if (!actorId) {
        res.status(400).json({
          error: "actorId is required",
        });
        return;
      }

      const membership = await decision(membershipId, actorId);

      res.json(membership);
    } catch (error) {
      this.sendMappedError(error, res);
    }
  }

  private readMembershipId(req: Request): string | null {
    const { membershipId } = req.params;

    return this.isNonEmptyString(membershipId) ? membershipId : null;
  }

  private readActorId(req: Request): string | null {
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

  private isNonEmptyString(value: unknown): value is string {
    return typeof value === "string" && value.trim().length > 0;
  }

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
}
