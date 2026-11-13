"use client";

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

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
    }
  }, [key, value]);

  return [value, setValue];
}

export function clearPersistentState(): void {
  if (typeof window === "undefined") return;
  try {
    Object.keys(window.sessionStorage)
      .filter((key) => key.startsWith(PREFIX))
      .forEach((key) => window.sessionStorage.removeItem(key));
  } catch {
  }
}
