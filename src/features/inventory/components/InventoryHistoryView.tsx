"use client";

import { useCallback, useMemo } from "react";
import { PageShell } from "@/components/common/PageShell";
import { PageHeader } from "@/components/common/PageHeader";
import {
  AdminTopActions,
  DataCard,
  FilterActions,
  FilterPanel,
  FormProductSelect,
  PaginationFooter,
  SelectField,
  SimpleTable,
  TableState,
  TextField,
  listLoadState,
} from "@/components/common/AdminKit";
import { usePageSize } from "@/contexts/AdminPreferencesContext";
import { useI18n } from "@/contexts/I18nContext";
import { useInventoryAlerts } from "@/hooks/useInventoryAlerts";
import { usePersistentState } from "@/hooks/usePersistentState";
import { enumLabel } from "@/lib/enumLabel";
import { useSearchStockMovementsQuery } from "@/store/api/inventoryApi";
import type { MovementSearchQuery, StockMovementReason, StockMovementType } from "@/store/api/types";
import { stockUnitsOf } from "../stock";
import { useStockProducts } from "../useStockProducts";
import { MovementRow, movementHeaders } from "./MovementRow";

const REASONS: StockMovementReason[] = ["PURCHASE", "SALE", "RETURN", "WASTE", "ADJUSTMENT"];

export default function InventoryHistoryView() {
  const { t } = useI18n();
  const [page, setPage] = usePersistentState("inventory-history:page", 1);
  const [size, setSize] = usePageSize();
  const [productId, setProductId] = usePersistentState("inventory-history:productId", "");
  const [type, setType] = usePersistentState<StockMovementType | "">("inventory-history:type", "");
  const [reason, setReason] = usePersistentState<StockMovementReason | "">("inventory-history:reason", "");
  const [from, setFrom] = usePersistentState("inventory-history:from", "");
  const [to, setTo] = usePersistentState("inventory-history:to", "");

  const { options, byId } = useStockProducts();

  // Blank filters are left out so they don't split the cache.
  const query = useMemo(() => {
    const args: MovementSearchQuery = { page, size };
    if (productId) args.productId = productId;
    if (type) args.type = type;
    if (reason) args.reason = reason;
    if (from) args.from = from;
    if (to) args.to = to;
    return args;
  }, [page, size, productId, type, reason, from, to]);

  const movementsQuery = useSearchStockMovementsQuery(query);
  const { data: movementPage, refetch } = movementsQuery;
  const movements = listLoadState(movementsQuery);
  const isFiltering = Boolean(productId || type || reason || from || to);

  useInventoryAlerts(useCallback(() => { void refetch(); }, [refetch]));

  const headers = movementHeaders(t, { withProduct: true });
  const rows = movementPage?.content ?? [];

  return (
    <PageShell>
      <PageHeader
        title={t("inventory.history.title", "Inventory History")}
        breadcrumbs={[
          { label: t("breadcrumb.home", "Home"), href: "/" },
          { label: t("inventory.breadcrumb.inventory", "Inventory"), href: "/inventory" },
          { label: t("inventory.history.title", "Inventory History") },
        ]}
        rightSlot={<AdminTopActions />}
      />

      <FilterPanel>
        <FormProductSelect
          label={t("fields.product", "Product")}
          options={options}
          value={options.find((option) => option.id === productId) ?? null}
          onChange={(option) => { setProductId(option?.id ?? ""); setPage(1); }}
        />
        <SelectField
          label={t("fields.type", "Type")}
          placeholder={t("inventory.history.filters.all_types", "All types")}
          value={type}
          onChange={(e) => { setType(e.target.value as StockMovementType | ""); setPage(1); }}
        >
          <option value="STOCK_IN">{t("inventory.movement.stock_in", "Stock In")}</option>
          <option value="STOCK_OUT">{t("inventory.movement.stock_out", "Stock Out")}</option>
        </SelectField>
        <SelectField
          label={t("inventory.movement.reason", "Reason")}
          placeholder={t("inventory.history.filters.all_reasons", "All reasons")}
          value={reason}
          onChange={(e) => { setReason(e.target.value as StockMovementReason | ""); setPage(1); }}
        >
          {REASONS.map((value) => (
            <option key={value} value={value}>
              {enumLabel(t, "movement_reason", value)}
            </option>
          ))}
        </SelectField>
        <TextField
          label={t("inventory.history.filters.from", "From")}
          type="date"
          value={from}
          onChange={(e) => { setFrom(e.target.value); setPage(1); }}
        />
        <TextField
          label={t("inventory.history.filters.to", "To")}
          type="date"
          value={to}
          onChange={(e) => { setTo(e.target.value); setPage(1); }}
        />
        <FilterActions
          onClear={() => {
            setProductId("");
            setType("");
            setReason("");
            setFrom("");
            setTo("");
            setPage(1);
          }}
          onSearch={refetch}
        />
      </FilterPanel>

      <DataCard
        title={t("inventory.history.card.title", "Stock Movements")}
        meta={t("inventory.history.card.meta", "Movements: {count}", { count: movementPage?.totalElements ?? 0 })}
      >
        <SimpleTable headers={headers}>
          <TableState
            colSpan={headers.length}
            isLoading={movements.isLoading}
            error={movements.error}
            isEmpty={rows.length === 0}
            emptyLabel={
              isFiltering
                ? t("inventory.history.empty.filtered", "No stock movements match these filters.")
                : t("inventory.history.empty.none", "No stock movements recorded yet.")
            }
            onRetry={refetch}
          />
          {movements.showRows &&
            rows.map((movement, index) => {
              const item = byId.get(movement.productId);
              return (
                <MovementRow
                  key={movement.id}
                  movement={movement}
                  striped={index % 2 === 1}
                  units={item ? stockUnitsOf(item) : undefined}
                  withProduct
                />
              );
            })}
        </SimpleTable>
        <PaginationFooter
          page={movementPage?.page ?? page}
          totalPages={movementPage?.totalPages ?? 1}
          size={size}
          totalElements={movementPage?.totalElements}
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
