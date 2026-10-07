export {
  SUBJECTS_PAGE_LIMIT,
  UNIVERSITIES_PAGE_LIMIT,
} from "./constants";

export {
  formatCommunityCount,
  formatProgramAcademic,
  formatProgramCount,
  formatStudentCount,
  formatSubjectCount,
  formatUniversityLocation,
  joinMeta,
} from "./labels";

export {
  fetchProgramDetail,
  fetchSubjects,
  fetchUniversityBySlug,
  fetchUniversityDetail,
  fetchUniversityDirectory,
  fetchUniversityPrograms,
  type FetchProgramDetailParams,
  type FetchSubjectsParams,
  type FetchUniversityBySlugParams,
  type FetchUniversityDetailParams,
  type FetchUniversityDirectoryParams,
  type FetchUniversityProgramsParams,
} from "./api/universities.api";

export {
  useUniversityDirectory,
  type UniversityDirectoryState,
} from "./hooks/useUniversityDirectory";
export { useUniversityDetail } from "./hooks/useUniversityDetail";
export { useUniversityPrograms } from "./hooks/useUniversityPrograms";
export { useProgramDetail } from "./hooks/useProgramDetail";
