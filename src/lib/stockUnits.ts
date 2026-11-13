import { enumLabel } from "@/lib/enumLabel";
import type { TranslationParams } from "@/contexts/translate";
import type { Numeric, ProductResponse, ProductVariantResponse, QuantityUnit } from "@/store/api/types";

type Translate = (key: string, fallback?: string, params?: TranslationParams) => string;

// Stock is counted in the product's sell unit (cans); one stock unit (a carton) holds unitsPerStock of them.
export type StockUnits = { sellUnit: string; stockUnit: string; unitsPerStock: Numeric | null | undefined };

export const unitsPerStock = (units: StockUnits) => Math.max(1, Number(units.unitsPerStock) || 1);

// Sell units one sale of this variant takes from stock: 1 can, or 24 for a carton.
export const unitsPerSale = (variant: Pick<ProductVariantResponse, "unitsPerSale">) =>
  Math.max(1, Number(variant.unitsPerSale) || 1);

export const baseQuantity = (quantity: number, unit: QuantityUnit, units: StockUnits) =>
  unit === "PURCHASE" ? quantity * unitsPerStock(units) : quantity;

type StockLine = { product: Pick<ProductResponse, "id">; variant: ProductVariantResponse; quantity: number };

// Can `extra` more of this size go in the order? A recipe size is limited by what its ingredients make right now;
// anything else by its own stock in sell units, a carton counting all its cans. The server re-checks the whole
// order, including ingredients shared between different drinks.
export function hasStockFor(
  product: Pick<ProductResponse, "id" | "quantityOnHand">,
  variant: ProductVariantResponse,
  lines: readonly StockLine[],
  extra = 1,
): boolean {
  if (variant.recipeBased) {
    const inOrder = lines.filter((line) => line.variant.id === variant.id).reduce((sum, line) => sum + line.quantity, 0);
    return inOrder + extra <= (variant.availableQuantity ?? 0);
  }
  const inOrder = lines
    .filter((line) => line.product.id === product.id && !line.variant.recipeBased)
    .reduce((sum, line) => sum + line.quantity * unitsPerSale(line.variant), 0);
  return inOrder + extra * unitsPerSale(variant) <= Number(product.quantityOnHand);
}

// "50 Can", plus "(2 Carton + 2)" when stock is bought in bigger units, so both counts are readable at a glance.
export function formatStock(t: Translate, quantity: number, units: StockUnits): string {
  const sell = `${quantity.toLocaleString()} ${enumLabel(t, "unit", units.sellUnit)}`;
  const perStock = unitsPerStock(units);
  if (perStock <= 1 || quantity < perStock) return sell;
  const whole = Math.floor(quantity / perStock);
  const rest = quantity - whole * perStock;
  const stock = `${whole.toLocaleString()} ${enumLabel(t, "unit", units.stockUnit)}`;
  return `${sell} (${rest > 0 ? `${stock} + ${rest.toLocaleString()}` : stock})`;
}

// "Carton (24 Can)" — what one stock unit holds, for choosing which unit to enter a quantity in.
export function stockUnitSize(t: Translate, units: StockUnits): string {
  const stock = enumLabel(t, "unit", units.stockUnit);
  const perStock = unitsPerStock(units);
  return perStock > 1 ? `${stock} (${perStock} ${enumLabel(t, "unit", units.sellUnit)})` : stock;
}
