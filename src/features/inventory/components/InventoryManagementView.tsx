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
  FormInput,
  FormModal,
  FormProductSelect,
  FormSelect,
  FormTextarea,
  ModalGrid,
  PaginationFooter,
  ProductSelectOption,
  Row,
  RowActions,
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
import {
  useDownloadMonthlyStockExpenseReportMutation,
  useListInventoryQuery,
  useStockCutMutation,
  useStockInFromExcelMutation,
  useStockInMutation,
} from "@/store/api/inventoryApi";
import { useListProductsQuery } from "@/store/api/productApi";
import { useCurrentRole } from "@/store/api/useCurrentRole";
import type { InventoryResponse, StockStrategy } from "@/store/api/types";
import { downloadBlob, humanise, titleCase } from "@/lib/utils";
import { useInventoryAlerts } from "@/hooks/useInventoryAlerts";
import { usePersistentState } from "@/hooks/usePersistentState";

const INVENTORY_TABLE_HEADERS = [
  "No",
  "Product Name",
  "Current Stock",
  "Unit",
  "Reorder Level",
  "Status",
  "Action",
] as const;

/** The API models movements as stock-in (a purchase with a cost) or stock-cut (a draw-down). */
type MovementKind = "STOCK_IN" | "STOCK_CUT";

type StockLevel = "OUT" | "LOW" | "OK";

function stockLevel(item: InventoryResponse): StockLevel {
  const onHand = Number(item.quantityOnHand);
  if (onHand <= 0) return "OUT";
  if (onHand <= Number(item.reorderLevel)) return "LOW";
  return "OK";
}

const LEVEL_LABEL: Record<StockLevel, string> = {
  OUT: "Out of Stock",
  LOW: "Low Stock",
  OK: "In Stock",
};

const LEVEL_TONE: Record<StockLevel, "success" | "warning" | "danger"> = {
  OUT: "danger",
  LOW: "warning",
  OK: "success",
};

export default function Inventory() {
  const { isAdmin } = useCurrentRole();
  const router = useRouter();

  const [page, setPage] = usePersistentState("inventory:page", 1);
  const [size, setSize] = usePageSize();
  const [searchTerm, setSearchTerm] = usePersistentState("inventory:searchTerm", "");
  const [levelFilter, setLevelFilter] = usePersistentState("inventory:levelFilter", "");
  // yyyy-MM, matching both <input type="month"> and the API's own YearMonth param.
  const [expenseMonth, setExpenseMonth] = usePersistentState("inventory:expenseMonth", () => new Date().toISOString().slice(0, 7));

  const {
    data: inventoryPage,
    currentData,
    isFetching,
    error,
    refetch,
  } = useListInventoryQuery({ page, size });
  const list = listLoadState({ isFetching, currentData, error });

  // A stock-in, stock-cut or Excel import from another tab reaches this list instantly instead
  // of only on this page's own next mutation or a manual refresh.
  useInventoryAlerts(useCallback(() => { void refetch(); }, [refetch]));

  // The inventory rows carry no SKU, so pair them with the product list for the picker.
  const { data: productPage } = useListProductsQuery({ page: 1, size: 500 });

  const [stockIn, { isLoading: isStockingIn }] = useStockInMutation();
  const [stockCut, { isLoading: isCutting }] = useStockCutMutation();
  const [stockInFromExcel] = useStockInFromExcelMutation();
  const [downloadExpenseReport, { isLoading: isDownloadingExpenseReport }] =
    useDownloadMonthlyStockExpenseReportMutation();

  const handleDownloadExpenseReport = async () => {
    try {
      const blob = await downloadExpenseReport({ month: expenseMonth }).unwrap();
      downloadBlob(blob, `stock-expenses-${expenseMonth}.xlsx`);
    } catch (err) {
      toast.error(apiErrorMessage(err as never, "Could not download the expense report."));
    }
  };

  const [formOpen, setFormOpen] = usePersistentState("inventory:formOpen", false);
  const [selectedProduct, setSelectedProduct] = usePersistentState<ProductSelectOption | null>("inventory:selectedProduct", null);
  const [movementKind, setMovementKind] = usePersistentState<MovementKind>("inventory:movementKind", "STOCK_IN");
  const [quantity, setQuantity] = usePersistentState("inventory:quantity", "");
  const [unitCost, setUnitCost] = usePersistentState("inventory:unitCost", "");
  const [strategy, setStrategy] = usePersistentState<StockStrategy>("inventory:strategy", "FIFO");
  const [note, setNote] = usePersistentState("inventory:note", "");

  const inventory = useMemo(() => inventoryPage?.content ?? [], [inventoryPage]);

  const productOptions = useMemo<ProductSelectOption[]>(
    () =>
      (productPage?.content ?? []).map((product) => ({
        id: product.id,
        name: product.name,
        sku: product.sku,
        currentStock: Number(product.quantityOnHand),
        unit: humanise(product.stockUnit),
      })),
    [productPage]
  );

  const visibleInventory = useMemo(
    () =>
      inventory.filter((item) => {
        const term = searchTerm.trim().toLowerCase();
        const matchesSearch = !term || item.productName.toLowerCase().includes(term);
        const matchesLevel = !levelFilter || stockLevel(item) === levelFilter;
        return matchesSearch && matchesLevel;
      }),
    [inventory, searchTerm, levelFilter]
  );

  const lowCount = inventory.filter((i) => stockLevel(i) === "LOW").length;
  const outCount = inventory.filter((i) => stockLevel(i) === "OUT").length;

  const handleOpenForm = (item?: InventoryResponse) => {
    if (!isAdmin) return;
    const option = item
      ? productOptions.find((p) => p.id === item.productId) ?? {
          id: item.productId,
          name: item.productName,
          sku: "-",
          currentStock: Number(item.quantityOnHand),
          unit: humanise(item.unit),
        }
      : null;
    setSelectedProduct(option);
    setMovementKind("STOCK_IN");
    setQuantity("");
    setUnitCost("");
    setStrategy("FIFO");
    setNote("");
    setFormOpen(true);
  };

  const handleSubmit = async () => {
    if (!isAdmin) return;
    if (!selectedProduct) {
      toast.error("Choose a product first");
      return;
    }
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      toast.error("Quantity must be greater than zero");
      return;
    }

    try {
      if (movementKind === "STOCK_IN") {
        const cost = Number(unitCost);
        if (!Number.isFinite(cost) || cost < 0) {
          toast.error("Enter a valid unit cost");
          return;
        }
        await stockIn({
          productId: selectedProduct.id,
          quantity: qty,
          unitCost: cost,
          note: note.trim() || undefined,
        }).unwrap();
        toast.success(`Stocked in ${qty} ${selectedProduct.unit}`);
      } else {
        await stockCut({
          productId: selectedProduct.id,
          quantity: qty,
          strategy,
          note: note.trim() || undefined,
        }).unwrap();
        toast.success(`Cut ${qty} ${selectedProduct.unit}`);
      }
      setFormOpen(false);
    } catch (err) {
      toast.error(apiErrorMessage(err as never, "Could not record the stock movement."));
    }
  };

  const isSaving = isStockingIn || isCutting;

  return (
    <PageShell>
      <PageHeader
        title="Inventory"
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Inventory" },
          { label: "Stock List" },
        ]}
        rightSlot={<AdminTopActions />}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatTile
          title="Tracked Products"
          value={String(inventoryPage?.totalElements ?? 0)}
          tone="gray"
        />
        <StatTile
          title="Low Stock (this page)"
          value={String(lowCount)}
          tone={lowCount > 0 ? "orange" : "gray"}
        />
        <StatTile
          title="Out of Stock (this page)"
          value={String(outCount)}
          tone={outCount > 0 ? "red" : "gray"}
        />
      </div>

      <FilterPanel>
        <TextField
          label="Product Name"
          placeholder="Search products"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <SelectField
          label="Stock Level"
          placeholder="All levels"
          value={levelFilter}
          onChange={(e) => setLevelFilter(e.target.value)}
        >
          <option value="OK">In Stock</option>
          <option value="LOW">Low Stock</option>
          <option value="OUT">Out of Stock</option>
        </SelectField>
        <FilterActions onClear={() => { setSearchTerm(""); setLevelFilter(""); setPage(1); }} onSearch={refetch} />
      </FilterPanel>

      <DataCard
        title="Stock Levels"
        meta={`Tracked Products: ${inventoryPage?.totalElements ?? 0}`}
        actions={
          isAdmin ? (
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="form_field w-auto">
                  <input
                    type="month"
                    value={expenseMonth}
                    onChange={(e) => setExpenseMonth(e.target.value)}
                    className="form_field_control"
                    aria-label="Stock expense report month"
                    title="Month to export"
                  />
                </label>
                <button
                  type="button"
                  onClick={handleDownloadExpenseReport}
                  disabled={isDownloadingExpenseReport || !expenseMonth}
                  className="btn_outline_black text-xs"
                  title="Every stock-purchase (stock-in) cost recorded this month, as an Excel file"
                >
                  {isDownloadingExpenseReport ? "Exporting..." : "Export Stock Expenses"}
                </button>
              </div>
              <ExcelImportButton
                label="Import Stock-In"
                columnsHint="sku, quantity, unitCost, note"
                onImport={(file) => stockInFromExcel(file).unwrap()}
              />
              <TableActions onRegister={() => handleOpenForm()} primaryLabel="Adjust Stock" />
            </div>
          ) : undefined
        }
      >
        <SimpleTable headers={[...INVENTORY_TABLE_HEADERS]}>
          <TableState
            colSpan={INVENTORY_TABLE_HEADERS.length}
            isLoading={list.isLoading}
            error={list.error}
            isEmpty={visibleInventory.length === 0}
            emptyLabel="No inventory records. Products get a stock row when they are created."
            onRetry={refetch}
          />
          {list.showRows &&
            visibleInventory.map((item, index) => {
              const level = stockLevel(item);
              return (
                <Row key={item.productId} striped={index % 2 === 1}>
                  <Cell>{(page - 1) * size + index + 1}</Cell>
                  <Cell className="font-semibold">{titleCase(item.productName)}</Cell>
                  <Cell>{Number(item.quantityOnHand).toLocaleString()}</Cell>
                  <Cell>{humanise(item.unit)}</Cell>
                  <Cell>{Number(item.reorderLevel).toLocaleString()}</Cell>
                  <Cell>
                    <StatusBadge label={LEVEL_LABEL[level]} tone={LEVEL_TONE[level]} />
                  </Cell>
                  <Cell>
                    <RowActions
                      onView={() => router.push(`/inventory/${item.productId}`)}
                      onEdit={isAdmin ? () => handleOpenForm(item) : undefined}
                      isLoading={isSaving}
                    />
                  </Cell>
                </Row>
              );
            })}
        </SimpleTable>
        <PaginationFooter
          page={inventoryPage?.page ?? page}
          totalPages={inventoryPage?.totalPages ?? 1}
          size={size}
          totalElements={inventoryPage?.totalElements}
          onPageChange={setPage}
          onSizeChange={(next) => {
            setSize(next);
            setPage(1);
          }}
        />
      </DataCard>

      <FormModal
        open={isAdmin && formOpen}
        onOpenChange={setFormOpen}
        title="Stock Movement"
        submitLabel="Submit"
        onSubmit={handleSubmit}
        isLoading={isSaving}
      >
        <ModalGrid>
          <div className="md:col-span-3">
            <FormProductSelect
              label="Product"
              required
              options={productOptions}
              value={selectedProduct}
              onChange={setSelectedProduct}
            />
          </div>
          <FormSelect
            label="Movement"
            placeholder="Select movement"
            value={movementKind}
            onChange={(e) => setMovementKind(e.target.value as MovementKind)}
            required
          >
            <option value="STOCK_IN">Stock In (purchase)</option>
            <option value="STOCK_CUT">Stock Cut (draw-down)</option>
          </FormSelect>
          <FormInput
            label="Quantity"
            type="number"
            placeholder="0"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
          />
          {movementKind === "STOCK_IN" ? (
            <FormInput
              label="Unit Cost (USD)"
              type="number"
              placeholder="0.00"
              value={unitCost}
              onChange={(e) => setUnitCost(e.target.value)}
              required
            />
          ) : (
            /* Which cost layers the cut consumes — FIFO takes the oldest batch first. */
            <FormSelect
              label="Costing Strategy"
              placeholder="Select strategy"
              value={strategy}
              onChange={(e) => setStrategy(e.target.value as StockStrategy)}
              required
            >
              <option value="FIFO">FIFO (oldest batch first)</option>
              <option value="LIFO">LIFO (newest batch first)</option>
            </FormSelect>
          )}
          <div className="md:col-span-3">
            <FormTextarea
              label="Note"
              placeholder="Optional reason or reference"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          {selectedProduct ? (
            <p className="md:col-span-3 text-sm text-muted-foreground">
              Current stock: {selectedProduct.currentStock} {selectedProduct.unit}
            </p>
          ) : null}
        </ModalGrid>
      </FormModal>
    </PageShell>
  );
}
