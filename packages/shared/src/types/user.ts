import type { UserRole } from "../constants/roles";
import type { Interest } from "./interest";
import type { Skill } from "./skill";
import type { University } from "./university";

export interface User {
  id: string;
  email: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export interface StudentProfile {
  userId: string;
  name: string;
  username: string;
  bio: string | null;
  universityId: string | null;
  degree: string | null;
  branch: string | null;
  graduationYear: number | null;
  profileImageUrl: string | null;
  location: string | null;
}

/**
 * A student profile together with the records that belong to it.
 *
 * `GET /student-profiles/me` answers with this shape. The profile screen needs
 * the university the profile names and the skills and interests attached to it,
 * and reading them as one document keeps the signed-in account's own profile in
 * a single place instead of spreading it across four requests. The relations are
 * separate tables, so they stay separate fields here rather than being flattened
 * onto `StudentProfile`.
 */
export interface StudentProfileDetails extends StudentProfile {
  university: University | null;
  skills: Skill[];
  interests: Interest[];
}

