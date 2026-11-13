"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import { usePathname } from "next/navigation";
import { useGetCurrentUserQuery } from "@/store/api/authApi";
import { usePersistentState } from "@/hooks/usePersistentState";

export const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

export const REFRESH_SECONDS_OPTIONS = [0, 15, 30, 60, 120] as const;

export interface AdminPreferences {
  pageSize: number;
  refreshSeconds: number;
  pauseRefreshWhenHidden: boolean;
}

export const DEFAULT_PREFERENCES: AdminPreferences = {
  pageSize: 10,
  refreshSeconds: 30,
  pauseRefreshWhenHidden: true,
};

interface AdminPreferencesValue {
  preferences: AdminPreferences;
  setPreferences: (patch: Partial<AdminPreferences>) => void;
  resetPreferences: () => void;
}

const AdminPreferencesContext = createContext<AdminPreferencesValue | null>(
  null,
);

function storageKey(userId: string | undefined) {
  return userId ? `admin:preferences:${userId}` : "admin:preferences";
}

function read(userId: string | undefined): AdminPreferences {
  if (typeof window === "undefined") return DEFAULT_PREFERENCES;
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<AdminPreferences>;
    return {
      pageSize: PAGE_SIZE_OPTIONS.includes(parsed.pageSize as never)
        ? (parsed.pageSize as number)
        : DEFAULT_PREFERENCES.pageSize,
      refreshSeconds: REFRESH_SECONDS_OPTIONS.includes(
        parsed.refreshSeconds as never,
      )
        ? (parsed.refreshSeconds as number)
        : DEFAULT_PREFERENCES.refreshSeconds,
      pauseRefreshWhenHidden:
        typeof parsed.pauseRefreshWhenHidden === "boolean"
          ? parsed.pauseRefreshWhenHidden
          : DEFAULT_PREFERENCES.pauseRefreshWhenHidden,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function AdminPreferencesProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { data: user } = useGetCurrentUserQuery();
  const userId = user?.id;

  const [preferences, setState] = useState<AdminPreferences>(() =>
    read(undefined),
  );

  const [readFor, setReadFor] = useState(userId);
  if (userId !== readFor) {
    setReadFor(userId);
    setState(read(userId));
  }

  const setPreferences = useCallback(
    (patch: Partial<AdminPreferences>) => {
      setState((prev) => {
        const next = { ...prev, ...patch };
        try {
          window.localStorage.setItem(storageKey(userId), JSON.stringify(next));
        } catch {
        }
        return next;
      });
    },
    [userId],
  );

  const resetPreferences = useCallback(() => {
    try {
      window.localStorage.removeItem(storageKey(userId));
    } catch {
    }
    setState(DEFAULT_PREFERENCES);
  }, [userId]);

  const value = useMemo(
    () => ({ preferences, setPreferences, resetPreferences }),
    [preferences, setPreferences, resetPreferences],
  );

  return (
    <AdminPreferencesContext.Provider value={value}>
      {children}
    </AdminPreferencesContext.Provider>
  );
}

export function useAdminPreferences(): AdminPreferencesValue {
  const context = useContext(AdminPreferencesContext);
  if (!context) {
    throw new Error(
      "useAdminPreferences must be used inside AdminPreferencesProvider",
    );
  }
  return context;
}

export function useDefaultPageSize(): number {
  return useAdminPreferences().preferences.pageSize;
}

export function usePageSize(): [number, (next: number) => void] {
  const preferred = useDefaultPageSize();
  const [override, setOverride] = usePersistentState<number | null>(
    `${usePathname()}:pageSize`,
    null,
  );
  return [override ?? preferred, setOverride];
}

export function useRefreshOptions(): {
  pollingInterval: number;
  skipPollingIfUnfocused: boolean;
} {
  const { preferences } = useAdminPreferences();
  return {
    pollingInterval: preferences.refreshSeconds * 1000,
    skipPollingIfUnfocused: preferences.pauseRefreshWhenHidden,
  };
}
