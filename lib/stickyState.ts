import { useEffect, useState } from 'react';

/**
 * Persisted state in sessionStorage.
 * Returns [value, setValue].
 */
export function useStickyState<T>(key: string, initial: T) {
  // Initialize synchronously from sessionStorage to avoid a transient default value
  // that can cause downstream effects (e.g., SWR keys changing and triggering refetches).
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = sessionStorage.getItem(key);
      if (raw != null) {
        return JSON.parse(raw) as T;
      }
    } catch {
      // ignore
    }
    return initial;
  });

  // Note: we intentionally do not "load on mount" anymore because we already read synchronously.
  // Keeping an effect here would briefly override the initial value and can cause key churn.

  // Save on change
  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
      // ignore
    }
  }, [key, value]);

  return [value, setValue] as const;
}

