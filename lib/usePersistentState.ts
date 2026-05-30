import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

// Like useState, but persisted to localStorage. SSR-safe: the first render
// uses `initial` on both server and client, then localStorage is applied after
// mount (so there's no hydration mismatch).
export function usePersistentState<T>(
  key: string,
  initial: T
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(initial);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw != null) setValue(JSON.parse(raw) as T);
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, [key]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  }, [key, value, hydrated]);

  return [value, setValue];
}
