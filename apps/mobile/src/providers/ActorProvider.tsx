import { createContext, useContext, useMemo, type ReactNode } from "react";
import { resolveActor, type ActorResolution } from "@/config/actor";

export interface ActorContextValue extends ActorResolution {
  /**
   * True when the app knows which student it is acting as. Screens that read
   * per student data check this before loading anything.
   */
  isConfigured: boolean;
}

const ActorContext = createContext<ActorContextValue | null>(null);

export interface ActorProviderProps {
  children: ReactNode;
}

/**
 * Publishes the acting student to the whole app.
 *
 * The value is resolved once at startup rather than on every read, because it
 * comes from the bundle environment and cannot change while the app is running.
 * Until the API has authentication this is the single place that answers "who
 * am I", so swapping it for a real session later touches no screen.
 */
export function ActorProvider({ children }: ActorProviderProps) {
  const value = useMemo<ActorContextValue>(() => {
    const resolution = resolveActor();

    return { ...resolution, isConfigured: resolution.actorId !== null };
  }, []);

  return (
    <ActorContext.Provider value={value}>{children}</ActorContext.Provider>
  );
}

/** Reads the acting student. Must be used inside an `ActorProvider`. */
export function useActor(): ActorContextValue {
  const value = useContext(ActorContext);

  if (!value) {
    throw new Error("useActor must be used inside an <ActorProvider>.");
  }

  return value;
}
