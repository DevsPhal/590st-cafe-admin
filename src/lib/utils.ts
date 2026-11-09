import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { parseShopDateTime } from "@/lib/estimate";
import { translate } from "@/contexts/translate";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function humanise(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// "Table 02" for dine-in, "Take away" for a POS take-away, otherwise "Pickup" / "Delivery", in the current language.
export function fulfillmentLabel(order: {
  fulfillmentMethod: string | null;
  tableNumber?: string | null;
  orderType?: string | null;
}): string {
  if (order.orderType === "TAKE_AWAY") return translate("fulfillment.take_away", "Take away");
  if (order.fulfillmentMethod === "DINE_IN") {
    return order.tableNumber
      ? translate("fulfillment.table", "Table {number}", { number: order.tableNumber })
      : translate("fulfillment.dine_in", "Dine-in");
  }
  if (order.fulfillmentMethod === "PICKUP") return translate("fulfillment.pickup", "Pickup");
  if (order.fulfillmentMethod === "DELIVERY") return translate("fulfillment.delivery", "Delivery");
  return order.fulfillmentMethod ? humanise(order.fulfillmentMethod) : "";
}

export function formatSku(sku: string): string {
  return sku.toUpperCase();
}

export function printPdfBlob(blob: Blob) {
  const url = URL.createObjectURL(blob);
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText =
    "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  frame.onload = () => {
    try {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
    } catch {
      window.open(url, "_blank");
    }
    setTimeout(() => {
      frame.remove();
      URL.revokeObjectURL(url);
    }, 60_000);
  };
  frame.src = url;
  document.body.appendChild(frame);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export function titleCase(value: string): string {
  return value.replace(
    /\S+/g,
    (word) => word.charAt(0).toUpperCase() + word.slice(1),
  );
}

function formatMoney(value: number): string {
  return `$${value.toFixed(2)}`;
}

export function formatByCurrency(
  value: number | string | null | undefined,
  currency: "USD" | "KHR" | null | undefined,
): string {
  if (value == null) return "-";
  const amount = Number(value);
  if (currency === "KHR") return `${Math.round(amount).toLocaleString()} ៛`;
  return `$${amount.toFixed(2)}`;
}

export function timeAgo(value: string, now = Date.now()): string {
  const then = parseShopDateTime(value).getTime();
  if (Number.isNaN(then)) return "";
  const minutes = Math.max(0, Math.round((now - then) / 60000));
  if (minutes < 60) return translate("time.minutes_ago", "{count} min ago", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return translate("time.hours_ago", "{count} hr ago", { count: hours });
  return translate("time.days_ago", "{count} d ago", { count: Math.floor(hours / 24) });
}

/**
 * The active variants' price, or their range ("$1.00–$1.50"). By default the price customers pay now
 * (finalPrice, after any running discount); pass "price" for the price before the discount.
 */
export function productPriceLabel(
  variants: { finalPrice: number; price?: number; status: string }[],
  field: "finalPrice" | "price" = "finalPrice",
): string {
  const active = variants
    .filter((v) => v.status === "ACTIVE")
    .map((v) => Number(v[field] ?? v.finalPrice));
  if (active.length === 0) return translate("price.none", "No price set");
  const min = Math.min(...active);
  const max = Math.max(...active);
  return min === max
    ? formatMoney(min)
    : `${formatMoney(min)}–${formatMoney(max)}`;
}

/** How much a running discount takes off ("20%" or "$0.50"); null when the product has no discount right now. */
export function discountAmountLabel(product: {
  discountActive: boolean;
  discountType: "PERCENTAGE" | "FIXED" | null;
  discountValue: number | null;
}): string | null {
  if (!product.discountActive || product.discountValue == null) return null;
  const value = Number(product.discountValue);
  return product.discountType === "PERCENTAGE" ? `${value}%` : formatMoney(value);
}
