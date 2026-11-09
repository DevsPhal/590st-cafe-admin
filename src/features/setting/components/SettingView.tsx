"use client";

import { useState } from "react";
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
  MoneyField,
  SkeletonBlock,
  StatusBadge,
} from "@/components/common/AdminKit";
import { useGetCurrentUserQuery } from "@/store/api/authApi";
import { useCurrentRole } from "@/store/api/useCurrentRole";
import {
  useGetExchangeRateQuery,
  useUpdateExchangeRateMutation,
} from "@/store/api/reportApi";
import { useI18n } from "@/contexts/I18nContext";
import { enumLabel } from "@/lib/enumLabel";
import { localeInfo } from "@/contexts/locales";
import {
  DEFAULT_PREFERENCES,
  PAGE_SIZE_OPTIONS,
  REFRESH_SECONDS_OPTIONS,
  useAdminPreferences,
} from "@/contexts/AdminPreferencesContext";
import { statusTone } from "@/features/user/components/UserManagementView";
import { formatAmount } from "@/lib/moneyInput";
import { exchangeRateSchema } from "@/lib/formSchemas";
import { formatLocalDate } from "@/lib/dateFormat";
import { useFormErrors } from "@/hooks/useFormErrors";

// Same languages as the header selector, listed English first here.
const LANGUAGES = (["en", "kh"] as const).map(localeInfo);

function refreshLabel(seconds: number, t: ReturnType<typeof useI18n>["t"]) {
  if (seconds === 0) return t("settings.refresh.off", "Off");
  if (seconds < 60) return t("settings.refresh.seconds", "{count}s", { count: seconds });
  return t("settings.refresh.minutes", "{count} min", { count: seconds / 60 });
}

export default function Settings() {
  const {
    data: currentUser,
    isLoading: isLoadingUser,
    isFetching: isFetchingUser,
    error: userError,
    refetch: refetchUser,
  } = useGetCurrentUserQuery();
  const { isAdmin } = useCurrentRole();
  const { locale, setLocale, t } = useI18n();
  const { preferences, setPreferences, resetPreferences } = useAdminPreferences();

  const rateQuery = useGetExchangeRateQuery(undefined, { skip: !isAdmin });

  const [updateRate, { isLoading: isSavingRate }] = useUpdateExchangeRateMutation();

  const rate = rateQuery.data;
  const [khrPerUsd, setKhrPerUsd] = useState("");
  const [marketRate, setMarketRate] = useState("");
  const validation = useFormErrors(exchangeRateSchema, { khrPerUsd, marketRate });

  const [seededFrom, setSeededFrom] = useState<typeof rate>(undefined);
  if (rate && rate !== seededFrom) {
    setSeededFrom(rate);
    setKhrPerUsd(formatAmount(String(rate.khrPerUsdRate), 0));
    setMarketRate(rate.marketRate != null ? formatAmount(String(rate.marketRate), 0) : "");
  }

  const handleSaveRate = async () => {
    const parsed = validation.validate();
    if (!parsed) return;

    try {
      await updateRate({ khrPerUsdRate: parsed.khrPerUsd, marketRate: parsed.marketRate }).unwrap();
      toast.success(t("settings.exchange.updated", "Exchange rate updated"));
    } catch (err) {
      validation.showServerError(err, t("settings.exchange.update_failed", "Could not update the exchange rate."));
    }
  };

  const rateUpdatedAt = rate
    ? formatLocalDate(new Date(rate.updatedAt), {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  const isDefaultPreferences =
    preferences.pageSize === DEFAULT_PREFERENCES.pageSize &&
    preferences.refreshSeconds === DEFAULT_PREFERENCES.refreshSeconds &&
    preferences.pauseRefreshWhenHidden === DEFAULT_PREFERENCES.pauseRefreshWhenHidden;

  return (
    <PageShell>
      <PageHeader
        title={t("settings.title", "Settings")}
        breadcrumbs={[
          { label: t("breadcrumb.home", "Home"), href: "/" },
          { label: t("settings.title", "Settings") },
        ]}
        rightSlot={<AdminTopActions />}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="space-y-6 lg:col-span-1">
          <DataCard title={t("settings.account.title", "Signed-in Account")}>
            {isLoadingUser ? (
              <div className="space-y-4 p-2 pb-4" role="status" aria-label={t("settings.account.loading_aria", "Loading your account")}>
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
                fallback={t("settings.account.load_failed", "Could not load your account.")}
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
                      <StatusBadge label={enumLabel(t, "role", currentUser.role)} tone="neutral" />
                      <StatusBadge label={enumLabel(t, "user_status", currentUser.status)} tone={statusTone(currentUser.status)} />
                    </div>
                  </div>
                </div>
                <Link href="/profile" className="btn_outline_black w-full">
                  <UserRound />
                  {t("settings.account.edit_profile", "Edit my profile")}
                </Link>
              </div>
            )}
          </DataCard>
        </section>

        <section className="space-y-6 lg:col-span-2">
          <DataCard
            title={t("settings.display.title", "Display Preferences")}
            meta={t(
              "settings.display.meta",
              "Saved for your account in this browser, and applied the next time a screen loads."
            )}
          >
            <div className="space-y-7 p-2 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <Languages className="h-4 w-4 text-gray-500" />
                  <label className="text-sm font-medium text-gray-700">
                    {t("settings.language.label", "Language")}
                  </label>
                </div>
                <p className="mt-1 text-xs text-gray-400">
                  {t(
                    "settings.language.help",
                    "Same setting as the flag in the header — changes the sidebar and page labels."
                  )}
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
                  <label className="text-sm font-medium text-gray-700">
                    {t("settings.page_size.label", "Rows per page")}
                  </label>
                </div>
                <p className="mt-1 text-xs text-gray-400">
                  {t(
                    "settings.page_size.help",
                    "What the Products, Orders, Inventory, Staff and Users tables open with. Each screen's own footer still overrides it while you are on that screen."
                  )}
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
                  <label className="text-sm font-medium text-gray-700">
                    {t("settings.refresh.label", "Live refresh")}
                  </label>
                </div>
                <p className="mt-1 text-xs text-gray-400">
                  {t(
                    "settings.refresh.help",
                    "How often the Dashboard, Orders, Payments, Users and Audit screens re-poll the API. The barista queue keeps its own faster cadence so orders are never missed."
                  )}
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
                      {refreshLabel(option, t)}
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
                    {t(
                      "settings.refresh.pause",
                      "Pause refreshing while this tab is in the background"
                    )}
                    <span className="mt-0.5 block text-xs text-gray-400">
                      {t(
                        "settings.refresh.pause_help",
                        "Saves API calls on a terminal left open all day."
                      )}
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
                    toast.success(t("settings.display.reset_toast", "Preferences reset to defaults"));
                  }}
                  disabled={isDefaultPreferences}
                >
                  <RotateCcw />
                  {t("settings.display.reset", "Reset to defaults")}
                </button>
              </div>
            </div>
          </DataCard>

          {isAdmin ? (
            <DataCard
              title={t("settings.exchange.title", "Bakong Exchange Rate")}
              meta={t(
                "settings.exchange.meta",
                "Used to price KHR QR payments. Stored on the server and shared by all staff."
              )}
            >
              {rateQuery.isLoading ? (
                <div className="space-y-6 p-2 pb-4" role="status" aria-label={t("settings.exchange.loading_aria", "Loading the exchange rate")}>
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
                  fallback={t("settings.exchange.load_failed", "Could not load the exchange rate.")}
                  onRetry={() => rateQuery.refetch()}
                  isRetrying={rateQuery.isFetching}
                />
              ) : (
                <div className="space-y-6 p-2 pb-4">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <MoneyField
                      label={t("settings.exchange.applied", "KHR per USD (applied)")}
                      currency="KHR"
                      value={khrPerUsd}
                      onValueChange={setKhrPerUsd}
                      placeholder="4100"
                      required
                      error={validation.errors.khrPerUsd}
                    />
                    <MoneyField
                      label={t("settings.exchange.market", "Market rate (reference only)")}
                      currency="KHR"
                      value={marketRate}
                      onValueChange={setMarketRate}
                      placeholder="4050"
                      error={validation.errors.marketRate}
                    />
                  </div>

                  {rate ? (
                    <p className="text-xs text-gray-400">
                      {rate.updatedByAdminName
                        ? t("settings.exchange.last_updated_by", "Last updated {date} by {name}", {
                            date: rateUpdatedAt,
                            name: rate.updatedByAdminName,
                          })
                        : t("settings.exchange.last_updated", "Last updated {date}", {
                            date: rateUpdatedAt,
                          })}
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
                      {isSavingRate ? t("states.saving", "Saving...") : t("settings.exchange.save", "Save Rate")}
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
