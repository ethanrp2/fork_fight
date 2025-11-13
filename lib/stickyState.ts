import { useEffect, useState } from 'react';

/**
 * Persisted state in sessionStorage.
 * Returns [value, setValue].
 */
export function useStickyState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);

  // Load on mount
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(key);
      if (raw != null) {
        setValue(JSON.parse(raw) as T);
      }
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

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

