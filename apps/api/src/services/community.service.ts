import {
  COMMUNITY_TYPES,
  type Community,
  type CommunityDetail,
  type CommunityType,
  type Paginated,
} from "@bridgeed/shared";
import {
  COMMUNITY_SLUG_TAKEN_MESSAGE,
  CommunityRepository,
} from "../repositories/community.repository";
import { ProgramRepository } from "../repositories/program.repository";
import { StudentProfileRepository } from "../repositories/student-profile.repository";
import { SubjectRepository } from "../repositories/subject.repository";
import { UniversityRepository } from "../repositories/university.repository";
import {
  normalizeLimit,
  normalizePage,
  toPageWindow,
  toPaginated,
} from "../utils/pagination";

export const COMMUNITY_NOT_FOUND_MESSAGE = "Community not found";
export const STUDENT_PROFILE_NOT_FOUND_MESSAGE = "Student profile not found";
export const COMMUNITY_CREATOR_REQUIRED_MESSAGE =
  "Community creator is required";

export const COMMUNITY_NAME_REQUIRED_MESSAGE = "Community name is required";
export const COMMUNITY_NAME_TOO_LONG_MESSAGE =
  "Community name must be at most 120 characters";
export const COMMUNITY_SLUG_REQUIRED_MESSAGE = "Community slug is required";
export const COMMUNITY_SLUG_TOO_LONG_MESSAGE =
  "Community slug must be at most 120 characters";
export const COMMUNITY_SLUG_INVALID_MESSAGE = "Community slug is invalid";
export const COMMUNITY_TYPE_INVALID_MESSAGE = "Community type is invalid";
export const COMMUNITY_DESCRIPTION_INVALID_MESSAGE =
  "Community description must be a string";
export const COMMUNITY_DESCRIPTION_TOO_LONG_MESSAGE =
  "Community description must be at most 2000 characters";
export const COMMUNITY_COVER_IMAGE_INVALID_MESSAGE =
  "Community cover image URL must be a string";
export const COMMUNITY_COVER_IMAGE_TOO_LONG_MESSAGE =
  "Community cover image URL must be at most 2048 characters";

/** Raised when the optional academic context a community names does not exist. */
export const COMMUNITY_UNKNOWN_UNIVERSITY_MESSAGE =
  "The selected university does not exist";
export const COMMUNITY_UNKNOWN_PROGRAM_MESSAGE =
  "The selected program does not exist";
export const COMMUNITY_UNKNOWN_SUBJECT_MESSAGE =
  "The selected subject does not exist";
export const COMMUNITY_PROGRAM_UNIVERSITY_MISMATCH_MESSAGE =
  "The selected program is not offered by the selected university";
export const COMMUNITY_ACADEMIC_CONTEXT_INVALID_MESSAGE =
  "Academic context must be a string id or null";

const MAX_NAME_LENGTH = 120;
const MAX_SLUG_LENGTH = 80;
const MAX_RAW_SLUG_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_COVER_IMAGE_URL_LENGTH = 2048;

/** Slug characters are normalized, but clearly foreign input is rejected. */
const RAW_SLUG_PATTERN = /^[A-Za-z0-9][A-Za-z0-9\s\-_']*$/;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const COMMUNITY_TYPE_VALUES: readonly string[] = Object.values(COMMUNITY_TYPES);

export interface CreateCommunityInput {
  name: unknown;
  slug: unknown;
  description?: unknown;
  type: unknown;
  createdById: unknown;
  coverImageUrl?: unknown;
  /** Optional academic context; each is an id, or null/absent for none. */
  universityId?: unknown;
  programId?: unknown;
  subjectId?: unknown;
}

export interface ListCommunitiesQuery {
  page?: number;
  limit?: number;
}

export class CommunityService {
  constructor(
    private readonly communityRepository: CommunityRepository,
    private readonly studentProfileRepository: StudentProfileRepository,
    /**
     * The academic-context repositories are only touched when a community is
     * created with a university, programme or subject. They default to their own
     * instances so the routers that only read communities — content, reactions,
     * the feed — can keep constructing the service with the two dependencies they
     * already have, without wiring repositories they never reach.
     */
    private readonly universityRepository: UniversityRepository = new UniversityRepository(),
    private readonly programRepository: ProgramRepository = new ProgramRepository(),
    private readonly subjectRepository: SubjectRepository = new SubjectRepository(),
  ) {}

  async createCommunity(input: CreateCommunityInput): Promise<Community> {
    const name = this.normalizeName(input.name);
    const slug = this.normalizeSlug(input.slug);
    const type = this.normalizeType(input.type);
    const description = this.normalizeDescription(input.description);
    const coverImageUrl = this.normalizeCoverImageUrl(input.coverImageUrl);
    const createdById = this.normalizeCreatorId(input.createdById);
    const universityId = this.normalizeOptionalId(input.universityId);
    const programId = this.normalizeOptionalId(input.programId);
    const subjectId = this.normalizeOptionalId(input.subjectId);

    await this.ensureStudentProfileExists(createdById);
    await this.validateAcademicContext({ universityId, programId, subjectId });

    if (await this.communityRepository.existsBySlug(slug)) {
      throw new Error(COMMUNITY_SLUG_TAKEN_MESSAGE);
    }

    const communityId = crypto.randomUUID();

    return this.communityRepository.createWithOwnerMembership(
      {
        id: communityId,
        name,
        slug,
        description,
        type,
        createdById,
        coverImageUrl,
        universityId,
        programId,
        subjectId,
      },
      {
        id: crypto.randomUUID(),
        communityId,
        userId: createdById,
      },
    );
  }

  async getCommunityById(communityId: string): Promise<CommunityDetail> {
    return this.requireCommunity(communityId);
  }

  async listCommunities(
    query: ListCommunitiesQuery,
  ): Promise<Paginated<Community>> {
    const page = normalizePage(query.page);
    const limit = normalizeLimit(query.limit);

    const [items, total] = await Promise.all([
      this.communityRepository.findAll(toPageWindow(page, limit)),
      this.communityRepository.countAll(),
    ]);

    return toPaginated(items, page, limit, total);
  }

  /**
   * Shared community lookup so membership logic relies on one single
   * "Community not found" rule.
   */
  async requireCommunity(communityId: string): Promise<CommunityDetail> {
    const community = await this.communityRepository.findById(communityId);

    if (!community) {
      throw new Error(COMMUNITY_NOT_FOUND_MESSAGE);
    }

    return community;
  }

  async ensureStudentProfileExists(userId: string): Promise<void> {
    const profile = await this.studentProfileRepository.findByUserId(userId);

    if (!profile) {
      throw new Error(STUDENT_PROFILE_NOT_FOUND_MESSAGE);
    }
  }

  /**
   * Lowercases, trims and slugifies user input, for example
   * "IIT Mandi Students" becomes "iit-mandi-students".
   */
  private normalizeSlug(value: unknown): string {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new Error(COMMUNITY_SLUG_REQUIRED_MESSAGE);
    }

    const rawSlug = value.trim();

    if (rawSlug.length > MAX_RAW_SLUG_LENGTH) {
      throw new Error(COMMUNITY_SLUG_TOO_LONG_MESSAGE);
    }

    if (!RAW_SLUG_PATTERN.test(rawSlug)) {
      throw new Error(COMMUNITY_SLUG_INVALID_MESSAGE);
    }

    const slug = rawSlug
      .toLowerCase()
      .replace(/['\u2019]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    if (
      slug.length === 0 ||
      slug.length > MAX_SLUG_LENGTH ||
      !SLUG_PATTERN.test(slug)
    ) {
      throw new Error(COMMUNITY_SLUG_INVALID_MESSAGE);
    }

    return slug;
  }

  private normalizeName(value: unknown): string {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new Error(COMMUNITY_NAME_REQUIRED_MESSAGE);
    }

    const name = value.trim();

    if (name.length > MAX_NAME_LENGTH) {
      throw new Error(COMMUNITY_NAME_TOO_LONG_MESSAGE);
    }

    return name;
  }

  private normalizeType(value: unknown): CommunityType {
    if (typeof value !== "string") {
      throw new Error(COMMUNITY_TYPE_INVALID_MESSAGE);
    }

    // Community types are case-insensitive on input and normalized to the
    // lower case values used by the shared domain contracts.
    const type = value.trim().toLowerCase();

    if (!COMMUNITY_TYPE_VALUES.includes(type)) {
      throw new Error(COMMUNITY_TYPE_INVALID_MESSAGE);
    }

    return type as CommunityType;
  }

  private normalizeDescription(value: unknown): string | null {
    if (value === undefined || value === null) {
      return null;
    }

    if (typeof value !== "string") {
      throw new Error(COMMUNITY_DESCRIPTION_INVALID_MESSAGE);
    }

    const description = value.trim();

    if (description.length === 0) {
      return null;
    }

    if (description.length > MAX_DESCRIPTION_LENGTH) {
      throw new Error(COMMUNITY_DESCRIPTION_TOO_LONG_MESSAGE);
    }

    return description;
  }

  private normalizeCoverImageUrl(value: unknown): string | null {
    if (value === undefined || value === null) {
      return null;
    }

    if (typeof value !== "string") {
      throw new Error(COMMUNITY_COVER_IMAGE_INVALID_MESSAGE);
    }

    const coverImageUrl = value.trim();

    if (coverImageUrl.length === 0) {
      return null;
    }

    if (coverImageUrl.length > MAX_COVER_IMAGE_URL_LENGTH) {
      throw new Error(COMMUNITY_COVER_IMAGE_TOO_LONG_MESSAGE);
    }

    return coverImageUrl;
  }

  private normalizeCreatorId(value: unknown): string {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new Error(COMMUNITY_CREATOR_REQUIRED_MESSAGE);
    }

    return value.trim();
  }

  /**
   * Reads one optional academic id. Absent, null and blank all mean "not set";
   * anything that is not a string is rejected rather than silently dropped.
   */
  private normalizeOptionalId(value: unknown): string | null {
    if (value === undefined || value === null) {
      return null;
    }

    if (typeof value !== "string") {
      throw new Error(COMMUNITY_ACADEMIC_CONTEXT_INVALID_MESSAGE);
    }

    const trimmed = value.trim();

    return trimmed.length > 0 ? trimmed : null;
  }

  /**
   * Checks the optional academic context a community names.
   *
   * Every id that is set has to exist, and a programme has to belong to the
   * university it is paired with, so a community can never point at a course a
   * university does not offer. Each check is skipped when the id is absent, which
   * is what keeps a community with no academic context exactly as it was.
   */
  private async validateAcademicContext({
    universityId,
    programId,
    subjectId,
  }: {
    universityId: string | null;
    programId: string | null;
    subjectId: string | null;
  }): Promise<void> {
    if (universityId) {
      const university = await this.universityRepository.findById(universityId);

      if (!university) {
        throw new Error(COMMUNITY_UNKNOWN_UNIVERSITY_MESSAGE);
      }
    }

    if (programId) {
      const program = await this.programRepository.findById(programId);

      if (!program) {
        throw new Error(COMMUNITY_UNKNOWN_PROGRAM_MESSAGE);
      }

      if (universityId && program.universityId !== universityId) {
        throw new Error(COMMUNITY_PROGRAM_UNIVERSITY_MISMATCH_MESSAGE);
      }
    }

    if (subjectId) {
      const subject = await this.subjectRepository.findById(subjectId);

      if (!subject) {
        throw new Error(COMMUNITY_UNKNOWN_SUBJECT_MESSAGE);
      }
    }
  }
}
