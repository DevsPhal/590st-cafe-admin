"use client";

import toast from "react-hot-toast";
import { Download } from "lucide-react";
import { shopDate } from "@/lib/shopDate";
import { downloadBlob, titleCase } from "@/lib/utils";
import { apiErrorMessage } from "@/store/api/baseApi";
import { formatLocalDate } from "@/lib/dateFormat";
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
  useDownloadReportMutation,
  useGetDailyFinanceQuery,
  useGetDailyReportQuery,
  useGetMonthlyFinanceQuery,
  useGetYearlyFinanceQuery,
} from "@/store/api/reportApi";
import { usePersistentState } from "@/hooks/usePersistentState";
import { useI18n } from "@/contexts/I18nContext";

type Period = "DAILY" | "MONTHLY" | "YEARLY";

const EXPORT_PERIOD = { DAILY: "DAY", MONTHLY: "MONTH", YEARLY: "YEAR" } as const;

// "-$392.50" for a loss, not "$-392.50".
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function formatUsd(value: number) {
  return usd.format(Number(value));
}

const todayIso = shopDate;

export default function ReportView() {
  const { isAdmin, isBarista } = useCurrentRole();
  if (isBarista) return <BaristaReportView />;
  if (isAdmin) return <AdminReportView />;
  return null;
}

function AdminReportView() {
  const { t } = useI18n();
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
  const financeValue = (value: number | undefined) => activeFinance.error ? t("reports.stats.unavailable", "Unavailable") : isLoadingFinance || !finance ? "..." : formatUsd(Number(value ?? 0));

  const [downloadReport, { isLoading: isExporting }] = useDownloadReportMutation();
  const handleExport = async () => {
    try {
      const blob = await downloadReport({ date, period: EXPORT_PERIOD[period], year, month }).unwrap();
      downloadBlob(blob, `report-${date}.xlsx`);
    } catch (err) {
      toast.error(apiErrorMessage(err as never, t("reports.errors.export_failed", "Could not download the report.")));
    }
  };

  const baristas = report?.baristas ?? [];
  const baristaHeaders = [
    t("reports.table.barista", "Barista"),
    t("reports.table.orders", "Orders"),
    t("reports.table.cash", "Cash"),
    "Bakong",
    t("fields.total", "Total"),
  ];

  return (
    <PageShell>
      <PageHeader
        title={t("reports.title", "Reports")}
        breadcrumbs={[{ label: t("breadcrumb.home", "Home"), href: "/" }, { label: t("reports.title", "Reports") }]}
        rightSlot={<AdminTopActions />}
      />

      <FilterPanel>
        <SelectField
          label={t("reports.filters.finance_period", "Finance Period")}
          value={period}
          onChange={(e) => { if (e.target.value) setPeriod(e.target.value as Period); }}
        >
          <option value="DAILY">{t("reports.filters.daily", "Daily")}</option>
          <option value="MONTHLY">{t("reports.filters.monthly", "Monthly")}</option>
          <option value="YEARLY">{t("reports.filters.yearly", "Yearly")}</option>
        </SelectField>

        {period === "DAILY" ? (
          <TextField
            label={t("fields.date", "Date")}
            type="date"
            value={date}
            onChange={(e) => { if (e.target.value) setDate(e.target.value); }}
          />
        ) : null}

        {period !== "DAILY" ? (
          <TextField
            label={t("reports.filters.year", "Year")}
            type="number"
            value={String(year)}
            onChange={(e) => { if (Number(e.target.value) > 0) setYear(Number(e.target.value)); }}
          />
        ) : null}

        {period === "MONTHLY" ? (
          <SelectField
            label={t("reports.filters.month", "Month")}
            value={String(month)}
            onChange={(e) => { if (e.target.value) setMonth(Number(e.target.value)); }}
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={String(m)}>
                {formatLocalDate(new Date(2000, m - 1), { month: "long" })}
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
        {t("reports.errors.finance_load_failed", "Could not load the finance summary.")} <button type="button" className="underline" onClick={() => activeFinance.refetch()}>{t("actions.retry", "Retry")}</button>
      </div>}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatTile
          title={t("reports.stats.money_in", "Money In")}
          value={financeValue(finance?.totalIn)}
          hint={
            finance && !activeFinance.error
              ? t("reports.stats.money_in_hint", "Cash {cash} · Bakong {bakong}", {
                  cash: formatUsd(Number(finance.cashIn)),
                  bakong: formatUsd(Number(finance.bakongIn)),
                })
              : undefined
          }
          tone="green"
        />
        <StatTile
          title={t("reports.stats.money_out", "Money Out")}
          value={financeValue(finance?.totalOut)}
          hint={t("reports.stats.money_out_hint", "Recorded expenses")}
          tone="orange"
        />
        <StatTile
          title={t("reports.stats.profit", "Profit")}
          value={financeValue(finance?.profit)}
          hint={
            finance ? `${finance.periodStart} → ${finance.periodEnd}` : undefined
          }
          tone={Number(finance?.profit ?? 0) >= 0 ? "green" : "red"}
        />
        <StatTile
          title={t("reports.stats.orders_selected_day", "Orders on Selected Day")}
          value={reportError ? t("reports.stats.unavailable", "Unavailable") : isLoadingReport ? "..." : String(report?.totalOrders ?? 0)}
          hint={report && !reportError ? `${date}: ${formatUsd(Number(report.grandTotal))}` : date}
          tone="gray"
        />
      </div>

      <DataCard
        title={t("reports.barista_takings.title", "Barista Takings")}
        meta={t("reports.barista_takings.meta", "Daily report for {date}", { date })}
        actions={
          <button type="button" onClick={handleExport} disabled={isExporting} className="btn_outline_black">
            {isExporting ? t("reports.exporting", "Exporting...") : t("reports.export", "Export Excel")}
            <Download />
          </button>
        }
      >
        <SimpleTable headers={baristaHeaders}>
          <TableState
            colSpan={baristaHeaders.length}
            isLoading={isLoadingReport}
            error={reportError}
            isEmpty={baristas.length === 0}
            emptyLabel={t("reports.barista_takings.empty", "No barista took any orders on this date.")}
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
          {!isLoadingReport && !reportError && baristas.length > 0 ? (
            <Row>
              <Cell className="font-bold">{t("reports.barista_takings.all_baristas", "All Baristas")}</Cell>
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
