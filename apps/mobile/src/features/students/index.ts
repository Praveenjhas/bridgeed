export {
  attachStudentInterest,
  attachStudentSkill,
  createMyStudentProfile,
  fetchInterests,
  fetchMyStudentProfile,
  fetchSkills,
  fetchStudentDirectory,
  fetchStudentInterests,
  fetchStudentProfile,
  fetchStudentSkills,
  fetchUniversities,
  fetchUniversity,
  replaceMyStudentInterests,
  replaceMyStudentSkills,
  updateMyStudentProfile,
  type AttachStudentInterestParams,
  type AttachStudentSkillParams,
  type CreateMyStudentProfileInput,
  type CreateMyStudentProfileParams,
  type FetchCatalogParams,
  type FetchMyStudentProfileParams,
  type FetchStudentDirectoryParams,
  type FetchStudentInterestsParams,
  type FetchStudentProfileParams,
  type FetchStudentSkillsParams,
  type FetchUniversityParams,
  type ReplaceMyInterestsParams,
  type ReplaceMySkillsParams,
  type UpdateMyStudentProfileInput,
  type UpdateMyStudentProfileParams,
} from "./api/students.api";

export { STUDENT_DIRECTORY_PAGE_LIMIT } from "./constants";

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
  useStudentDirectory,
  type DirectoryStudent,
  type StudentDirectoryState,
} from "./hooks/useStudentDirectory";
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
  useCatalog,
  useInterests,
  useSkills,
  useUniversities,
  type CatalogState,
} from "./hooks/useCatalogs";

export {
  StudentIdentity,
  type StudentIdentityProps,
} from "./components/StudentIdentity";
export { StudentCard, type StudentCardProps } from "./components/StudentCard";
export { TagList, type TagListProps } from "./components/TagList";
