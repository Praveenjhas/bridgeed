import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { StudentProfileDetails } from "@bridgeed/shared";
import { fetchMyStudentProfile } from "@/features/students";
import { toUserMessage } from "@/utils/errors";
import { useAuth } from "./AuthProvider";

/**
 * Where the signed-in account is in having a student profile.
 *
 * `missing` is a real answer from `GET /student-profiles/me`, not an error, and
 * it is the only state that sends a student into onboarding.
 */
export type SelfProfileStatus = "loading" | "missing" | "ready" | "error";

export interface StudentProfileContextValue {
  status: SelfProfileStatus;
  /** The signed-in student's profile, once it exists, with its university and tags. */
  profile: StudentProfileDetails | null;
  /** Message for a failed read, which the guard surfaces with a retry. */
  errorMessage: string | null;
  /** Re-reads the profile, for a retry after a failure. */
  refresh: () => void;
  /** Publishes a profile that was just created or changed, without re-reading it. */
  applyProfile: (profile: StudentProfileDetails) => void;
}

interface SelfProfileState {
  status: SelfProfileStatus;
  profile: StudentProfileDetails | null;
  errorMessage: string | null;
}

const INITIAL_STATE: SelfProfileState = {
  status: "loading",
  profile: null,
  errorMessage: null,
};

const StudentProfileContext = createContext<StudentProfileContextValue | null>(
  null,
);

export interface StudentProfileProviderProps {
  children: ReactNode;
}

/**
 * Answers "does the signed-in account have a profile yet?" once, for the whole app.
 *
 * The root navigator has to know this before it can choose between the tabs and
 * onboarding, and the Profile tab needs the same profile, so it is read in one
 * place instead of by each screen. The read only happens while somebody is signed
 * in: the endpoint is authenticated and takes its owner from the session, so an
 * anonymous caller has nothing to ask about.
 *
 * A 404 becomes `missing` rather than a failure — that is what the endpoint means
 * by it, and treating it as an error would strand every new account on a retry
 * screen it can never clear. Everything else stays an error, so an unreachable
 * API is never mistaken for an empty account.
 */
export function StudentProfileProvider({
  children,
}: StudentProfileProviderProps) {
  const { isAuthenticated, actorId } = useAuth();
  const [state, setState] = useState<SelfProfileState>(INITIAL_STATE);
  const [requestKey, setRequestKey] = useState(0);

  const refresh = useCallback(() => {
    setRequestKey((key) => key + 1);
  }, []);

  useEffect(() => {
    if (!isAuthenticated || actorId === null) {
      setState(INITIAL_STATE);
      return;
    }

    const controller = new AbortController();
    let isActive = true;

    // A re-read keeps the profile it already has on screen and only reports the
    // wait through `loading`, so a refresh never blanks the tab it is refreshing.
    setState((current) => ({
      status: "loading",
      profile: current.profile,
      errorMessage: null,
    }));

    void (async () => {
      try {
        const profile = await fetchMyStudentProfile({
          signal: controller.signal,
        });

        if (!isActive) {
          return;
        }

        setState(
          profile === null
            ? { status: "missing", profile: null, errorMessage: null }
            : { status: "ready", profile, errorMessage: null },
        );
      } catch (error) {
        if (!isActive) {
          return;
        }

        setState({
          status: "error",
          profile: null,
          errorMessage: toUserMessage(error),
        });
      }
    })();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [actorId, isAuthenticated, requestKey]);

  const applyProfile = useCallback((profile: StudentProfileDetails) => {
    setState({ status: "ready", profile, errorMessage: null });
  }, []);

  const value = useMemo<StudentProfileContextValue>(
    () => ({
      status: state.status,
      profile: state.profile,
      errorMessage: state.errorMessage,
      refresh,
      applyProfile,
    }),
    [applyProfile, refresh, state],
  );

  return (
    <StudentProfileContext.Provider value={value}>
      {children}
    </StudentProfileContext.Provider>
  );
}

/** Reads the signed-in student's profile state. Must be inside the provider. */
export function useStudentProfileStatus(): StudentProfileContextValue {
  const value = useContext(StudentProfileContext);

  if (!value) {
    throw new Error(
      "useStudentProfileStatus must be used inside a <StudentProfileProvider>.",
    );
  }

  return value;
}
