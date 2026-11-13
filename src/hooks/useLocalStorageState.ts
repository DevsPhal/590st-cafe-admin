"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

const listeners = new Map<string, Set<() => void>>();

function subscribeTo(key: string) {
  return (onChange: () => void) => {
    const set = listeners.get(key) ?? new Set();
    set.add(onChange);
    listeners.set(key, set);
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) onChange();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      set.delete(onChange);
      window.removeEventListener("storage", onStorage);
    };
  };
}

function readRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function useLocalStorageState<T>(
  key: string,
  parse: (raw: string | null) => T,
  serialize: (value: T) => string = String,
): [T, (value: T) => void] {
  const subscribe = useMemo(() => subscribeTo(key), [key]);
  const raw = useSyncExternalStore(subscribe, () => readRaw(key), () => null);
  const value = parse(raw);
  const setValue = useCallback(
    (next: T) => {
      try {
        window.localStorage.setItem(key, serialize(next));
      } catch {
      }
      listeners.get(key)?.forEach((notify) => notify());
    },
    [key, serialize],
  );
  return [value, setValue];
}
