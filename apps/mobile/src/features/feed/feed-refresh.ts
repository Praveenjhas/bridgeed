/**
 * A one-signal channel that asks the mounted feed to reload.
 *
 * Creating a post happens on a pushed screen while the feed stays mounted
 * underneath it. Refreshing the feed on every focus would re-rank every
 * candidate each time any screen is closed, which the feed deliberately avoids;
 * a targeted signal means the feed reloads only when content it shows actually
 * changed. It is framework free on purpose, mirroring the session module, so the
 * composer can announce a change without importing any feed code.
 */

type FeedRefreshListener = () => void;

const listeners = new Set<FeedRefreshListener>();

/** Subscribes to feed refresh requests. Returns the unsubscribe function. */
export function subscribeToFeedRefresh(
  listener: FeedRefreshListener,
): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

/** Asks every mounted feed to reload its first page. */
export function notifyFeedRefresh(): void {
  listeners.forEach((listener) => listener());
}
