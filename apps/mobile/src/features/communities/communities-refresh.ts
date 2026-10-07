/**
 * A one-signal channel that asks the mounted community lists to reload.
 *
 * Creating a community happens on a pushed screen while the Communities tab
 * stays mounted underneath it. Refreshing that tab on every focus would re-read
 * the whole directory each time any screen is closed; a targeted signal means it
 * reloads only when the set of communities actually changed. It is framework
 * free on purpose, mirroring `feed-refresh` and the session module, so the create
 * form can announce a change without importing any list code.
 */

type CommunitiesRefreshListener = () => void;

const listeners = new Set<CommunitiesRefreshListener>();

/** Subscribes to community refresh requests. Returns the unsubscribe function. */
export function subscribeToCommunitiesRefresh(
  listener: CommunitiesRefreshListener,
): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

/**
 * Asks every mounted community list to reload.
 *
 * Both the directory (`useCommunities`) and the actor's memberships
 * (`useCommunityMemberships`) subscribe, because a new community changes both:
 * it appears in the directory and the creator now has an owner membership.
 */
export function notifyCommunitiesRefresh(): void {
  listeners.forEach((listener) => listener());
}
