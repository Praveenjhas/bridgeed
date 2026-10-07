import { ACTOR_ID_ENV_VAR, isDevelopmentBuild } from "./env";

/** How the current actor identity was obtained. */
export type ActorSource = "env" | "missing";

export interface ActorResolution {
  /** The acting student id, or null when it has not been configured. */
  actorId: string | null;
  source: ActorSource;
  /** Plain language explanation, surfaced in development UI. */
  detail: string;
}

function readConfiguredActorId(): string | null {
  const raw = process.env.EXPO_PUBLIC_ACTOR_ID;

  if (typeof raw !== "string") {
    return null;
  }

  const trimmed = raw.trim();

  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Resolves the identity the app acts as.
 *
 * The API has no authentication yet: every content endpoint takes an explicit
 * `actorId`, and ranking, membership checks and "already reacted" flags are all
 * computed for that id. The app therefore has to be told who it is, and there is
 * deliberately no fallback: quietly acting as somebody else would make the feed
 * look wrong for reasons that are very hard to debug.
 */
export function resolveActor(): ActorResolution {
  const actorId = readConfiguredActorId();

  if (actorId) {
    return {
      actorId,
      source: "env",
      detail: `Acting as ${actorId} from ${ACTOR_ID_ENV_VAR}.`,
    };
  }

  return {
    actorId: null,
    source: "missing",
    detail: `${ACTOR_ID_ENV_VAR} is not set. Copy apps/mobile/.env.example to apps/mobile/.env and set ${ACTOR_ID_ENV_VAR} to the id of an existing student profile (see the file for a query that finds one), then restart the dev server.${isDevelopmentBuild() ? "" : " This build has no development actor configured."}`,
  };
}

/** Convenience predicate used by screens that require an actor. */
export function hasActor(): boolean {
  return resolveActor().actorId !== null;
}
