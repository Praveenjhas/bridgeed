export {
  fetchStudentInterests,
  fetchStudentProfile,
  fetchStudentSkills,
  fetchUniversity,
  type FetchStudentInterestsParams,
  type FetchStudentProfileParams,
  type FetchStudentSkillsParams,
  type FetchUniversityParams,
} from "./api/students.api";

export {
  formatCourse,
  formatGraduationYear,
  formatStudentHint,
} from "./labels";

export {
  useStudentProfile,
  type StudentProfileState,
} from "./hooks/useStudentProfile";
export {
  useStudentProfiles,
  type StudentProfilesState,
} from "./hooks/useStudentProfiles";
export {
  useStudentSkills,
  type StudentSkillsState,
} from "./hooks/useStudentSkills";
export {
  useStudentInterests,
  type StudentInterestsState,
} from "./hooks/useStudentInterests";
export { useUniversity } from "./hooks/useUniversity";

export {
  StudentIdentity,
  type StudentIdentityProps,
} from "./components/StudentIdentity";
export { TagList, type TagListProps } from "./components/TagList";
