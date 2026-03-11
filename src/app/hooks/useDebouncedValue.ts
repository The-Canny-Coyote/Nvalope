import { useState, useEffect, useRef } from 'react';

/**
 * Returns a debounced version of the value. The returned value updates after
 * `delayMs` of no changes to `value`. Useful for search/filter to avoid
 * running expensive work on every keystroke.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timeoutRef.current != null) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setDebounced(value);
      timeoutRef.current = null;
    }, delayMs);
    return () => {
      if (timeoutRef.current != null) clearTimeout(timeoutRef.current);
    };
  }, [value, delayMs]);

  return debounced;
}
