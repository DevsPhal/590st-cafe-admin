// Who may cancel an order, mirrored from the API (OrderServiceImpl.cancelOrder), so the screens offer Cancel only
// where it will work and say what will happen. The API still decides. Tested in orderCancel.test.mjs.
//
//  - Nothing paid yet (waiting, being made, or a cash order on its way): the staff member handling it, any staff
//    member while nobody has taken it, or an admin. The customer can cancel until it leaves the shop.
//  - Paid in cash: a refund, so an admin only; the cash to hand back is shown.
//  - Paid by Bakong: not here (the refund goes through the bank).
//  - Completed, delivered or already cancelled: never.

export type CancelOrder = {
  status: string;
  paidAt?: string | null;
  paymentMethod?: string | null;
  handledById?: string | null;
  totalAmount: number | string;
  amountTenderedCurrency?: string | null;
  exchangeRate?: number | string | null;
};

export type Canceller = { role: "ADMIN" | "BARISTA"; userId?: string | null };

export type CancelPolicy =
  | { allowed: true; refund: { amount: number; currency: "USD" | "KHR" } | null; stockTaken: boolean }
  | { allowed: false; why: "FINISHED" | "BAKONG_PAID" | "ADMIN_ONLY" | "OTHER_HANDLER" };

const FINISHED = new Set(["COMPLETED", "DELIVERED", "CANCELLED"]);

/** Riel rounded to the nearest 100, 00-50 down and 51-99 up, as the API rounds the receipt total. */
function rielOf(usd: number, rate: number): number {
  const whole = Math.round((Math.round(usd * 100) * Math.round(rate * 10_000)) / 1_000_000);
  const remainder = whole % 100;
  return remainder <= 50 ? whole - remainder : whole - remainder + 100;
}

export function cancelPolicy(order: CancelOrder, who: Canceller): CancelPolicy {
  if (FINISHED.has(order.status)) return { allowed: false, why: "FINISHED" };
  const paid = order.paidAt != null;
  if (paid && order.paymentMethod !== "CASH") return { allowed: false, why: "BAKONG_PAID" };
  if (paid && who.role !== "ADMIN") return { allowed: false, why: "ADMIN_ONLY" };
  if (who.role === "BARISTA" && order.handledById && order.handledById !== who.userId) {
    return { allowed: false, why: "OTHER_HANDLER" };
  }
  let refund: { amount: number; currency: "USD" | "KHR" } | null = null;
  if (paid) {
    const total = Number(order.totalAmount);
    const rate = order.exchangeRate != null ? Number(order.exchangeRate) : null;
    refund = order.amountTenderedCurrency === "KHR" && rate
      ? { amount: rielOf(total, rate), currency: "KHR" }
      : { amount: total, currency: "USD" };
  }
  // Stock is taken once an order is paid or a cash order starts being made: anything past waiting.
  return { allowed: true, refund, stockTaken: order.status !== "PENDING" };
}

export const STAFF_CANCEL_REASONS = [
  ["customer_changed_mind", "Customer changed their mind"],
  ["customer_no_show", "Customer didn't come to collect"],
  ["out_of_stock", "Item ran out"],
  ["wrong_order", "Order entered by mistake"],
  ["delivery_refused", "Customer refused the delivery"],
] as const;
