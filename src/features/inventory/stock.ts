import { enumLabel } from "@/lib/enumLabel";
import { formatLocalDate } from "@/lib/dateFormat";
import type { StockUnits } from "@/lib/stockUnits";
import type { TranslationParams } from "@/contexts/translate";
import type { InventoryResponse } from "@/store/api/types";

export type Translate = (key: string, fallback?: string, params?: TranslationParams) => string;

export const stockUnitsOf = (item: Pick<InventoryResponse, "unit" | "stockUnit" | "unitsPerStock">): StockUnits => ({
  sellUnit: item.unit,
  stockUnit: item.stockUnit,
  unitsPerStock: item.unitsPerStock,
});

export type StockLevel = "OUT" | "LOW" | "OK";

export function stockLevel(onHand: number, reorderLevel: number): StockLevel {
  if (onHand <= 0) return "OUT";
  if (onHand <= reorderLevel) return "LOW";
  return "OK";
}

export const LEVEL_TONE: Record<StockLevel, "success" | "warning" | "danger"> = {
  OUT: "danger",
  LOW: "warning",
  OK: "success",
};

// Menu items are sold; ingredients are only used up by recipes. "" shows both.
export type ItemKind = "" | "MENU" | "INGREDIENT";

export const matchesKind = (ingredient: boolean, kind: ItemKind) => !kind || (kind === "INGREDIENT") === ingredient;

export const sellQuantity = (t: Translate, quantity: number, unit: string) =>
  `${quantity.toLocaleString()} ${enumLabel(t, "unit", unit)}`;

// "-$4.50" for a negative value, not "$-4.50".
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export const formatUsd = (value: number) => usd.format(Number(value));

export const shortOrderId = (id: string) => `#${id.slice(0, 8).toUpperCase()}`;

// Multiplying by unitsPerStock in floating point leaves 1.1 kg as 1100.0000000000002 g.
export const isWhole = (value: number) => Math.abs(value - Math.round(value)) < 1e-9;

export function formatDateTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return formatLocalDate(parsed, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
