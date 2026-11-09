"use client";

import { useCallback, useMemo } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { Download } from "lucide-react";
import { PageShell } from "@/components/common/PageShell";
import { PageHeader } from "@/components/common/PageHeader";
import {
  AdminTopActions,
  Cell,
  DataCard,
  FilterActions,
  FilterPanel,
  PaginationFooter,
  Row,
  SelectField,
  SimpleTable,
  StatTile,
  StatusBadge,
  TableState,
  TextField,
} from "@/components/common/AdminKit";
import { usePageSize } from "@/contexts/AdminPreferencesContext";
import { useI18n } from "@/contexts/I18nContext";
import { useInventoryAlerts } from "@/hooks/useInventoryAlerts";
import { filteredPage } from "@/hooks/useFilteredPaging";
import { usePersistentState } from "@/hooks/usePersistentState";
import { enumLabel } from "@/lib/enumLabel";
import { shopDate } from "@/lib/shopDate";
import { cn, downloadBlob, titleCase } from "@/lib/utils";
import { apiErrorMessage } from "@/store/api/baseApi";
import { useDownloadInventoryReportMutation, useGetInventoryReportQuery } from "@/store/api/inventoryApi";
import { useCurrentRole } from "@/store/api/useCurrentRole";
import type { ReportPeriod, WasteReason } from "@/store/api/types";
import { formatUsd, matchesKind, stockLevel, type ItemKind } from "../stock";
import { ItemKindField } from "./ItemKindField";
import { Button } from "@/components/common/Button";

const PERIODS: ReportPeriod[] = ["DAY", "MONTH", "YEAR"];
const WASTE_REASONS: WasteReason[] = ["EXPIRED", "DAMAGED", "SPILLED", "QUALITY", "OTHER"];

export default function InventoryReportView() {
  const { isAdmin } = useCurrentRole();
  return isAdmin ? <AdminInventoryReport /> : null;
}

function AdminInventoryReport() {
  const { t } = useI18n();
  const [period, setPeriod] = usePersistentState<ReportPeriod>("inventory-reports:period", "MONTH");
  const [date, setDate] = usePersistentState("inventory-reports:date", () => shopDate());
  const [kind, setKind] = usePersistentState<ItemKind>("inventory-reports:kind", "");
  const [page, setPage] = usePersistentState("inventory-reports:page", 1);
  const [size, setSize] = usePageSize();

  const { currentData: report, isFetching, error, refetch } = useGetInventoryReportQuery({ period, date });
  const isLoading = isFetching && !report;
  const [downloadReport, { isLoading: isExporting }] = useDownloadInventoryReportMutation();

  useInventoryAlerts(useCallback(() => { void refetch(); }, [refetch]));

  const handleExport = async () => {
    try {
      const blob = await downloadReport({ period, date }).unwrap();
      downloadBlob(blob, `inventory-${period.toLowerCase()}-${report?.from ?? date}.xlsx`);
    } catch (err) {
      toast.error(apiErrorMessage(err as never, t("inventory.reports.errors.export", "Could not download the inventory report.")));
    }
  };

  const tileValue = (value: number | undefined, format: (value: number) => string = formatUsd) =>
    error ? t("inventory.reports.stats.unavailable", "Unavailable") : isLoading || !report ? "..." : format(Number(value ?? 0));
  const count = (value: number) => value.toLocaleString();

  const wasteRows = useMemo(
    () =>
      WASTE_REASONS.map((reason) => ({ reason, cost: Number(report?.wasteCostByReason[reason] ?? 0) }))
        .filter((row) => row.cost > 0)
        .sort((a, b) => b.cost - a.cost),
    [report]
  );
  const totalWaste = Number(report?.wasteCost ?? 0);

  const products = useMemo(
    () => (report?.products ?? []).filter((row) => matchesKind(row.ingredient, kind)),
    [report, kind]
  );
  const view = filteredPage(products, undefined, page, size, true);

  const thisYear = Number(shopDate().slice(0, 4));
  const years = Array.from({ length: 10 }, (_, i) => String(thisYear - i));
  if (!years.includes(date.slice(0, 4))) years.push(date.slice(0, 4));

  const wasteHeaders = [
    t("inventory.movement.reason", "Reason"),
    t("inventory.reports.waste.cost", "Waste Cost"),
    t("inventory.reports.waste.share", "Share"),
  ];
  const productHeaders = [
    t("fields.product", "Product"),
    t("fields.unit", "Unit"),
    t("inventory.reports.table.purchased", "Purchased"),
    t("inventory.reports.table.sold", "Sold"),
    t("inventory.reports.table.returned", "Returned"),
    t("inventory.reports.table.wasted", "Wasted"),
    t("inventory.reports.table.adjusted_in", "Adjusted In"),
    t("inventory.reports.table.adjusted_out", "Adjusted Out"),
    t("inventory.reports.table.purchase_cost", "Purchase Cost"),
    t("inventory.reports.table.sales_cost", "Cost of Sales"),
    t("inventory.reports.table.waste_cost", "Waste Cost"),
    t("inventory.reports.table.on_hand", "On Hand"),
    t("inventory.reports.table.stock_value", "Stock Value"),
  ];

  return (
    <PageShell>
      <PageHeader
        title={t("inventory.reports.title", "Inventory Dashboard & Reports")}
        breadcrumbs={[
          { label: t("breadcrumb.home", "Home"), href: "/" },
          { label: t("inventory.breadcrumb.inventory", "Inventory"), href: "/inventory" },
          { label: t("inventory.reports.breadcrumb", "Reports") },
        ]}
        rightSlot={<AdminTopActions />}
      />

      <FilterPanel>
        <SelectField
          label={t("inventory.reports.filters.period", "Period")}
          value={period}
          onChange={(e) => { if (e.target.value) { setPeriod(e.target.value as ReportPeriod); setPage(1); } }}
        >
          {PERIODS.map((value) => (
            <option key={value} value={value}>
              {enumLabel(t, "report_period", value)}
            </option>
          ))}
        </SelectField>
        {period === "DAY" ? (
          <TextField
            label={t("fields.date", "Date")}
            type="date"
            value={date}
            onChange={(e) => { if (e.target.value) { setDate(e.target.value); setPage(1); } }}
          />
        ) : period === "MONTH" ? (
          <TextField
            label={t("inventory.reports.filters.month", "Month")}
            type="month"
            value={date.slice(0, 7)}
            onChange={(e) => { if (e.target.value) { setDate(`${e.target.value}-01`); setPage(1); } }}
          />
        ) : (
          <SelectField
            label={t("inventory.reports.filters.year", "Year")}
            value={date.slice(0, 4)}
            onChange={(e) => { if (e.target.value) { setDate(`${e.target.value}-01-01`); setPage(1); } }}
          >
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </SelectField>
        )}
        <ItemKindField value={kind} onChange={(next) => { setKind(next); setPage(1); }} />
        <FilterActions
          onClear={() => { setPeriod("MONTH"); setDate(shopDate()); setKind(""); setPage(1); }}
          onSearch={refetch}
        />
      </FilterPanel>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatTile
          title={t("inventory.reports.stats.stock_value", "Stock Value Now")}
          value={tileValue(report?.stockValue)}
          hint={t("inventory.reports.stats.stock_value_hint", "What everything on hand cost")}
          tone="green"
        />
        <StatTile
          title={t("inventory.reports.stats.purchases", "Purchases")}
          value={tileValue(report?.purchaseCost)}
          hint={report ? t("inventory.reports.stats.purchases_hint", "{count} stock-ins", { count: report.purchaseCount }) : undefined}
          tone="gray"
        />
        <StatTile
          title={t("inventory.reports.stats.sales_cost", "Cost of Goods Sold")}
          value={tileValue(report?.salesCost)}
          hint={report ? t("inventory.reports.stats.sales_cost_hint", "{count} sales", { count: report.saleCount }) : undefined}
          tone="gray"
        />
        <StatTile
          title={t("inventory.reports.stats.waste", "Waste")}
          value={tileValue(report?.wasteCost)}
          hint={report ? t("inventory.reports.stats.waste_hint", "{count} waste records", { count: report.wasteCount }) : undefined}
          tone={totalWaste > 0 ? "orange" : "gray"}
        />
        <StatTile
          title={t("inventory.reports.stats.low_stock", "Low Stock")}
          value={tileValue(report?.lowStockCount, count)}
          hint={t("inventory.reports.stats.as_of_now", "As of now")}
          tone={(report?.lowStockCount ?? 0) > 0 ? "orange" : "gray"}
        />
        <StatTile
          title={t("inventory.reports.stats.out_of_stock", "Out of Stock")}
          value={tileValue(report?.outOfStockCount, count)}
          hint={t("inventory.reports.stats.as_of_now", "As of now")}
          tone={(report?.outOfStockCount ?? 0) > 0 ? "red" : "gray"}
        />
      </div>

      <DataCard
        title={t("inventory.reports.waste.title", "Waste by Reason")}
        meta={report ? t("inventory.reports.period_meta", "{from} → {to}", { from: report.from, to: report.to }) : undefined}
      >
        <SimpleTable headers={wasteHeaders}>
          <TableState
            colSpan={wasteHeaders.length}
            isLoading={isLoading}
            error={error}
            isEmpty={wasteRows.length === 0}
            emptyLabel={t("inventory.reports.waste.empty", "No waste recorded in this period.")}
            onRetry={refetch}
          />
          {report &&
            wasteRows.map((row, index) => (
              <Row key={row.reason} striped={index % 2 === 1}>
                <Cell className="font-semibold">{enumLabel(t, "waste_reason", row.reason)}</Cell>
                <Cell>{formatUsd(row.cost)}</Cell>
                <Cell>{totalWaste > 0 ? `${Math.round((row.cost / totalWaste) * 100)}%` : "-"}</Cell>
              </Row>
            ))}
        </SimpleTable>
      </DataCard>

      <DataCard
        title={t("inventory.reports.products.title", "Products")}
        meta={
          report
            ? t("inventory.reports.products.meta", "{from} → {to} · {count} movements", {
                from: report.from,
                to: report.to,
                count: report.movementCount,
              })
            : undefined
        }
        actions={
          <Button onClick={handleExport} disabled={isExporting} variant="outline">
            {isExporting ? t("inventory.expense.exporting", "Exporting...") : t("inventory.reports.export", "Export Excel")}
            <Download />
          </Button>
        }
      >
        <SimpleTable headers={productHeaders}>
          <TableState
            colSpan={productHeaders.length}
            isLoading={isLoading}
            error={error}
            isEmpty={view.rows.length === 0}
            emptyLabel={
              kind
                ? t("inventory.reports.products.empty_filtered", "No products of this type.")
                : t("inventory.reports.products.empty", "No stock items yet.")
            }
            onRetry={refetch}
          />
          {report &&
            view.rows.map((row, index) => {
              const onHand = Number(row.onHand);
              const level = stockLevel(onHand, Number(row.reorderLevel));
              const amount = (value: number) => Number(value).toLocaleString();
              return (
                <Row key={row.productId} striped={index % 2 === 1}>
                  <Cell>
                    <div className="flex flex-wrap items-center gap-2 font-semibold">
                      <Link href={`/inventory/${row.productId}`} className="hover:underline">
                        {titleCase(row.productName)}
                      </Link>
                      {row.ingredient ? <StatusBadge label={t("inventory.kind.ingredient", "Ingredient")} tone="info" /> : null}
                    </div>
                    {row.categoryName ? <span className="block text-xs text-muted-foreground">{row.categoryName}</span> : null}
                  </Cell>
                  <Cell>{enumLabel(t, "unit", row.unit)}</Cell>
                  <Cell>{amount(row.purchased)}</Cell>
                  <Cell>{amount(row.sold)}</Cell>
                  <Cell>{amount(row.returned)}</Cell>
                  <Cell>{amount(row.wasted)}</Cell>
                  <Cell>{amount(row.adjustedIn)}</Cell>
                  <Cell>{amount(row.adjustedOut)}</Cell>
                  <Cell>{formatUsd(row.purchaseCost)}</Cell>
                  <Cell>{formatUsd(row.salesCost)}</Cell>
                  <Cell>{formatUsd(row.wasteCost)}</Cell>
                  <Cell className={cn(level === "OUT" && "font-semibold text-red-700", level === "LOW" && "font-semibold text-yellow-700")}>
                    {amount(onHand)}
                  </Cell>
                  <Cell className="font-semibold">{formatUsd(row.stockValue)}</Cell>
                </Row>
              );
            })}
        </SimpleTable>
        <PaginationFooter
          page={view.page}
          totalPages={view.totalPages}
          size={size}
          totalElements={view.totalElements}
          onPageChange={setPage}
          onSizeChange={(next) => {
            setSize(next);
            setPage(1);
          }}
        />
      </DataCard>
    </PageShell>
  );
}
