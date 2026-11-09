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
import { translate } from "@/contexts/translate";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

export function unwrap<T>(response: ApiEnvelope<T>): T {
  return response.data;
}

export function apiErrorMessage(
  error: FetchBaseQueryError | undefined,
  fallback = translate("errors.generic", "Something went wrong. Please try again."),
): string {
  if (!error) return fallback;
  if ("status" in error && error.status === "FETCH_ERROR") {
    return translate("errors.unreachable", "Cannot reach the server. Please check your connection and try again.");
  }
  const body = (error as { data?: Partial<ApiErrorBody> }).data;
  return body?.message ?? fallback;
}

/**
 * The API's per-field messages, keyed by request field path ("fullName", "items[0].quantity"),
 * so a form can show each one under its input. Empty when the error isn't about specific fields.
 */
export function apiFieldErrors(error: unknown): Record<string, string> {
  const body = (error as { data?: Partial<ApiErrorBody> } | undefined)?.data;
  const fields: Record<string, string> = {};
  for (const entry of Array.isArray(body?.errors) ? body.errors : []) {
    if (entry?.field && entry.message && !(entry.field in fields)) fields[entry.field] = entry.message;
  }
  return fields;
}

const rawBaseQuery = fetchBaseQuery({
  baseUrl: API_URL,
  prepareHeaders: (headers) => {
    const token = getAccessToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return headers;
  },
});

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
        translate("errors.system_unavailable", "System unavailable — retrying automatically."),
        {
          id: SERVER_STATUS_TOAST_ID,
          duration: Infinity,
        },
      );
    }
    return;
  }
  if (serverDown) {
    serverDown = false;
    toast.success(translate("errors.connection_restored", "Connection restored"), {
      id: SERVER_STATUS_TOAST_ID,
      duration: 3000,
    });
  }
}

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

export const baseApi = createApi({
  reducerPath: "api",
  baseQuery: baseQueryWithStatus,
  refetchOnFocus: true,
  refetchOnReconnect: true,
  refetchOnMountOrArgChange: 30,
  tagTypes: [
    "Table",
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
    "Recipe",
    "InventoryReport",
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
