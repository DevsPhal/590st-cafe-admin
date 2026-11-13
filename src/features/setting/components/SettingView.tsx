"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  Gauge,
  Languages,
  Loader2,
  RotateCcw,
  Rows3,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { PageShell } from "@/components/common/PageShell";
import { PageHeader } from "@/components/common/PageHeader";
import {
  AdminTopActions,
  DataCard,
  ErrorState,
  SkeletonBlock,
  StatusBadge,
} from "@/components/common/AdminKit";
import { apiErrorMessage } from "@/store/api/baseApi";
import { useGetCurrentUserQuery } from "@/store/api/authApi";
import { useCurrentRole } from "@/store/api/useCurrentRole";
import {
  useGetExchangeRateQuery,
  useUpdateExchangeRateMutation,
} from "@/store/api/reportApi";
import { useI18n } from "@/contexts/I18nContext";
import {
  DEFAULT_PREFERENCES,
  PAGE_SIZE_OPTIONS,
  REFRESH_SECONDS_OPTIONS,
  useAdminPreferences,
} from "@/contexts/AdminPreferencesContext";
import { humanise, statusTone } from "@/features/user/components/UserManagementView";

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "kh", label: "ខ្មែរ" },
] as const;

function refreshLabel(seconds: number) {
  if (seconds === 0) return "Off";
  if (seconds < 60) return `${seconds}s`;
  return `${seconds / 60} min`;
}

/**
 * Two kinds of setting live here, and the page keeps them apart on purpose:
 *
 *  - Server settings (the Bakong rate) — shared by everyone, admin-only, stored in the API.
 *  - Browser settings (language, page size, refresh) — per account, per device, held in
 *    localStorage and read back by the screens they affect.
 *
 * Anything that cannot be honoured is not offered. The display-theme switch that used to sit
 * here was one of those: the admin UI paints its own light palette, and the provider runs with
 * `enableSystem={false}`, so none of its three buttons changed anything on screen.
 */
export default function Settings() {
  const {
    data: currentUser,
    isLoading: isLoadingUser,
    isFetching: isFetchingUser,
    error: userError,
    refetch: refetchUser,
  } = useGetCurrentUserQuery();
  const { isAdmin } = useCurrentRole();
  const { locale, setLocale } = useI18n();
  const { preferences, setPreferences, resetPreferences } = useAdminPreferences();

  // An unreachable API is reported once, app-wide, by a toast (see baseApi) — not per page.
  const rateQuery = useGetExchangeRateQuery(undefined, { skip: !isAdmin });

  const [updateRate, { isLoading: isSavingRate }] = useUpdateExchangeRateMutation();

  const rate = rateQuery.data;
  const [khrPerUsd, setKhrPerUsd] = useState("");
  const [marketRate, setMarketRate] = useState("");

  useEffect(() => {
    if (rate) {
      setKhrPerUsd(String(rate.khrPerUsdRate));
      setMarketRate(rate.marketRate != null ? String(rate.marketRate) : "");
    }
  }, [rate]);

  const handleSaveRate = async () => {
    const value = Number(khrPerUsd);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Enter a rate greater than zero");
      return;
    }
    const market = marketRate.trim() ? Number(marketRate) : undefined;
    if (market !== undefined && (!Number.isFinite(market) || market <= 0)) {
      toast.error("Market rate must be greater than zero");
      return;
    }

    try {
      await updateRate({ khrPerUsdRate: value, marketRate: market }).unwrap();
      toast.success("Exchange rate updated");
    } catch (err) {
      toast.error(apiErrorMessage(err as never, "Could not update the exchange rate."));
    }
  };

  const isDefaultPreferences =
    preferences.pageSize === DEFAULT_PREFERENCES.pageSize &&
    preferences.refreshSeconds === DEFAULT_PREFERENCES.refreshSeconds &&
    preferences.pauseRefreshWhenHidden === DEFAULT_PREFERENCES.pauseRefreshWhenHidden;

  return (
    <PageShell>
      <PageHeader
        title="Settings"
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Settings" }]}
        rightSlot={<AdminTopActions />}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="space-y-6 lg:col-span-1">
          <DataCard title="Signed-in Account">
            {isLoadingUser ? (
              <div className="space-y-4 p-2 pb-4" role="status" aria-label="Loading your account">
                <div className="flex items-start gap-3">
                  <SkeletonBlock className="h-10 w-10 shrink-0 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <SkeletonBlock className="h-4 w-2/3" />
                    <SkeletonBlock className="h-3 w-1/2" />
                    <div className="flex gap-2 pt-1">
                      <SkeletonBlock className="h-5 w-16 rounded-full" />
                      <SkeletonBlock className="h-5 w-16 rounded-full" />
                    </div>
                  </div>
                </div>
                <SkeletonBlock className="h-10 w-full" />
              </div>
            ) : userError || !currentUser ? (
              <ErrorState
                error={userError}
                fallback="Could not load your account."
                onRetry={() => refetchUser()}
                isRetrying={isFetchingUser}
              />
            ) : (
              <div className="space-y-4 p-2 pb-4">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="h-10 w-10 shrink-0 text-lime-500" />
                  <div className="min-w-0">
                    <h4 className="truncate text-sm font-semibold text-gray-900">{currentUser.fullName}</h4>
                    <p className="mt-1 truncate text-xs text-gray-500">{currentUser.email}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <StatusBadge label={humanise(currentUser.role)} tone="neutral" />
                      <StatusBadge label={humanise(currentUser.status)} tone={statusTone(currentUser.status)} />
                    </div>
                  </div>
                </div>
                <Link href="/profile" className="btn_outline_black w-full">
                  <UserRound />
                  Edit my profile
                </Link>
              </div>
            )}
          </DataCard>
        </section>

        <section className="space-y-6 lg:col-span-2">
          <DataCard
            title="Display Preferences"
            meta="Saved for your account in this browser, and applied the next time a screen loads."
          >
            <div className="space-y-7 p-2 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <Languages className="h-4 w-4 text-gray-500" />
                  <label className="text-sm font-medium text-gray-700">Language</label>
                </div>
                <p className="mt-1 text-xs text-gray-400">
                  Same setting as the flag in the header — changes the sidebar and page labels.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  {LANGUAGES.map((language) => (
                    <button
                      key={language.code}
                      type="button"
                      onClick={() => setLocale(language.code)}
                      aria-pressed={locale === language.code}
                      className={
                        locale === language.code ? "btn_primary_black" : "btn_outline_black"
                      }
                    >
                      {language.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <Rows3 className="h-4 w-4 text-gray-500" />
                  <label className="text-sm font-medium text-gray-700">Rows per page</label>
                </div>
                <p className="mt-1 text-xs text-gray-400">
                  What the Products, Orders, Inventory, Staff and Users tables open with. Each
                  screen&apos;s own footer still overrides it while you are on that screen.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  {PAGE_SIZE_OPTIONS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setPreferences({ pageSize: option })}
                      aria-pressed={preferences.pageSize === option}
                      className={
                        preferences.pageSize === option
                          ? "btn_primary_black"
                          : "btn_outline_black"
                      }
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <Gauge className="h-4 w-4 text-gray-500" />
                  <label className="text-sm font-medium text-gray-700">Live refresh</label>
                </div>
                <p className="mt-1 text-xs text-gray-400">
                  How often the Dashboard, Orders, Payments, Users and Audit screens re-poll the
                  API. The barista queue keeps its own faster cadence so orders are never missed.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  {REFRESH_SECONDS_OPTIONS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setPreferences({ refreshSeconds: option })}
                      aria-pressed={preferences.refreshSeconds === option}
                      className={
                        preferences.refreshSeconds === option
                          ? "btn_primary_black"
                          : "btn_outline_black"
                      }
                    >
                      {refreshLabel(option)}
                    </button>
                  ))}
                </div>

                <label className="mt-4 flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={preferences.pauseRefreshWhenHidden}
                    onChange={(e) =>
                      setPreferences({ pauseRefreshWhenHidden: e.target.checked })
                    }
                    className="mt-0.5 h-4 w-4 shrink-0 accent-black"
                  />
                  <span className="text-sm text-gray-700">
                    Pause refreshing while this tab is in the background
                    <span className="mt-0.5 block text-xs text-gray-400">
                      Saves API calls on a terminal left open all day.
                    </span>
                  </span>
                </label>
              </div>

              <div className="flex justify-end border-t border-gray-100 pt-6">
                <button
                  type="button"
                  className="btn_outline_black"
                  onClick={() => {
                    resetPreferences();
                    toast.success("Preferences reset to defaults");
                  }}
                  disabled={isDefaultPreferences}
                >
                  <RotateCcw />
                  Reset to defaults
                </button>
              </div>
            </div>
          </DataCard>

          {isAdmin ? (
            <DataCard
              title="Bakong Exchange Rate"
              meta="Used to price KHR QR payments. Stored on the server and shared by all staff."
            >
              {rateQuery.isLoading ? (
                <div className="space-y-6 p-2 pb-4" role="status" aria-label="Loading the exchange rate">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {[0, 1].map((i) => (
                      <div key={i} className="space-y-2">
                        <SkeletonBlock className="h-4 w-32" />
                        <SkeletonBlock className="h-10 w-full" />
                      </div>
                    ))}
                  </div>
                  <SkeletonBlock className="h-3 w-48" />
                </div>
              ) : rateQuery.error ? (
                <ErrorState
                  error={rateQuery.error}
                  fallback="Could not load the exchange rate."
                  onRetry={() => rateQuery.refetch()}
                  isRetrying={rateQuery.isFetching}
                />
              ) : (
                <div className="space-y-6 p-2 pb-4">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <label className="block">
                      <span className="text-sm font-medium text-gray-700">
                        KHR per USD (applied)
                      </span>
                      <input
                        type="number"
                        value={khrPerUsd}
                        onChange={(e) => setKhrPerUsd(e.target.value)}
                        className="mt-2 h-10 w-full rounded-md border border-gray-300 px-3 text-sm outline-none"
                        placeholder="4100"
                      />
                    </label>
                    <label className="block">
                      <span className="text-sm font-medium text-gray-700">
                        Market rate (reference only)
                      </span>
                      <input
                        type="number"
                        value={marketRate}
                        onChange={(e) => setMarketRate(e.target.value)}
                        className="mt-2 h-10 w-full rounded-md border border-gray-300 px-3 text-sm outline-none"
                        placeholder="4050"
                      />
                    </label>
                  </div>

                  {rate ? (
                    <p className="text-xs text-gray-400">
                      Last updated{" "}
                      {new Date(rate.updatedAt).toLocaleString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {rate.updatedByAdminName ? ` by ${rate.updatedByAdminName}` : ""}
                    </p>
                  ) : null}

                  <div className="flex justify-end border-t border-gray-100 pt-6">
                    <button
                      type="button"
                      onClick={handleSaveRate}
                      disabled={isSavingRate}
                      className="btn_primary_black"
                    >
                      {isSavingRate ? <Loader2 className="animate-spin" /> : null}
                      {isSavingRate ? "Saving..." : "Save Rate"}
                    </button>
                  </div>
                </div>
              )}
            </DataCard>
          ) : null}
        </section>
      </div>
    </PageShell>
  );
}
