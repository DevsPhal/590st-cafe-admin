"use client";

import { shopDate } from "@/lib/shopDate";
import { titleCase } from "@/lib/utils";
import { useCurrentRole } from "@/store/api/useCurrentRole";
import BaristaReportView from "./BaristaReportView";
import { PageShell } from "@/components/common/PageShell";
import { PageHeader } from "@/components/common/PageHeader";
import {
  AdminTopActions,
  Cell,
  DataCard,
  FilterActions,
  FilterPanel,
  Row,
  SelectField,
  SimpleTable,
  StatTile,
  TableState,
  TextField,
} from "@/components/common/AdminKit";
import {
  useGetDailyFinanceQuery,
  useGetDailyReportQuery,
  useGetMonthlyFinanceQuery,
  useGetYearlyFinanceQuery,
} from "@/store/api/reportApi";
import { usePersistentState } from "@/hooks/usePersistentState";

const BARISTA_HEADERS = [
  "Barista",
  "Orders",
  "Cash",
  "Bakong",
  "Total",
] as const;

type Period = "DAILY" | "MONTHLY" | "YEARLY";

function formatUsd(value: number) {
  return `$${Number(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

const todayIso = shopDate;

/**
 * Two API surfaces feed this screen: /api/admin/reports/daily gives the per-barista takings
 * breakdown for one day, and /api/admin/finance/{daily,monthly,yearly} gives money in/out and
 * profit for the chosen period. Both accept a date (or year/month) and default to now.
 */
export default function ReportView() {
  const { isAdmin, isBarista } = useCurrentRole();
  if (isBarista) return <BaristaReportView />;
  if (isAdmin) return <AdminReportView />;
  return null;
}

function AdminReportView() {
  const [date, setDate] = usePersistentState("reports:date", todayIso());
  const [period, setPeriod] = usePersistentState<Period>("reports:period", "DAILY");
  const [year, setYear] = usePersistentState("reports:year", Number(todayIso().slice(0, 4)));
  const [month, setMonth] = usePersistentState("reports:month", Number(todayIso().slice(5, 7)));

  const {
    currentData: report,
    isFetching: isFetchingReport,
    error: reportError,
    refetch: refetchReport,
  } = useGetDailyReportQuery({ date });
  // Only a first load (or a new date) shows placeholders; a background refresh keeps the numbers.
  const isLoadingReport = isFetchingReport && !report;

  const dailyFinance = useGetDailyFinanceQuery({ date }, { skip: period !== "DAILY" });
  const monthlyFinance = useGetMonthlyFinanceQuery(
    { year, month },
    { skip: period !== "MONTHLY" }
  );
  const yearlyFinance = useGetYearlyFinanceQuery({ year }, { skip: period !== "YEARLY" });

  const activeFinance =
    period === "DAILY"
      ? dailyFinance
      : period === "MONTHLY"
      ? monthlyFinance
      : yearlyFinance;
  const finance = activeFinance.currentData;
  const isLoadingFinance = activeFinance.isFetching && !finance;
  const financeValue = (value: number | undefined) => activeFinance.error ? "Unavailable" : isLoadingFinance || !finance ? "..." : formatUsd(Number(value ?? 0));

  const baristas = report?.baristas ?? [];

  return (
    <PageShell>
      <PageHeader
        title="Reports"
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Reports" }]}
        rightSlot={<AdminTopActions />}
      />

      <FilterPanel>
        <SelectField
          label="Finance Period"
          value={period}
          onChange={(e) => { if (e.target.value) setPeriod(e.target.value as Period); }}
        >
          <option value="DAILY">Daily</option>
          <option value="MONTHLY">Monthly</option>
          <option value="YEARLY">Yearly</option>
        </SelectField>

        {period === "DAILY" ? (
          <TextField
            label="Date"
            type="date"
            value={date}
            onChange={(e) => { if (e.target.value) setDate(e.target.value); }}
          />
        ) : null}

        {period !== "DAILY" ? (
          <TextField
            label="Year"
            type="number"
            value={String(year)}
            onChange={(e) => { if (Number(e.target.value) > 0) setYear(Number(e.target.value)); }}
          />
        ) : null}

        {period === "MONTHLY" ? (
          <SelectField
            label="Month"
            value={String(month)}
            onChange={(e) => { if (e.target.value) setMonth(Number(e.target.value)); }}
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={String(m)}>
                {new Date(2000, m - 1).toLocaleString("en-GB", { month: "long" })}
              </option>
            ))}
          </SelectField>
        ) : null}

        <FilterActions onClear={() => {
          const today = todayIso();
          setPeriod("DAILY"); setDate(today); setYear(Number(today.slice(0, 4))); setMonth(Number(today.slice(5, 7)));
        }} onSearch={() => { refetchReport(); activeFinance.refetch(); }} />
      </FilterPanel>

      {activeFinance.error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Could not load the finance summary. <button type="button" className="underline" onClick={() => activeFinance.refetch()}>Retry</button>
      </div>}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatTile
          title="Money In"
          value={financeValue(finance?.totalIn)}
          hint={
            finance && !activeFinance.error
              ? `Cash ${formatUsd(Number(finance.cashIn))} · Bakong ${formatUsd(
                  Number(finance.bakongIn)
                )}`
              : undefined
          }
          tone="green"
        />
        <StatTile
          title="Money Out"
          value={financeValue(finance?.totalOut)}
          hint="Recorded expenses"
          tone="orange"
        />
        <StatTile
          title="Profit"
          value={financeValue(finance?.profit)}
          hint={
            finance ? `${finance.periodStart} → ${finance.periodEnd}` : undefined
          }
          tone={Number(finance?.profit ?? 0) >= 0 ? "green" : "red"}
        />
        <StatTile
          title="Orders on Selected Day"
          value={reportError ? "Unavailable" : isLoadingReport ? "..." : String(report?.totalOrders ?? 0)}
          hint={report && !reportError ? `${date}: ${formatUsd(Number(report.grandTotal))}` : date}
          tone="gray"
        />
      </div>

      <DataCard
        title="Barista Takings"
        meta={`Daily report for ${date}`}
      >
        <SimpleTable headers={[...BARISTA_HEADERS]}>
          <TableState
            colSpan={BARISTA_HEADERS.length}
            isLoading={isLoadingReport}
            error={reportError}
            isEmpty={baristas.length === 0}
            emptyLabel="No barista took any orders on this date."
            onRetry={refetchReport}
          />
          {!isLoadingReport &&
            !reportError &&
            baristas.map((barista, index) => (
              <Row key={barista.baristaId} striped={index % 2 === 1}>
                <Cell className="font-semibold">{titleCase(barista.baristaName)}</Cell>
                <Cell>{barista.totalOrders}</Cell>
                <Cell>{formatUsd(Number(barista.cashTotal))}</Cell>
                <Cell>{formatUsd(Number(barista.bakongTotal))}</Cell>
                <Cell className="font-semibold">
                  {formatUsd(Number(barista.grandTotal))}
                </Cell>
              </Row>
            ))}
          {/* Shop-wide totals as a footer row, so the per-barista figures add up on screen. */}
          {!isLoadingReport && !reportError && baristas.length > 0 ? (
            <Row>
              <Cell className="font-bold">All Baristas</Cell>
              <Cell className="font-bold">{report?.totalOrders ?? 0}</Cell>
              <Cell className="font-bold">
                {formatUsd(Number(report?.cashTotal ?? 0))}
              </Cell>
              <Cell className="font-bold">
                {formatUsd(Number(report?.bakongTotal ?? 0))}
              </Cell>
              <Cell className="font-bold">
                {formatUsd(Number(report?.grandTotal ?? 0))}
              </Cell>
            </Row>
          ) : null}
        </SimpleTable>
      </DataCard>
    </PageShell>
  );
}
