const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;

const SHORT_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

const LONG_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

function parseTimestamp(isoTimestamp: string): Date | null {
  const milliseconds = Date.parse(isoTimestamp);

  return Number.isNaN(milliseconds) ? null : new Date(milliseconds);
}

function pad(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

/**
 * Compact relative label used in dense lists, for example `just now`, `12m ago`
 * or `3h ago`. Anything older than a week falls back to a real date so the feed
 * never claims something happened "12d ago" when the exact day matters.
 *
 * `now` is injectable so the formatting can be tested without freezing time.
 */
export function formatRelativeTime(
  isoTimestamp: string,
  now: number = Date.now(),
): string {
  const date = parseTimestamp(isoTimestamp);

  if (!date) {
    return "";
  }

  // A timestamp in the future means the device clock is behind the server.
  // Reporting "just now" is friendlier than reporting a negative age.
  const elapsed = Math.max(0, now - date.getTime());

  if (elapsed < MINUTE_MS) {
    return "just now";
  }

  if (elapsed < HOUR_MS) {
    return `${Math.floor(elapsed / MINUTE_MS)}m ago`;
  }

  if (elapsed < DAY_MS) {
    return `${Math.floor(elapsed / HOUR_MS)}h ago`;
  }

  if (elapsed < WEEK_MS) {
    return `${Math.floor(elapsed / DAY_MS)}d ago`;
  }

  return formatShortDate(isoTimestamp);
}

/** Absolute short date, for example `12 Mar` or `12 Mar 2024`. */
export function formatShortDate(isoTimestamp: string): string {
  const date = parseTimestamp(isoTimestamp);

  if (!date) {
    return "";
  }

  const month = SHORT_MONTHS[date.getMonth()] ?? "";
  const day = date.getDate();
  const year = date.getFullYear();

  if (year === new Date().getFullYear()) {
    return `${day} ${month}`;
  }

  return `${day} ${month} ${year}`;
}

/**
 * Unambiguous timestamp for detail views and accessibility labels, for example
 * `12 March 2026, 14:05`. The 24 hour clock keeps it readable for an
 * international student body without inventing a locale.
 */
export function formatLongDate(isoTimestamp: string): string {
  const date = parseTimestamp(isoTimestamp);

  if (!date) {
    return "";
  }

  const month = LONG_MONTHS[date.getMonth()] ?? "";
  const day = date.getDate();
  const year = date.getFullYear();
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());

  return `${day} ${month} ${year}, ${hours}:${minutes}`;
}
