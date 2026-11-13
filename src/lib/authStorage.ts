import type { AuthTokenResponse } from "@/store/api/types";
import { clearPersistentState } from "@/hooks/usePersistentState";

const ACCESS_TOKEN_KEY = "authToken";
const REFRESH_TOKEN_KEY = "refreshToken";

function canUseStorage(): boolean {
  return typeof window !== "undefined";
}

function activeStorage(): Storage {
  return window.sessionStorage.getItem(REFRESH_TOKEN_KEY)
    ? window.sessionStorage
    : window.localStorage;
}

export function getAccessToken(): string | null {
  if (!canUseStorage()) return null;
  try {
    return (
      window.localStorage.getItem(ACCESS_TOKEN_KEY) ??
      window.sessionStorage.getItem(ACCESS_TOKEN_KEY)
    );
  } catch {
    return null;
  }
}

export function getRefreshToken(): string | null {
  if (!canUseStorage()) return null;
  try {
    return (
      window.localStorage.getItem(REFRESH_TOKEN_KEY) ??
      window.sessionStorage.getItem(REFRESH_TOKEN_KEY)
    );
  } catch {
    return null;
  }
}

export function setTokens(tokens: AuthTokenResponse, remember?: boolean): void {
  if (!canUseStorage()) return;
  try {
    const storage =
      remember === undefined
        ? activeStorage()
        : remember
          ? window.localStorage
          : window.sessionStorage;
    const other =
      storage === window.localStorage
        ? window.sessionStorage
        : window.localStorage;
    other.removeItem(ACCESS_TOKEN_KEY);
    other.removeItem(REFRESH_TOKEN_KEY);
    storage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
    storage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
  } catch {
  }
}

export function clearTokens(): void {
  if (!canUseStorage()) return;
  clearPersistentState();
  try {
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    window.localStorage.removeItem(REFRESH_TOKEN_KEY);
    window.sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    window.sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  } catch {
  }
}

export function isAuthenticated(): boolean {
  return getAccessToken() !== null;
}
