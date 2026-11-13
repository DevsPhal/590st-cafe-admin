"use client";

import Link from "next/link";
import { useCallback } from "react";
import { PageShell } from "@/components/common/PageShell";
import { PageHeader } from "@/components/common/PageHeader";
import {
  AdminTopActions,
  Cell,
  DataCard,
  PaginationFooter,
  Row,
  SimpleTable,
  StatTile,
  StatusBadge,
  TableState,
  listLoadState,
} from "@/components/common/AdminKit";
import {
  useGetInventoryByProductQuery,
  useListStockMovementsQuery,
} from "@/store/api/inventoryApi";
import { useGetProductQuery } from "@/store/api/productApi";
import { usePageSize } from "@/contexts/AdminPreferencesContext";
import type { StockMovementType } from "@/store/api/types";
import { cn, formatSku, humanise, productPriceLabel, titleCase } from "@/lib/utils";
import { useInventoryAlerts } from "@/hooks/useInventoryAlerts";
import { usePersistentState } from "@/hooks/usePersistentState";

const MOVEMENT_TABLE_HEADERS = [
  "Date",
  "Type",
  "Strategy",
  "Quantity",
  "Performed By",
  "Note",
] as const;

function MovementTypeBadge({ type }: { type: StockMovementType }) {
  return (
    <span
      className={cn(
        "movement_type_badge",
        type === "STOCK_IN" ? "is_purchase" : "is_sale"
      )}
    >
      {type === "STOCK_IN" ? "Stock In" : "Stock Out"}
    </span>
  );
}

/** Stock-in adds, stock-out subtracts — the API sends both as a positive magnitude. */
function QuantityChange({
  value,
  type,
}: {
  value: number;
  type: StockMovementType;
}) {
  const signed = type === "STOCK_IN" ? value : -value;
  return (
    <span className={cn("qty_change", signed >= 0 ? "is_positive" : "is_negative")}>
      {signed > 0 ? "+" : ""}
      {signed}
    </span>
  );
}

function formatDateTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function InventoryDetailView({ productId }: { productId: string }) {
  const [page, setPage] = usePersistentState(`inventory-${productId}:page`, 1);
  const [size, setSize] = usePageSize();

  const {
    data: item,
    isLoading: isLoadingItem,
    error: itemError,
    refetch: refetchItem,
  } = useGetInventoryByProductQuery(productId);

  const { data: product } = useGetProductQuery(productId);

  const movementsQuery = useListStockMovementsQuery({ productId, page, size });
  const { data: movementPage, refetch } = movementsQuery;
  const movements = listLoadState(movementsQuery);

  // Only this product's own stock changes matter here — a stock-in/cut elsewhere reaches every
  // other open tab on this same product instantly instead of on the next manual refresh.
  useInventoryAlerts(
    useCallback(
      (message) => {
        if (message.id !== productId) return;
        void refetchItem();
        void refetch();
      },
      [productId, refetchItem, refetch]
    )
  );

  const breadcrumbs = [
    { label: "Home", href: "/" },
    { label: "Inventory", href: "/inventory" },
    { label: item?.productName ? titleCase(item.productName) : "Detail" },
  ];

  if (itemError) {
    return (
      <PageShell>
        <PageHeader
          title="Inventory Detail"
          breadcrumbs={breadcrumbs}
          rightSlot={<AdminTopActions />}
        />
        <DataCard title="Not Found">
          <p className="py-8 text-center text-sm text-muted-foreground">
            No inventory record for this product.{" "}
            <Link href="/inventory" className="underline">
              Back to inventory
            </Link>
          </p>
        </DataCard>
      </PageShell>
    );
  }

  const onHand = Number(item?.quantityOnHand ?? 0);
  const reorder = Number(item?.reorderLevel ?? 0);
  const level = onHand <= 0 ? "OUT" : onHand <= reorder ? "LOW" : "OK";

  return (
    <PageShell>
      <PageHeader
        title={item?.productName ? titleCase(item.productName) : "Inventory Detail"}
        breadcrumbs={breadcrumbs}
        rightSlot={<AdminTopActions />}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatTile
          title="On Hand"
          value={isLoadingItem ? "..." : `${onHand} ${item?.unit ? humanise(item.unit) : ""}`}
          tone={level === "OK" ? "green" : level === "LOW" ? "orange" : "red"}
        />
        <StatTile
          title="Reorder Level"
          value={isLoadingItem ? "..." : `${reorder} ${item?.unit ? humanise(item.unit) : ""}`}
          tone="gray"
        />
        <StatTile
          title="Price"
          value={product ? productPriceLabel(product.variants) : "-"}
          tone="gray"
        />
        <StatTile
          title="SKU"
          value={product?.sku ? formatSku(product.sku) : "-"}
          tone="gray"
          size="compact"
        />
      </div>

      <DataCard
        title="Stock Movements"
        meta={`Total Movements: ${movementPage?.totalElements ?? 0}`}
        actions={
          <StatusBadge
            label={
              level === "OK" ? "In Stock" : level === "LOW" ? "Low Stock" : "Out of Stock"
            }
            tone={level === "OK" ? "success" : level === "LOW" ? "warning" : "danger"}
          />
        }
      >
        <SimpleTable headers={[...MOVEMENT_TABLE_HEADERS]}>
          <TableState
            colSpan={MOVEMENT_TABLE_HEADERS.length}
            isLoading={movements.isLoading}
            error={movements.error}
            isEmpty={(movementPage?.content.length ?? 0) === 0}
            emptyLabel="No stock movements recorded for this product yet."
            onRetry={refetch}
          />
          {movements.showRows &&
            (movementPage?.content ?? []).map((movement, index) => (
              <Row key={movement.id} striped={index % 2 === 1}>
                <Cell>{formatDateTime(movement.createdAt)}</Cell>
                <Cell>
                  <MovementTypeBadge type={movement.type} />
                </Cell>
                <Cell>{movement.strategy ?? "-"}</Cell>
                <Cell>
                  <QuantityChange
                    value={Number(movement.quantity)}
                    type={movement.type}
                  />
                </Cell>
                <Cell>
                  {movement.performedByName ? titleCase(movement.performedByName) : "-"}
                  {movement.performedByRole ? ` (${humanise(movement.performedByRole)})` : ""}
                </Cell>
                <Cell>{movement.note || "-"}</Cell>
              </Row>
            ))}
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
