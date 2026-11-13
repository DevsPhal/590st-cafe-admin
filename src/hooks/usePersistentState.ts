"use client";

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

// A hook that provides a stateful value and a setter function, like useState, but persists the value in sessionStorage so it survives page reloads. The value is stored under a key prefixed with "590st-admin:" to avoid collisions with other data in sessionStorage. The value is serialized to JSON for storage and deserialized on retrieval. If the stored value cannot be parsed, the initial value is used instead.

const PREFIX = "590st-admin:";

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.sessionStorage.getItem(PREFIX + key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function usePersistentState<T>(
  key: string,
  initial: T | (() => T),
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() =>
    read(key, typeof initial === "function" ? (initial as () => T)() : initial),
  );

  useEffect(() => {
    try {
      window.sessionStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
      // Private mode or a full quota — the state still works, it just won't survive a reload.
    }
  }, [key, value]);

  return [value, setValue];
}

/** Forgets every saved page state — called on sign-out so the next account starts clean. */
export function clearPersistentState(): void {
  if (typeof window === "undefined") return;
  try {
    Object.keys(window.sessionStorage)
      .filter((key) => key.startsWith(PREFIX))
      .forEach((key) => window.sessionStorage.removeItem(key));
  } catch {
    // Nothing to clear.
  }
}
