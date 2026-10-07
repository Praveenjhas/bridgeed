import type { Community } from "./community";
import type { University } from "./university";

/**
 * The academic graph shared by the API and the app:
 *
 *   University -> Program -> Subject -> Community -> Posts
 *
 * A student connects into it through their university, their programme and the
 * communities they join. Nothing here is a verification or admissions concept —
 * these are the plain directory entities the discovery screens read.
 */

/** A subject taught inside one or more programmes, for example "Thermodynamics". */
export interface Subject {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * A degree programme offered by a university.
 *
 * `universityName` is carried alongside the id so a programme row can be shown
 * on its own (a subject page, a community's context line) without a second read.
 */
export interface Program {
  id: string;
  universityId: string;
  universityName: string;
  name: string;
  degree: string | null;
  field: string | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A programme together with its university and the subjects it teaches. */
export interface ProgramDetail extends Program {
  university: University | null;
  subjects: Subject[];
  /** How many BridgeEd students are enrolled on it. */
  studentCount: number;
  /** How many communities are anchored to it. */
  communityCount: number;
}

/** A university with the counts the directory rows show. */
export interface UniversitySummary extends University {
  programCount: number;
  studentCount: number;
  communityCount: number;
}

/** A university with everything the detail screen needs, in one response. */
export interface UniversityDetail extends UniversitySummary {
  programs: Program[];
  communities: Community[];
}
