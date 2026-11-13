import {
  createApi,
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from "@reduxjs/toolkit/query/react";

import toast from "react-hot-toast";

import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setTokens,
} from "@/lib/authStorage";
import type { ApiEnvelope, ApiErrorBody, AuthTokenResponse } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

/**
 * Every controller wraps its payload in `ApiResponse<T>`, so each endpoint unwraps with this
 * rather than repeating `(r) => r.data` inline.
 */
export function unwrap<T>(response: ApiEnvelope<T>): T {
  return response.data;
}

/** Pulls the human-readable message out of an `ErrorResponse` body for toasts. */
export function apiErrorMessage(
  error: FetchBaseQueryError | undefined,
  fallback = "Something went wrong. Please try again.",
): string {
  if (!error) return fallback;
  if ("status" in error && error.status === "FETCH_ERROR") {
    return "Cannot reach the server. Please check your connection and try again.";
  }
  const body = (error as { data?: Partial<ApiErrorBody> }).data;
  return body?.message ?? fallback;
}

const rawBaseQuery = fetchBaseQuery({
  baseUrl: API_URL,
  prepareHeaders: (headers) => {
    const token = getAccessToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return headers;
  },
});

/// The base query with automatic token refresh and a single app-wide "server down" toast. It wraps
const refreshLock = {
  pending: null as Promise<void> | null,
  isLocked() {
    return this.pending !== null;
  },
  waitForUnlock() {
    return this.pending ?? Promise.resolve();
  },
  acquire() {
    let release!: () => void;
    this.pending = new Promise<void>((resolve) => {
      release = () => {
        this.pending = null;
        resolve();
      };
    });
    return release;
  },
};

// A single toast that appears when the API is unreachable, and disappears once it is reachable again. It is not a "retry" toast — the base query itself retries automatically, so this is just a status indicator.
const SERVER_STATUS_TOAST_ID = "server-status";
let serverDown = false;

function isServerDown(error: FetchBaseQueryError | undefined): boolean {
  if (!error) return false;
  return (
    error.status === "FETCH_ERROR" ||
    error.status === 502 ||
    error.status === 503 ||
    error.status === 504
  );
}

function trackServerStatus(error: FetchBaseQueryError | undefined): void {
  if (typeof window === "undefined") return;
  if (isServerDown(error)) {
    if (!serverDown) {
      serverDown = true;
      toast.error(
        "The system is unavailable right now. We'll keep retrying — your data will load once it's back.",
        {
          id: SERVER_STATUS_TOAST_ID,
          duration: Infinity,
        },
      );
    }
    return;
  }
  // Any real answer from the server, even a 4xx, means it is reachable again.
  if (serverDown) {
    serverDown = false;
    toast.success("Connection restored", {
      id: SERVER_STATUS_TOAST_ID,
      duration: 3000,
    });
  }
}

/**
 * Wraps the base query so an expired access token is refreshed once and the original request
 * retried. A failed refresh clears the session and sends the user to the login page.
 */
const baseQueryWithStatus: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  const result = await baseQueryWithReauth(args, api, extraOptions);
  trackServerStatus(result.error);
  return result;
};

const baseQueryWithReauth: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  await refreshLock.waitForUnlock();
  let result = await rawBaseQuery(args, api, extraOptions);

  if (result.error?.status !== 401) return result;

  if (refreshLock.isLocked()) {
    // Another request is already refreshing — wait for it, then retry with the new token.
    await refreshLock.waitForUnlock();
    return rawBaseQuery(args, api, extraOptions);
  }

  const release = refreshLock.acquire();
  try {
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      forceLogout();
      return result;
    }

    const refreshResult = await rawBaseQuery(
      {
        url: "/api/auth/refresh-token",
        method: "POST",
        body: { refreshToken },
      },
      api,
      extraOptions,
    );

    const tokens = (
      refreshResult.data as ApiEnvelope<AuthTokenResponse> | undefined
    )?.data;
    if (!tokens?.accessToken) {
      forceLogout();
      return result;
    }

    setTokens(tokens);
    result = await rawBaseQuery(args, api, extraOptions);
  } finally {
    release();
  }

  return result;
};

function forceLogout(): void {
  clearTokens();
  if (
    typeof window !== "undefined" &&
    !window.location.pathname.startsWith("/auth")
  ) {
    window.location.href = "/auth/login";
  }
}

/**
 * Single API slice; each domain file injects its own endpoints so the store stays one cache
 * and cross-domain invalidation (an order changing inventory, say) actually works.
 */
export const baseApi = createApi({
  reducerPath: "api",
  baseQuery: baseQueryWithStatus,
  refetchOnFocus: true,
  refetchOnReconnect: true,
  refetchOnMountOrArgChange: 30,
  tagTypes: [
    "Attendance",
    "ContactMessage",
    "Auth",
    "Product",
    "Variant",
    "ProductExtra",
    "Extra",
    "Category",
    "Inventory",
    "StockMovement",
    "Order",
    "OrderHistory",
    "StaffCall",
    "User",
    "Admin",
    "Barista",
    "Event",
    "Banner",
    "Report",
    "Finance",
    "ExchangeRate",
  ],
  endpoints: () => ({}),
});
