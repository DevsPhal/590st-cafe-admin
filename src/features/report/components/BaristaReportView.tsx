"use client";

import { PageShell } from "@/components/common/PageShell";
import { PageHeader } from "@/components/common/PageHeader";
import { AdminTopActions, DataCard, ErrorState, FilterActions, FilterPanel, SkeletonBlock, StatTile, TextField } from "@/components/common/AdminKit";
import { useRefreshOptions } from "@/contexts/AdminPreferencesContext";
import { shopDate } from "@/lib/shopDate";
import { useGetOwnDailyReportQuery } from "@/store/api/reportApi";
import type { Numeric } from "@/store/api/types";
import { usePersistentState } from "@/hooks/usePersistentState";

export default function BaristaReportView() {
  const [date, setDate] = usePersistentState("barista-report:date", shopDate);
  const refresh = useRefreshOptions();
  const { currentData: report, isFetching, error, refetch } = useGetOwnDailyReportQuery({ date }, refresh);
  const money = (value: Numeric | undefined) => `$${Number(value ?? 0).toFixed(2)}`;

  return (
    <PageShell>
      <PageHeader title="My Daily Report" breadcrumbs={[{ label: "Home", href: "/" }, { label: "Reports" }]} rightSlot={<AdminTopActions />} />
      <FilterPanel>
        <TextField label="Date" type="date" value={date} onChange={(event) => { if (event.target.value) setDate(event.target.value); }} />
        <FilterActions onClear={() => setDate(shopDate())} onSearch={refetch} />
      </FilterPanel>
      <DataCard title="My Sales" meta={date}>
        {/* A background refresh keeps the last numbers; placeholders only before the first answer. */}
        {!report && error ? (
          <div className="p-4">
            <ErrorState error={error} fallback="Could not load your daily report." onRetry={refetch} isRetrying={isFetching} />
          </div>
        ) : !report ? (
          <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-4" role="status" aria-label="Loading your daily report">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-3 rounded-xl bg-white p-5">
                <SkeletonBlock className="h-4 w-24" />
                <SkeletonBlock className="h-8 w-20" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-4">
            <StatTile title="Paid Orders" value={String(report.totalOrders)} tone="gray" />
            <StatTile title="Cash" value={money(report.cashTotal)} tone="gray" />
            <StatTile title="Bakong" value={money(report.bakongTotal)} tone="gray" />
            <StatTile title="Total Sales" value={money(report.grandTotal)} tone="green" />
          </div>
        )}
        <p className="px-4 pb-4 text-sm text-muted-foreground">Sales attributed to your account for the selected day.</p>
      </DataCard>
    </PageShell>
  );
}
