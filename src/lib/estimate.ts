import type { OrderResponse, OrderStatus } from "@/store/api/types";
import { formatLocalDate } from "@/lib/dateFormat";

export const SHOP_TIME_ZONE = "Asia/Phnom_Penh";
export const ESTIMATE_MAX_MINUTES = 240;
export const ESTIMATE_QUICK_MINUTES = [5, 10, 15, 20, 30] as const;

const HAS_OFFSET = /(Z|[+-]\d{2}:?\d{2})$/;
const FINISHED_STATUSES: OrderStatus[] = ["COMPLETED", "DELIVERED", "CANCELLED"];

export function parseShopDateTime(value: string): Date {
  return new Date(HAS_OFFSET.test(value) ? value : `${value}+07:00`);
}

export function formatShopClock(date: Date): string {
  return formatLocalDate(date, { timeZone: SHOP_TIME_ZONE, hour: "numeric", minute: "2-digit" }, "en-US");
}

export function isOrderFinished(status: OrderStatus): boolean {
  return FINISHED_STATUSES.includes(status);
}

export type OrderEstimate =
  | { state: "none" }
  | { state: "finished" }
  | { state: "counting"; minutesLeft: number; clock: string }
  | { state: "due"; clock: string };

export function getOrderEstimate(
  order: Pick<OrderResponse, "status" | "estimatedReadyAt">,
  now: number
): OrderEstimate {
  if (isOrderFinished(order.status)) return { state: "finished" };
  if (!order.estimatedReadyAt) return { state: "none" };
  const readyAt = parseShopDateTime(order.estimatedReadyAt);
  if (Number.isNaN(readyAt.getTime())) return { state: "none" };
  const clock = formatShopClock(readyAt);
  const minutesLeft = Math.ceil((readyAt.getTime() - now) / 60_000);
  return minutesLeft > 0 ? { state: "counting", minutesLeft, clock } : { state: "due", clock };
}
