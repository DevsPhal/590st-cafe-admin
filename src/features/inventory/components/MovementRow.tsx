"use client";

import Link from "next/link";
import { Cell, Row, StatusBadge } from "@/components/common/AdminKit";
import { useI18n } from "@/contexts/I18nContext";
import { enumLabel } from "@/lib/enumLabel";
import { formatStock, type StockUnits } from "@/lib/stockUnits";
import { cn, titleCase } from "@/lib/utils";
import type { StockMovementReason, StockMovementResponse, StockMovementType } from "@/store/api/types";
import { formatDateTime, formatUsd, sellQuantity, shortOrderId, type Translate } from "../stock";

const REASON_TONE: Record<StockMovementReason, "success" | "danger" | "warning" | "info" | "neutral"> = {
  PURCHASE: "info",
  SALE: "neutral",
  RETURN: "success",
  WASTE: "danger",
  ADJUSTMENT: "warning",
};

export function movementHeaders(t: Translate, { withProduct = false }: { withProduct?: boolean } = {}) {
  return [
    t("fields.date", "Date"),
    ...(withProduct ? [t("fields.product", "Product")] : []),
    t("fields.type", "Type"),
    t("inventory.movement.reason", "Reason"),
    t("inventory.detail.table.strategy", "Strategy"),
    t("fields.quantity", "Quantity"),
    t("inventory.movement.balance_after", "Balance After"),
    t("inventory.movement.cost", "Cost"),
    t("fields.order", "Order"),
    t("inventory.detail.table.performed_by", "Performed By"),
    t("fields.note", "Note"),
  ];
}

function MovementTypeBadge({ type }: { type: StockMovementType }) {
  const { t } = useI18n();
  return (
    <span className={cn("movement_type_badge", type === "STOCK_IN" ? "is_purchase" : "is_sale")}>
      {type === "STOCK_IN" ? t("inventory.movement.stock_in", "Stock In") : t("inventory.movement.stock_out", "Stock Out")}
    </span>
  );
}

export function MovementRow({
  movement,
  striped,
  units,
  withProduct = false,
}: {
  movement: StockMovementResponse;
  striped: boolean;
  // When known, the balance also shows whole cartons.
  units?: StockUnits;
  withProduct?: boolean;
}) {
  const { t } = useI18n();
  const quantity = Number(movement.quantity);
  const signed = movement.type === "STOCK_IN" ? quantity : -quantity;
  const balance = movement.balanceAfter == null ? null : Number(movement.balanceAfter);

  return (
    <Row striped={striped}>
      <Cell className="whitespace-nowrap">{formatDateTime(movement.createdAt)}</Cell>
      {withProduct ? (
        <Cell className="font-semibold">
          <Link href={`/inventory/${movement.productId}`} className="hover:underline">
            {titleCase(movement.productName)}
          </Link>
        </Cell>
      ) : null}
      <Cell>
        <MovementTypeBadge type={movement.type} />
      </Cell>
      <Cell>
        {movement.reason ? (
          <div className="flex flex-col items-start gap-1">
            <StatusBadge label={enumLabel(t, "movement_reason", movement.reason)} tone={REASON_TONE[movement.reason]} />
            {movement.wasteReason ? (
              <span className="text-xs text-muted-foreground">{enumLabel(t, "waste_reason", movement.wasteReason)}</span>
            ) : null}
          </div>
        ) : (
          "-"
        )}
      </Cell>
      <Cell>{movement.strategy ?? "-"}</Cell>
      <Cell className="whitespace-nowrap">
        <span className={cn("qty_change", signed >= 0 ? "is_positive" : "is_negative")}>
          {signed > 0 ? "+" : ""}
          {sellQuantity(t, signed, movement.unit)}
        </span>
      </Cell>
      <Cell className="whitespace-nowrap">
        {balance === null ? "-" : units ? formatStock(t, balance, units) : sellQuantity(t, balance, movement.unit)}
      </Cell>
      <Cell className="whitespace-nowrap">{movement.totalCost == null ? "-" : formatUsd(Number(movement.totalCost))}</Cell>
      <Cell className="whitespace-nowrap font-mono text-xs">
        {movement.orderId ? <span title={movement.orderId}>{shortOrderId(movement.orderId)}</span> : "-"}
      </Cell>
      <Cell>
        {movement.performedByName ? titleCase(movement.performedByName) : "-"}
        {movement.performedByRole ? ` (${enumLabel(t, "role", movement.performedByRole)})` : ""}
      </Cell>
      <Cell>{movement.note || "-"}</Cell>
    </Row>
  );
}
