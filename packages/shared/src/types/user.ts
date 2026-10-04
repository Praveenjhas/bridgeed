import type { UserRole } from "../constants/roles";

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
