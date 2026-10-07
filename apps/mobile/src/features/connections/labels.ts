import type { BadgeTone } from "@/components";
import { RELATIONSHIP_STATES, type RelationshipState } from "./relationships";

/**
 * Copy and colors for the connection vocabulary.
 *
 * The API's status values never reach a screen: a state is always rendered from
 * these labels, so "pending" reads as "Request sent" or "Wants to connect"
 * depending on who is looking at it.
 */

export const RELATIONSHIP_LABELS: Record<RelationshipState, string> = {
  [RELATIONSHIP_STATES.SELF]: "You",
  [RELATIONSHIP_STATES.NOT_CONNECTED]: "Not connected",
  [RELATIONSHIP_STATES.PENDING_OUTGOING]: "Request sent",
  [RELATIONSHIP_STATES.PENDING_INCOMING]: "Wants to connect",
  [RELATIONSHIP_STATES.ACCEPTED]: "Connected",
  [RELATIONSHIP_STATES.BLOCKED]: "Blocked",
};

export const RELATIONSHIP_TONES: Record<RelationshipState, BadgeTone> = {
  [RELATIONSHIP_STATES.SELF]: "neutral",
  [RELATIONSHIP_STATES.NOT_CONNECTED]: "neutral",
  [RELATIONSHIP_STATES.PENDING_OUTGOING]: "warning",
  [RELATIONSHIP_STATES.PENDING_INCOMING]: "accent",
  [RELATIONSHIP_STATES.ACCEPTED]: "success",
  [RELATIONSHIP_STATES.BLOCKED]: "danger",
};

export function relationshipLabel(state: RelationshipState): string {
  return RELATIONSHIP_LABELS[state] ?? "Connection";
}

export function relationshipTone(state: RelationshipState): BadgeTone {
  return RELATIONSHIP_TONES[state] ?? "neutral";
}

/**
 * One sentence that explains what a state means for the reader.
 *
 * Screens show it instead of a bare badge so nobody has to guess why a button is
 * missing or what happens next.
 */
export function describeRelationship(state: RelationshipState): string {
  switch (state) {
    case RELATIONSHIP_STATES.SELF:
      return "This is your own profile.";
    case RELATIONSHIP_STATES.PENDING_OUTGOING:
      return "Your request is waiting for them to accept it. You can withdraw it in the meantime.";
    case RELATIONSHIP_STATES.PENDING_INCOMING:
      return "They would like to connect with you. Accepting adds them to your connections.";
    case RELATIONSHIP_STATES.ACCEPTED:
      return "You are connected. Their posts rank higher in your feed.";
    case RELATIONSHIP_STATES.BLOCKED:
      return "You blocked this person, so neither of you can send a new request. Removing a block is not available in the app yet.";
    default:
      return "You are not connected yet. A connection puts their posts higher in your feed.";
  }
}
