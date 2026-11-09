"use client";

import Link from "next/link";
import { useCallback, useMemo } from "react";
import { PageShell } from "@/components/common/PageShell";
import { PageHeader } from "@/components/common/PageHeader";
import { AdminTopActions, StatTile } from "@/components/common/AdminKit";
import { AlertTriangle, ArrowRight, Banknote, Clock3, PackageMinus, Receipt } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { apiErrorMessage } from "@/store/api/baseApi";
import { useListLowStockQuery } from "@/store/api/inventoryApi";
import { useListOrdersQuery } from "@/store/api/orderApi";
import {
  useGetDailyFinanceQuery,
  useGetDailyReportQuery,
  useGetWeeklyReportsQuery,
} from "@/store/api/reportApi";
import { shopDate } from "@/lib/shopDate";
import { titleCase } from "@/lib/utils";
import { formatLocalDate } from "@/lib/dateFormat";
import type { OrderResponse } from "@/store/api/types";
import { useRefreshOptions } from "@/contexts/AdminPreferencesContext";
import { useStaffOrderAlerts } from "@/hooks/useStaffOrderAlerts";
import { useInventoryAlerts } from "@/hooks/useInventoryAlerts";
import { useI18n } from "@/contexts/I18nContext";
import { enumLabel } from "@/lib/enumLabel";
import { Loader } from "@/components/common/Loader";

// "-$392.50" for a loss, not "$-392.50".
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function currency(value: number) {
  return usd.format(value);
}

function topProducts(orders: OrderResponse[]) {
  const totals = new Map<
    string,
    { name: string; quantity: number; revenue: number }
  >();
  for (const order of orders) {
    for (const item of order.items) {
      const entry = totals.get(item.productId) ?? {
        name: item.productName,
        quantity: 0,
        revenue: 0,
      };
      entry.quantity += item.quantity;
      entry.revenue += Number(item.subtotal);
      totals.set(item.productId, entry);
    }
  }
  return [...totals.values()]
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);
}

function PaymentMeter({ cash, bakong }: { cash: number; bakong: number }) {
  const { t } = useI18n();
  const total = cash + bakong;
  const cashPct = total > 0 ? (cash / total) * 100 : 0;
  const bakongPct = total > 0 ? (bakong / total) * 100 : 0;

  if (total <= 0) {
    return (
      <p className="py-6 text-sm text-muted-foreground">
        {t("dashboard.payments.empty", "No payments recorded today yet.")}
      </p>
    );
  }

  const rows = [
    { key: "cash", label: t("dashboard.payments.cash", "Cash"), amount: cash, pct: cashPct, series: "is_cash_series" },
    { key: "bakong", label: "Bakong", amount: bakong, pct: bakongPct, series: "is_bakong_series" },
  ];

  return (
    <div>
      <div
        className="dashboard_payment_bar"
        role="img"
        aria-label={t("dashboard.payments.split_aria", "Cash {cash}%, Bakong {bakong}%", {
          cash: cashPct.toFixed(0),
          bakong: bakongPct.toFixed(0),
        })}
      >
        {rows.map((row) =>
          row.pct > 0 ? <span key={row.key} className={row.series} style={{ width: `${row.pct}%` }} /> : null,
        )}
      </div>
      <dl className="dashboard_payment_rows">
        {rows.map((row) => (
          <div key={row.key} className="dashboard_payment_row">
            <dt>
              <span aria-hidden className={`dashboard_payment_swatch ${row.series}`} />
              {row.label}
            </dt>
            <dd>
              <strong>{currency(row.amount)}</strong>
              <span>{row.pct.toFixed(0)}%</span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default function DashboardView() {
  const { t } = useI18n();
  const today = shopDate();
  const refresh = useRefreshOptions();
  const reportQuery = useGetDailyReportQuery({ date: today }, refresh);
  const financeQuery = useGetDailyFinanceQuery({ date: today }, refresh);
  const lowStockQuery = useListLowStockQuery({ page: 1, size: 5 }, refresh);
  const pendingQuery = useListOrdersQuery(
    { status: "PENDING", page: 1, size: 5 },
    refresh,
  );
  const completedQuery = useListOrdersQuery(
    { status: "COMPLETED", page: 1, size: 200 },
    refresh,
  );
  const weeklyQuery = useGetWeeklyReportsQuery(today, refresh);

  useStaffOrderAlerts(
    useCallback(() => {
      void reportQuery.refetch();
      void financeQuery.refetch();
      void pendingQuery.refetch();
      void completedQuery.refetch();
      void weeklyQuery.refetch();
    }, [reportQuery, financeQuery, pendingQuery, completedQuery, weeklyQuery]),
  );
  useInventoryAlerts(
    useCallback(() => {
      void lowStockQuery.refetch();
    }, [lowStockQuery]),
  );

  const { data: report, isLoading: isLoadingReport } = reportQuery;
  const { data: finance } = financeQuery;
  const { data: lowStock } = lowStockQuery;
  const { data: pending } = pendingQuery;
  const { data: completed } = completedQuery;
  const isLoadingCompleted = completedQuery.isLoading;
  const queries = [
    reportQuery,
    financeQuery,
    lowStockQuery,
    pendingQuery,
    completedQuery,
    weeklyQuery,
  ];
  const queryErrors = queries
    .map((query, index) =>
      query.error
        ? {
            label: [
              t("dashboard.errors.daily_report", "Daily report"),
              t("dashboard.errors.finance", "Finance"),
              t("dashboard.errors.low_stock", "Low stock"),
              t("dashboard.errors.pending_orders", "Pending orders"),
              t("dashboard.errors.completed_orders", "Completed orders"),
              t("dashboard.errors.weekly_report", "Weekly report"),
            ][index],
            error: query.error,
            retry: query.refetch,
          }
        : null,
    )
    .filter((entry) => entry !== null);
  const completedOrders = useMemo(() => completed?.content ?? [], [completed]);
  const series = (weeklyQuery.data ?? []).map((day) => ({
    day: formatLocalDate(new Date(`${day.date}T12:00:00`), {
      weekday: "short",
    }),
    revenue: Number(day.grandTotal),
    orders: day.totalOrders,
  }));
  const products = useMemo(
    () => topProducts(completedOrders),
    [completedOrders],
  );
  const weekRevenue = series.reduce((sum, day) => sum + day.revenue, 0);
  const weekOrders = series.reduce((sum, day) => sum + day.orders, 0);
  const avgDailyOrders = Math.round(weekOrders / 7);

  const recentOrders = completedOrders.slice(0, 5);

  return (
    <PageShell>
      <PageHeader
        title={t("dashboard.title", "Dashboard")}
        breadcrumbs={[{ label: t("breadcrumb.home", "Home"), href: "/" }]}
        rightSlot={<AdminTopActions />}
      />

      <p className="text-sm text-muted-foreground">
        {t(
          "dashboard.subtitle",
          "Shop data for {date}. Refreshes every 30 seconds.",
          { date: today },
        )}
      </p>
      {queryErrors.map((entry) => (
        <div
          key={entry.label}
          role="alert"
          className="rounded-xl border border-red-200 p-4 text-sm text-red-700"
        >
          {entry.label}:{" "}
          {apiErrorMessage(
            entry.error as never,
            t("dashboard.errors.load_failed", "Could not load this data."),
          )}
          <button
            type="button"
            className="ml-3 underline"
            onClick={() => void entry.retry()}
          >
            {t("actions.retry", "Retry")}
          </button>
        </div>
      ))}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatTile
          title={t("dashboard.stats.revenue_today", "Revenue Today")}
          value={
            isLoadingReport
              ? "..."
              : reportQuery.error
                ? t("dashboard.stats.unavailable", "Unavailable")
                : currency(Number(report?.grandTotal ?? 0))
          }
          hint={
            finance && !financeQuery.error
              ? t("dashboard.stats.profit_hint", "Profit: {amount}", {
                  amount: currency(Number(finance.profit)),
                })
              : undefined
          }
          tone="green"
          icon={Banknote}
        />
        <StatTile
          title={t("dashboard.stats.orders_today", "Orders Today")}
          value={
            isLoadingReport
              ? "..."
              : reportQuery.error
                ? t("dashboard.stats.unavailable", "Unavailable")
                : String(report?.totalOrders ?? 0)
          }
          hint={
            report && !reportQuery.error
              ? t(
                  "dashboard.stats.staff_with_sales",
                  "{count} staff member(s) with completed sales",
                  { count: report.baristas.length },
                )
              : undefined
          }
          tone="gray"
          icon={Receipt}
        />
        <StatTile
          title={t("dashboard.stats.pending_orders", "Pending Orders")}
          value={
            pendingQuery.isLoading
              ? "..."
              : pendingQuery.error
                ? t("dashboard.stats.unavailable", "Unavailable")
                : String(pending?.totalElements ?? 0)
          }
          hint={t("dashboard.stats.pending_hint", "Awaiting payment or pickup")}
          tone={(pending?.totalElements ?? 0) > 0 ? "yellow" : "gray"}
          icon={Clock3}
        />
        <StatTile
          title={t("dashboard.stats.low_stock_items", "Low Stock Items")}
          value={
            lowStockQuery.isLoading
              ? "..."
              : lowStockQuery.error
                ? t("dashboard.stats.unavailable", "Unavailable")
                : String(lowStock?.totalElements ?? 0)
          }
          hint={t("dashboard.low_stock.subtitle", "At or below reorder level")}
          tone={(lowStock?.totalElements ?? 0) > 0 ? "red" : "gray"}
          icon={PackageMinus}
        />
      </div>

      <section className="dashboard_primary_grid">
        <div className="chart_card dashboard_sales_card">
          <div className="section_header">
            <div className="header_text_group">
              <h2 className="header_title">
                {t("dashboard.revenue.title", "Revenue · last 7 days")}
              </h2>
              <p className="header_subtitle">
                {t(
                  "dashboard.revenue.subtitle",
                  "All completed sales from the daily reports",
                )}
              </p>
            </div>
            <Link
              href="/reports"
              className="header_filter_btn dashboard_header_link"
            >
              {t("dashboard.revenue.view_report", "View Report")}
              <ArrowRight />
            </Link>
          </div>

          <div className="dashboard_chart_totals">
            <div>
              <span>{t("dashboard.revenue.week_revenue", "7-day revenue")}</span>
              <strong>
                {weeklyQuery.isLoading
                  ? "..."
                  : weeklyQuery.error
                    ? t("dashboard.stats.unavailable", "Unavailable")
                    : currency(weekRevenue)}
              </strong>
            </div>
            <div>
              <span>
                {t("dashboard.revenue.avg_daily_orders", "Average daily orders")}
              </span>
              <strong>
                {weeklyQuery.isLoading
                  ? "..."
                  : weeklyQuery.error
                    ? t("dashboard.stats.unavailable", "Unavailable")
                    : avgDailyOrders}
              </strong>
            </div>
          </div>

          <div className="chart_container">
            {weeklyQuery.error ? (
              <p className="p-4 text-sm">
                {t(
                  "dashboard.revenue.load_failed",
                  "Weekly sales could not be loaded.",
                )}
              </p>
            ) : weeklyQuery.isLoading ? (
              <Loader block className="h-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={series}
                  margin={{ left: -12, right: 8, top: 12 }}
                >
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) =>
                      value >= 1000 ? `$${value / 1000}k` : `$${value}`
                    }
                  />
                  <Tooltip
                    cursor={{ fill: "var(--chart-cursor)" }}
                    formatter={(value) => [
                      currency(Number(value ?? 0)),
                      t("dashboard.revenue.series", "Revenue"),
                    ]}
                  />
                  <Bar
                    dataKey="revenue"
                    className="dashboard_revenue_bar"
                    fill="var(--chart-cash)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
            {!weeklyQuery.isLoading && !weeklyQuery.error && series.length > 0 && weekRevenue === 0 ? (
              <p className="dashboard_chart_empty">
                {t("dashboard.revenue.empty", "No sales in the last 7 days yet.")}
              </p>
            ) : null}
          </div>
        </div>

        <div className="dashboard_panel">
          <div className="dashboard_panel_header">
            <div>
              <h2>{t("dashboard.payments.title", "Payment Split")}</h2>
              <p>
                {t("dashboard.payments.subtitle", "Today, from the daily report")}
              </p>
            </div>
            <Link href="/payments">
              {t("dashboard.payments.link", "Payments")} <ArrowRight />
            </Link>
          </div>
          {reportQuery.error ? (
            <p className="p-4 text-sm">
              {t("dashboard.payments.load_failed", "Payments could not be loaded.")}
            </p>
          ) : reportQuery.isLoading ? (
            <p>{t("dashboard.payments.loading", "Loading payments...")}</p>
          ) : (
            <PaymentMeter
              cash={Number(report?.cashTotal ?? 0)}
              bakong={Number(report?.bakongTotal ?? 0)}
            />
          )}

          {report && report.baristas.length > 0 ? (
            <>
              <p className="dashboard_subheading">
                {t("dashboard.payments.staff_heading", "Staff sales today")}
              </p>
              <div className="dashboard_flow_summary">
                {report.baristas.slice(0, 2).map((barista) => (
                  <div key={barista.baristaId}>
                    <span>{titleCase(barista.baristaName)}</span>
                    <strong>{currency(Number(barista.grandTotal))}</strong>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </div>
      </section>

      <section className="dashboard_business_grid">
        <div className="dashboard_panel">
          <div className="dashboard_panel_header">
            <div>
              <h2>{t("dashboard.top_products.title", "Top Products")}</h2>
              <p>
                {t(
                  "dashboard.top_products.subtitle",
                  "By units sold across the most recent 200 completed orders",
                )}
              </p>
            </div>
            <Link href="/products">
              {t("dashboard.top_products.link", "Products")} <ArrowRight />
            </Link>
          </div>
          {completedQuery.error ? (
            <p className="p-4 text-sm">
              {t(
                "dashboard.top_products.load_failed",
                "Products could not be loaded.",
              )}
            </p>
          ) : isLoadingCompleted ? (
            <p>{t("dashboard.top_products.loading", "Loading products...")}</p>
          ) : products.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">
              {t("dashboard.top_products.empty", "No sales recorded yet.")}
            </p>
          ) : (
            <table className="data_table is_compact">
              <thead>
                <tr>
                  <th>{t("fields.product", "Product")}</th>
                  <th>{t("dashboard.top_products.units", "Units")}</th>
                  <th>{t("dashboard.top_products.revenue", "Revenue")}</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.name}>
                    <td>{titleCase(product.name)}</td>
                    <td>{product.quantity}</td>
                    <td>{currency(product.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="dashboard_panel">
          <div className="dashboard_panel_header">
            <div>
              <h2>{t("dashboard.low_stock.title", "Low Stock")}</h2>
              <p>
                {t("dashboard.low_stock.subtitle", "At or below reorder level")}
              </p>
            </div>
            <Link href="/stock-alerts">
              {t("dashboard.low_stock.link", "Stock Alerts")} <ArrowRight />
            </Link>
          </div>
          {lowStockQuery.error ? (
            <p className="p-4 text-sm">
              {t("dashboard.low_stock.load_failed", "Stock could not be loaded.")}
            </p>
          ) : lowStockQuery.isLoading ? (
            <p>{t("dashboard.low_stock.loading", "Loading stock...")}</p>
          ) : (lowStock?.content.length ?? 0) === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">
              {t(
                "dashboard.low_stock.empty",
                "Everything is above its reorder level.",
              )}
            </p>
          ) : (
            <div className="dashboard_flow_list">
              {(lowStock?.content ?? []).map((item) => (
                <div key={item.productId} className="dashboard_flow_item">
                  <span className="dashboard_flow_icon is_warning">
                    <AlertTriangle />
                  </span>
                  <span className="dashboard_flow_label">
                    {titleCase(item.productName)}
                  </span>
                  <strong>
                    {Number(item.quantityOnHand).toLocaleString()} {enumLabel(t, "unit", item.unit)}
                  </strong>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="dashboard_panel">
          <div className="dashboard_panel_header">
            <div>
              <h2>{t("dashboard.recent_orders.title", "Recent Orders")}</h2>
              <p>
                {t("dashboard.recent_orders.subtitle", "Most recently completed")}
              </p>
            </div>
            <Link href="/orders">
              {t("dashboard.recent_orders.link", "Orders")} <ArrowRight />
            </Link>
          </div>
          {completedQuery.error ? (
            <p className="p-4 text-sm">
              {t("dashboard.recent_orders.load_failed", "Orders could not be loaded.")}
            </p>
          ) : isLoadingCompleted ? (
            <p>{t("dashboard.recent_orders.loading", "Loading orders...")}</p>
          ) : recentOrders.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">
              {t("dashboard.recent_orders.empty", "No completed orders yet.")}
            </p>
          ) : (
            <table className="data_table is_compact">
              <thead>
                <tr>
                  <th>{t("fields.order", "Order")}</th>
                  <th>{t("fields.customer", "Customer")}</th>
                  <th>{t("fields.total", "Total")}</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => (
                  <tr key={order.id}>
                    <td className="font-mono text-xs">
                      #{order.id.slice(0, 8).toUpperCase()}
                    </td>
                    <td>
                      {order.customerName
                        ? titleCase(order.customerName)
                        : t("dashboard.recent_orders.walk_in", "Walk-in")}
                    </td>
                    <td>{currency(Number(order.totalAmount))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </PageShell>
  );
}
