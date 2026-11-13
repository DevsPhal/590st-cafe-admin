import { formatLocalDate } from "@/lib/dateFormat";
import { parseShopDateTime, SHOP_TIME_ZONE } from "@/lib/estimate";
import type {
  FulfillmentMethod,
  OrderChannel,
  OrderSearchParams,
  OrderStatus,
  OrderStatusSummary,
  PaymentMethod,
} from "@/store/api/types";

export const money = (value: number | null | undefined) =>
  value == null ? "-" : `$${Number(value).toFixed(2)}`;

// The API sends shop wall-clock times, so they read the same on a device set to another time zone.
export function formatShopDateTime(value: string): string {
  const parsed = parseShopDateTime(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return formatLocalDate(parsed, {
    timeZone: SHOP_TIME_ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const QUEUE_TABS = [
  "ALL",
  "AWAITING_PAYMENT",
  "NEW_PAID",
  "PREPARING",
  "OUT_FOR_DELIVERY",
  "COMPLETED",
  "CANCELLED",
] as const;

export type QueueTab = (typeof QUEUE_TABS)[number];

// The order statuses each tab lists; "All" lists every status. A delivered order counts as completed.
export const TAB_STATUSES: Record<QueueTab, OrderStatus[] | undefined> = {
  ALL: undefined,
  AWAITING_PAYMENT: ["PENDING"],
  NEW_PAID: ["PAID"],
  PREPARING: ["PREPARING"],
  OUT_FOR_DELIVERY: ["OUT_FOR_DELIVERY"],
  COMPLETED: ["COMPLETED", "DELIVERED"],
  CANCELLED: ["CANCELLED"],
};

// History tabs change slowly; the live ones refresh faster, as the old status columns did.
export const HISTORY_TABS: ReadonlySet<QueueTab> = new Set<QueueTab>(["COMPLETED", "CANCELLED"]);

export type QueueTone = "neutral" | "amber" | "blue" | "violet" | "cyan" | "green" | "red";

export const TAB_TONE: Record<QueueTab, QueueTone> = {
  ALL: "neutral",
  AWAITING_PAYMENT: "amber",
  NEW_PAID: "blue",
  PREPARING: "violet",
  OUT_FOR_DELIVERY: "cyan",
  COMPLETED: "green",
  CANCELLED: "red",
};

export const STATUS_TONE: Record<OrderStatus, QueueTone> = {
  PENDING: "amber",
  PAID: "blue",
  PREPARING: "violet",
  OUT_FOR_DELIVERY: "cyan",
  COMPLETED: "green",
  DELIVERED: "green",
  CANCELLED: "red",
};

// Written out in full so Tailwind finds every class. The pale tints and dark text shades follow the
// dark theme on their own (see globals.scss); the -500 fills stay bright on both themes.
export const TONE_CLASSES: Record<QueueTone, { dot: string; badge: string; accent: string }> = {
  neutral: { dot: "bg-gray-400", badge: "bg-gray-100 text-gray-700", accent: "border-l-gray-300" },
  amber: { dot: "bg-amber-500", badge: "bg-amber-100 text-amber-800", accent: "border-l-amber-500" },
  blue: { dot: "bg-blue-500", badge: "bg-blue-100 text-blue-700", accent: "border-l-blue-500" },
  violet: { dot: "bg-violet-500", badge: "bg-violet-100 text-violet-700", accent: "border-l-violet-500" },
  cyan: { dot: "bg-cyan-500", badge: "bg-cyan-100 text-cyan-800", accent: "border-l-cyan-500" },
  green: { dot: "bg-green-500", badge: "bg-green-100 text-green-800", accent: "border-l-green-500" },
  red: { dot: "bg-red-500", badge: "bg-red-100 text-red-700", accent: "border-l-red-500" },
};

// One "order type" choice covers both where the order came from and how it is handed over.
export type OrderTypeFilter = "" | OrderChannel | FulfillmentMethod;

export interface QueueFilters {
  search: string;
  /** yyyy-MM-dd shop days, or "" for no limit. */
  from: string;
  to: string;
  orderType: OrderTypeFilter;
  paymentMethod: "" | PaymentMethod;
}

export const EMPTY_FILTERS: QueueFilters = { search: "", from: "", to: "", orderType: "", paymentMethod: "" };

export const QUEUE_PAGE_SIZES = [12, 24, 48] as const;
export const DEFAULT_QUEUE_PAGE_SIZE = 24;

export function hasActiveFilters(filters: QueueFilters): boolean {
  return Boolean(filters.search.trim() || filters.from || filters.to || filters.orderType || filters.paymentMethod);
}

export function toSearchParams(filters: QueueFilters): OrderSearchParams {
  const params: OrderSearchParams = {};
  const search = filters.search.trim();
  if (search) params.search = search;
  if (filters.from) params.from = filters.from;
  if (filters.to) params.to = filters.to;
  if (filters.orderType === "WALK_IN" || filters.orderType === "ONLINE") params.channel = filters.orderType;
  else if (filters.orderType) params.fulfillment = filters.orderType;
  if (filters.paymentMethod) params.paymentMethod = filters.paymentMethod;
  return params;
}

export interface StatusTotals {
  count: (statuses?: readonly OrderStatus[]) => number;
  amount: (status: OrderStatus) => number;
}

export function statusTotals(summary: OrderStatusSummary[]): StatusTotals {
  const byStatus = new Map(summary.map((row) => [row.status, row]));
  return {
    count: (statuses) =>
      statuses
        ? statuses.reduce((sum, status) => sum + (byStatus.get(status)?.count ?? 0), 0)
        : summary.reduce((sum, row) => sum + row.count, 0),
    amount: (status) => Number(byStatus.get(status)?.totalAmount ?? 0),
  };
}

// Values saved in session storage by an older build may not fit today's shapes.
export function readTab(value: unknown): QueueTab {
  return QUEUE_TABS.includes(value as QueueTab) ? (value as QueueTab) : "ALL";
}

export function readFilters(value: unknown): QueueFilters {
  return value && typeof value === "object" ? { ...EMPTY_FILTERS, ...(value as Partial<QueueFilters>) } : EMPTY_FILTERS;
}
