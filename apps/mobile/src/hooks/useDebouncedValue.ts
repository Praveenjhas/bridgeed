import { useEffect, useState } from "react";

/**
 * Returns `value` once it has stopped changing for `delay` milliseconds.
 *
 * It is the one place the app decides when typing has paused. A search field that
 * requested on every keystroke would ask the API about "m", then "ma", then
 * "mac", and the three answers would race each other; holding the value still for
 * a moment turns one word into one request. The timer is cleared on every change
 * and on unmount, so a screen that is left mid-word does not fire a request after
 * it is gone.
 */
export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);

    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
