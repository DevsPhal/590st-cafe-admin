"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { PageShell } from "@/components/common/PageShell";
import { PageHeader } from "@/components/common/PageHeader";
import {
  AdminTopActions,
  Cell,
  DataCard,
  PaginationFooter,
  Row,
  RowActions,
  SimpleTable,
  StatTile,
  StatusBadge,
  TableState,
  listLoadState,
} from "@/components/common/AdminKit";
import { useListLowStockQuery } from "@/store/api/inventoryApi";
import { usePageSize } from "@/contexts/AdminPreferencesContext";
import { titleCase } from "@/lib/utils";
import { enumLabel } from "@/lib/enumLabel";
import { formatStock, unitsPerStock, type StockUnits } from "@/lib/stockUnits";
import { useInventoryAlerts } from "@/hooks/useInventoryAlerts";
import { usePersistentState } from "@/hooks/usePersistentState";
import { useI18n } from "@/contexts/I18nContext";

export default function StockAlertView() {
  const { t } = useI18n();
  const router = useRouter();
  const stockAlertHeaders = [
    t("table.no", "No"),
    t("stock_alerts.table.product_name", "Product Name"),
    t("stock_alerts.table.on_hand", "On Hand"),
    t("fields.unit", "Unit"),
    t("stock_alerts.table.reorder_level", "Reorder Level"),
    t("stock_alerts.table.shortfall", "Shortfall"),
    t("stock_alerts.table.severity", "Severity"),
    t("table.action", "Action"),
  ];
  const [page, setPage] = usePersistentState("stock-alerts:page", 1);
  const [size, setSize] = usePageSize();

  const { data: alertPage, currentData, isFetching, error, refetch } = useListLowStockQuery({
    page,
    size,
  });
  const list = listLoadState({ isFetching, currentData, error });

  useInventoryAlerts(useCallback(() => { void refetch(); }, [refetch]));

  const alerts = alertPage?.content ?? [];
  const outOfStock = alerts.filter((a) => Number(a.quantityOnHand) <= 0).length;

  return (
    <PageShell>
      <PageHeader
        title={t("stock_alerts.title", "Stock Alerts")}
        breadcrumbs={[
          { label: t("breadcrumb.home", "Home"), href: "/" },
          { label: t("stock_alerts.breadcrumb.inventory", "Inventory") },
          { label: t("stock_alerts.title", "Stock Alerts") },
        ]}
        rightSlot={<AdminTopActions />}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <StatTile
          title={t("stock_alerts.stats.needing_restock", "Products Needing Restock")}
          value={String(alertPage?.totalElements ?? 0)}
          tone={(alertPage?.totalElements ?? 0) > 0 ? "orange" : "green"}
        />
        <StatTile
          title={t("stock_alerts.stats.out_of_stock_page", "Out of Stock (this page)")}
          value={String(outOfStock)}
          tone={outOfStock > 0 ? "red" : "gray"}
        />
      </div>

      <DataCard
        title={t("stock_alerts.card.title", "Low Stock")}
        meta={t("stock_alerts.card.meta", "At or below reorder level: {count}", { count: alertPage?.totalElements ?? 0 })}
      >
        <SimpleTable headers={stockAlertHeaders}>
          <TableState
            colSpan={stockAlertHeaders.length}
            isLoading={list.isLoading}
            error={list.error}
            isEmpty={alerts.length === 0}
            emptyLabel={t("stock_alerts.empty.no_alerts", "Nothing is below its reorder level. Stock levels are healthy.")}
            onRetry={refetch}
          />
          {list.showRows &&
            alerts.map((alert, index) => {
              const onHand = Number(alert.quantityOnHand);
              const reorder = Number(alert.reorderLevel);
              const shortfall = Math.max(reorder - onHand, 0);
              const isOut = onHand <= 0;
              const units: StockUnits = { sellUnit: alert.unit, stockUnit: alert.stockUnit, unitsPerStock: alert.unitsPerStock };
              const perStock = unitsPerStock(units);

              return (
                <Row key={alert.productId} striped={index % 2 === 1}>
                  <Cell>{(page - 1) * size + index + 1}</Cell>
                  <Cell className="font-semibold">{titleCase(alert.productName)}</Cell>
                  <Cell className={isOut ? "whitespace-nowrap font-semibold text-red-700" : "whitespace-nowrap"}>
                    {formatStock(t, onHand, units)}
                  </Cell>
                  <Cell>
                    {enumLabel(t, "unit", alert.unit)}
                    {perStock > 1 ? (
                      <span className="block text-xs text-muted-foreground">
                        {t("stock_alerts.table.per_stock_unit", "{count} per {unit}", { count: perStock, unit: enumLabel(t, "unit", alert.stockUnit) })}
                      </span>
                    ) : null}
                  </Cell>
                  <Cell className="whitespace-nowrap">{reorder.toLocaleString()} {enumLabel(t, "unit", alert.unit)}</Cell>
                  <Cell className="whitespace-nowrap font-semibold">{formatStock(t, shortfall, units)}</Cell>
                  <Cell>
                    <StatusBadge
                      label={
                        isOut
                          ? t("stock_alerts.severity.out_of_stock", "Out of Stock")
                          : t("stock_alerts.severity.low_stock", "Low Stock")
                      }
                      tone={isOut ? "danger" : "warning"}
                    />
                  </Cell>
                  <Cell>
                    <RowActions
                      onView={() => router.push(`/inventory/${alert.productId}`)}
                    />
                  </Cell>
                </Row>
              );
            })}
        </SimpleTable>
        <PaginationFooter
          page={alertPage?.page ?? page}
          totalPages={alertPage?.totalPages ?? 1}
          size={size}
          totalElements={alertPage?.totalElements}
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
