"use client";

import { useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { PageShell } from "@/components/common/PageShell";
import { PageHeader } from "@/components/common/PageHeader";
import {
  AdminTopActions,
  Cell,
  DataCard,
  ExcelImportButton,
  FilterActions,
  FilterPanel,
  PaginationFooter,
  Row,
  SelectField,
  SimpleTable,
  StatTile,
  StatusBadge,
  TableActions,
  TableState,
  listLoadState,
  TextField,
} from "@/components/common/AdminKit";
import { apiErrorMessage } from "@/store/api/baseApi";
import { usePageSize } from "@/contexts/AdminPreferencesContext";
import { useI18n } from "@/contexts/I18nContext";
import {
  useDownloadMonthlyStockExpenseReportMutation,
  useDownloadStockInImportTemplateMutation,
  useListInventoryQuery,
  useStockInFromExcelMutation,
} from "@/store/api/inventoryApi";
import { useCurrentRole } from "@/store/api/useCurrentRole";
import type { InventoryResponse } from "@/store/api/types";
import { downloadBlob, titleCase } from "@/lib/utils";
import { enumLabel } from "@/lib/enumLabel";
import { formatStock, unitsPerStock } from "@/lib/stockUnits";
import { useInventoryAlerts } from "@/hooks/useInventoryAlerts";
import { usePersistentState } from "@/hooks/usePersistentState";
import { filteredPage, filteredQueryArgs } from "@/hooks/useFilteredPaging";
import { DatePickerInput } from "@/components/forms/DatePickerInput";
import { ClipboardCheck, Download, Eye, PackagePlus, PackageX, type LucideIcon } from "lucide-react";
import { LEVEL_TONE, matchesKind, sellQuantity, stockLevel, stockUnitsOf, type ItemKind, type StockLevel } from "../stock";
import { ItemKindField } from "./ItemKindField";
import { StockActionModal, useStockActionModal } from "./StockActionModal";
import { Button } from "@/components/common/Button";

const itemLevel = (item: InventoryResponse) => stockLevel(Number(item.quantityOnHand), Number(item.reorderLevel));

type RowAction = [icon: LucideIcon, onClick: () => void, label: string];

// Same look as AdminKit's RowActions, with the stock actions admins reach for most.
function StockRowActions({ actions }: { actions: RowAction[] }) {
  return (
    <div className="flex flex-nowrap items-center gap-2">
      {actions.map(([Icon, onClick, label]) => (
        <button
          key={label}
          type="button"
          onClick={onClick}
          className="grid h-7 w-7 place-items-center rounded-full pointer-coarse:size-11 bg-(--brand-ink) text-(--brand-lime) transition hover:bg-(--brand-ink-hover)"
          aria-label={label}
          title={label}
        >
          <Icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
}

export default function Inventory() {
  const { t } = useI18n();
  const { isAdmin } = useCurrentRole();
  const router = useRouter();

  const inventoryTableHeaders = [
    t("table.no", "No"),
    t("inventory.fields.product_name", "Product Name"),
    t("inventory.table.current_stock", "Current Stock"),
    t("fields.unit", "Unit"),
    t("inventory.fields.reorder_level", "Reorder Level"),
    t("fields.status", "Status"),
    t("table.action", "Action"),
  ];

  const levelLabel: Record<StockLevel, string> = {
    OUT: t("inventory.levels.out", "Out of Stock"),
    LOW: t("inventory.levels.low", "Low Stock"),
    OK: t("inventory.levels.ok", "In Stock"),
  };

  const [page, setPage] = usePersistentState("inventory:page", 1);
  const [size, setSize] = usePageSize();
  const [searchTerm, setSearchTerm] = usePersistentState("inventory:searchTerm", "");
  const [levelFilter, setLevelFilter] = usePersistentState("inventory:levelFilter", "");
  const [kindFilter, setKindFilter] = usePersistentState<ItemKind>("inventory:kindFilter", "");
  const isFiltering = Boolean(searchTerm.trim() || levelFilter || kindFilter);
  const [expenseMonth, setExpenseMonth] = usePersistentState("inventory:expenseMonth", () => new Date().toISOString().slice(0, 7));

  const {
    data: inventoryPage,
    currentData,
    isFetching,
    error,
    refetch,
  } = useListInventoryQuery(filteredQueryArgs(page, size, isFiltering));
  const list = listLoadState({ isFetching, currentData, error });

  useInventoryAlerts(useCallback(() => { void refetch(); }, [refetch]));

  const stockAction = useStockActionModal();
  const [stockInFromExcel] = useStockInFromExcelMutation();
  const [downloadStockInTemplate] = useDownloadStockInImportTemplateMutation();
  const [downloadExpenseReport, { isLoading: isDownloadingExpenseReport }] =
    useDownloadMonthlyStockExpenseReportMutation();

  const handleDownloadExpenseReport = async () => {
    try {
      const blob = await downloadExpenseReport({ month: expenseMonth }).unwrap();
      downloadBlob(blob, `stock-expenses-${expenseMonth}.xlsx`);
    } catch (err) {
      toast.error(apiErrorMessage(err as never, t("inventory.errors.download_expense_report", "Could not download the expense report.")));
    }
  };

  const inventory = useMemo(() => inventoryPage?.content ?? [], [inventoryPage]);

  const matchingInventory = useMemo(
    () =>
      inventory.filter((item) => {
        const term = searchTerm.trim().toLowerCase();
        const matchesSearch = !term || item.productName.toLowerCase().includes(term);
        const matchesLevel = !levelFilter || itemLevel(item) === levelFilter;
        return matchesSearch && matchesLevel && matchesKind(item.ingredient, kindFilter);
      }),
    [inventory, searchTerm, levelFilter, kindFilter]
  );
  const view = filteredPage(matchingInventory, inventoryPage, page, size, isFiltering);
  const visibleInventory = view.rows;

  const lowCount = inventory.filter((i) => itemLevel(i) === "LOW").length;
  const outCount = inventory.filter((i) => itemLevel(i) === "OUT").length;

  return (
    <PageShell>
      <PageHeader
        title={t("inventory.title", "Inventory")}
        breadcrumbs={[
          { label: t("breadcrumb.home", "Home"), href: "/" },
          { label: t("inventory.breadcrumb.inventory", "Inventory") },
          { label: t("inventory.breadcrumb.stock_list", "Stock List") },
        ]}
        rightSlot={<AdminTopActions />}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatTile
          title={t("inventory.stats.tracked_products", "Tracked Products")}
          value={String(inventoryPage?.totalElements ?? 0)}
          tone="gray"
        />
        <StatTile
          title={t("inventory.stats.low_stock_page", "Low Stock (this page)")}
          value={String(lowCount)}
          tone={lowCount > 0 ? "orange" : "gray"}
        />
        <StatTile
          title={t("inventory.stats.out_of_stock_page", "Out of Stock (this page)")}
          value={String(outCount)}
          tone={outCount > 0 ? "red" : "gray"}
        />
      </div>

      <FilterPanel>
        <TextField
          label={t("inventory.fields.product_name", "Product Name")}
          placeholder={t("inventory.filters.search_products", "Search products")}
          value={searchTerm}
          onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
        />
        <SelectField
          label={t("inventory.filters.stock_level", "Stock Level")}
          placeholder={t("inventory.filters.all_levels", "All levels")}
          value={levelFilter}
          onChange={(e) => { setLevelFilter(e.target.value); setPage(1); }}
        >
          <option value="OK">{levelLabel.OK}</option>
          <option value="LOW">{levelLabel.LOW}</option>
          <option value="OUT">{levelLabel.OUT}</option>
        </SelectField>
        <ItemKindField value={kindFilter} onChange={(kind) => { setKindFilter(kind); setPage(1); }} />
        <FilterActions
          onClear={() => { setSearchTerm(""); setLevelFilter(""); setKindFilter(""); setPage(1); }}
          onSearch={refetch}
        />
      </FilterPanel>

      <DataCard
        title={t("inventory.card.title", "Stock Levels")}
        meta={t("inventory.card.meta", "Tracked Products: {count}", { count: inventoryPage?.totalElements ?? 0 })}
        actions={
          isAdmin ? (
            <div className="flex flex-wrap items-center gap-3">
              <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                <label className="form_field min-w-0">
                  <DatePickerInput
                    type="month"
                    value={expenseMonth}
                    onChange={setExpenseMonth}
                    className="sm:min-w-[160px]"
                    aria-label={t("inventory.expense.month_aria", "Stock expense report month")}
                  />
                </label>
                <Button
                 
                  onClick={handleDownloadExpenseReport}
                  disabled={isDownloadingExpenseReport || !expenseMonth}
                  variant="outline" className="shrink-0"
                  title={t("inventory.expense.export_tooltip", "Every stock-purchase (stock-in) cost recorded this month, as an Excel file")}
                >
                  {isDownloadingExpenseReport ? t("inventory.expense.exporting", "Exporting...") : t("inventory.expense.export", "Export expenses")}
                  <Download />
                </Button>
              </div>
              <ExcelImportButton
                label={t("inventory.import.label", "Import Stock-In")}
                columnsHint={t("inventory.import.columns_hint", "SKU, Quantity, Unit Cost, Note (optional)")}
                onImport={(file) => stockInFromExcel(file).unwrap()}
                template={{
                  filename: "stock-in-import-template.xlsx",
                  download: () => downloadStockInTemplate().unwrap(),
                }}
              />
              <TableActions onRegister={() => stockAction.open()} primaryLabel={t("inventory.actions.adjust_stock", "Adjust Stock")} />
            </div>
          ) : undefined
        }
      >
        <SimpleTable headers={inventoryTableHeaders}>
          <TableState
            colSpan={inventoryTableHeaders.length}
            isLoading={list.isLoading}
            error={list.error}
            isEmpty={visibleInventory.length === 0}
            emptyLabel={isFiltering ? t("inventory.empty.filtered", "No stock records match these filters.") : t("inventory.empty.none", "No inventory records. Products get a stock row when they are created.")}
            onRetry={refetch}
          />
          {list.showRows &&
            visibleInventory.map((item, index) => {
              const level = itemLevel(item);
              const units = stockUnitsOf(item);
              const perStock = unitsPerStock(units);
              const rowActions: RowAction[] = [[Eye, () => router.push(`/inventory/${item.productId}`), t("actions.view", "View")]];
              if (isAdmin) {
                rowActions.push(
                  [PackagePlus, () => stockAction.open(item, "STOCK_IN"), t("inventory.stock_action.actions.stock_in", "Receive Stock")],
                  [PackageX, () => stockAction.open(item, "WASTE"), t("inventory.stock_action.actions.waste", "Record Waste")],
                  [ClipboardCheck, () => stockAction.open(item, "COUNT"), t("inventory.stock_action.actions.count", "Stock Count")]
                );
              }
              return (
                <Row key={item.productId} striped={index % 2 === 1}>
                  <Cell>{view.offset + index + 1}</Cell>
                  <Cell className="font-semibold">
                    <div className="flex flex-wrap items-center gap-2">
                      {titleCase(item.productName)}
                      {item.ingredient ? <StatusBadge label={t("inventory.kind.ingredient", "Ingredient")} tone="info" /> : null}
                    </div>
                  </Cell>
                  <Cell className="whitespace-nowrap">{formatStock(t, Number(item.quantityOnHand), units)}</Cell>
                  <Cell>
                    {enumLabel(t, "unit", item.unit)}
                    {perStock > 1 ? (
                      <span className="block text-xs text-muted-foreground">
                        {t("inventory.table.per_stock_unit", "{count} per {unit}", { count: perStock, unit: enumLabel(t, "unit", item.stockUnit) })}
                      </span>
                    ) : null}
                  </Cell>
                  <Cell className="whitespace-nowrap">{sellQuantity(t, Number(item.reorderLevel), item.unit)}</Cell>
                  <Cell>
                    <StatusBadge label={levelLabel[level]} tone={LEVEL_TONE[level]} />
                  </Cell>
                  <Cell>
                    <StockRowActions actions={rowActions} />
                  </Cell>
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

      <StockActionModal form={stockAction.form} setForm={stockAction.setForm} />
    </PageShell>
  );
}
