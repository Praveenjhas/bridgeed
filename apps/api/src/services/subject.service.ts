import type { Paginated, Subject } from "@bridgeed/shared";
import { SubjectRepository } from "../repositories/subject.repository";
import {
  normalizeLimit,
  normalizePage,
  toPageWindow,
  toPaginated,
} from "../utils/pagination";

/** The page window and optional name search a subject read asks for. */
export interface ListSubjectsQuery {
  page?: number;
  limit?: number;
  search?: string;
}

export class SubjectService {
  constructor(private readonly subjectRepository: SubjectRepository) {}

  async getSubjectById(id: string): Promise<Subject | null> {
    return this.subjectRepository.findById(id);
  }

  /**
   * One page of the subject catalog, ordered by name.
   *
   * Subjects are a shared vocabulary rather than a per-programme list, so this is
   * a flat, searchable read: no administration and no ranking.
   */
  async listSubjects(query: ListSubjectsQuery): Promise<Paginated<Subject>> {
    const page = normalizePage(query.page);
    const limit = normalizeLimit(query.limit);
    const window = toPageWindow(page, limit);

    const [items, total] = await Promise.all([
      this.subjectRepository.list(window, query.search),
      this.subjectRepository.countSubjects(query.search),
    ]);

    return toPaginated(items, page, limit, total);
  }
}
