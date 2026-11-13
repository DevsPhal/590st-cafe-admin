import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** API enum values are SCREAMING_SNAKE_CASE; this is the one place that turns them into
 * display text — e.g. "PENDING_VERIFICATION" -> "Pending Verification". */
export function humanise(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** SugarLevel/IceLevel are drink customisation percentages, clearer as "25%" than "Twenty Five". */
const LEVEL_PERCENT: Record<string, string> = {
  ZERO: "0%",
  TWENTY_FIVE: "25%",
  FIFTY: "50%",
  SEVENTY_FIVE: "75%",
  HUNDRED: "100%",
};

export function formatLevel(level: string): string {
  return LEVEL_PERCENT[level] ?? humanise(level);
}

/** SKUs are a business code, always displayed uppercase regardless of how they were typed. */
export function formatSku(sku: string): string {
  return sku.toUpperCase();
}

// Prints a PDF through a hidden iframe so the print dialog opens without leaving the page.
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
      // Print blocked (e.g. some mobile browsers) — let the browser show the PDF instead.
      window.open(url, "_blank");
    }
    // Long enough for the print dialog to have spooled the document.
    setTimeout(() => {
      frame.remove();
      URL.revokeObjectURL(url);
    }, 60_000);
  };
  frame.src = url;
  document.body.appendChild(frame);
}

// A one-off download of a blob, e.g. an invoice PDF or a CSV export, without leaving the current page.
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoking in the same tick can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

/** Capitalises the first letter of every word, leaving the rest as typed. */
export function titleCase(value: string): string {
  return value.replace(
    /\S+/g,
    (word) => word.charAt(0).toUpperCase() + word.slice(1),
  );
}

function formatMoney(value: number): string {
  return `$${value.toFixed(2)}`;
}

/// The one place that turns a plain number into money for display, currency-aware. Riel has no
/// decimals, so it is rounded and shown with the ៛ sign; everything else is dollars.
export function formatByCurrency(
  value: number | string | null | undefined,
  currency: "USD" | "KHR" | null | undefined,
): string {
  if (value == null) return "-";
  const amount = Number(value);
  if (currency === "KHR") return `${Math.round(amount).toLocaleString()} ៛`;
  return `$${amount.toFixed(2)}`;
}

/** "5 min ago" / "3 hr ago" / "2 d ago" — for a live queue where how long something has been
 * waiting matters more than the clock time it happened at (a staff call, a pending order). */
export function timeAgo(value: string): string {
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return "";
  const minutes = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.floor(hours / 24)} d ago`;
}

/** A product's price as shown in lists: one price, or a "min–max" range across active variants. */
export function productPriceLabel(
  variants: { finalPrice: number; status: string }[],
): string {
  const active = variants
    .filter((v) => v.status === "ACTIVE")
    .map((v) => Number(v.finalPrice));
  if (active.length === 0) return "No price set";
  const min = Math.min(...active);
  const max = Math.max(...active);
  return min === max
    ? formatMoney(min)
    : `${formatMoney(min)}–${formatMoney(max)}`;
}
