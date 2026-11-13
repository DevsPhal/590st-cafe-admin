"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { usePathname } from "next/navigation";
import { useGetCurrentUserQuery } from "@/store/api/authApi";
import { usePersistentState } from "@/hooks/usePersistentState";

/** Kept a subset of PAGE_SIZE_CHOICES in AdminKit's PaginationFooter, so the size a screen
 *  opens with is always one the footer can also switch back to. */
export const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

/** 0 means "don't poll" — the screens fall back to manual refresh. */
export const REFRESH_SECONDS_OPTIONS = [0, 15, 30, 60, 120] as const;

export interface AdminPreferences {
  /** Rows per page the list screens open with. */
  pageSize: number;
  /** How often the live screens (dashboard, orders, payments, queue) re-poll the API. */
  refreshSeconds: number;
  /** Pause polling while the tab is in the background, to save the API round trips. */
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

/**
 * Keyed by account id so two people sharing a terminal don't inherit each other's settings.
 * Falls back to a shared key only before /api/users/me has resolved.
 */
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
      // Validate rather than trust: a stale key from an older build (or a hand-edited value)
      // must not put an unusable page size into every list query.
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

/**
 * Per-account display preferences, held in this browser. Mounted inside the admin shell (below
 * AuthGuard), so it only ever renders client-side and the localStorage read cannot produce a
 * hydration mismatch.
 */
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

  // The account id arrives one render after mount, so re-read under the real key once it does.
  useEffect(() => {
    setState(read(userId));
  }, [userId]);

  const setPreferences = useCallback(
    (patch: Partial<AdminPreferences>) => {
      setState((prev) => {
        const next = { ...prev, ...patch };
        try {
          window.localStorage.setItem(storageKey(userId), JSON.stringify(next));
        } catch {
          // Private mode or a full quota — the setting still applies for this session.
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
      // Nothing to clean up if storage is unavailable.
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

/** The page size a list screen should open with. */
export function useDefaultPageSize(): number {
  return useAdminPreferences().preferences.pageSize;
}

//it the real time, the unseen count is the total count minus the last-seen count. The last-seen count is stored in localStorage so it persists across tabs and reloads. The unseen count is undefined until the first poll returns a real count, so the badge doesn't flash "0" on first load.
export function usePageSize(): [number, (next: number) => void] {
  const preferred = useDefaultPageSize();
  // Kept per screen across a refresh, like the page number beside it.
  const [override, setOverride] = usePersistentState<number | null>(
    `${usePathname()}:pageSize`,
    null,
  );
  return [override ?? preferred, setOverride];
}

/**
 * Spread straight into an RTK Query hook's options — `{ ...useRefreshOptions() }`. Returns
 * `pollingInterval: 0` when the user has turned live refresh off, which RTK Query reads as
 * "never poll".
 */
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
