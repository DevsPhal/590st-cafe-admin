import { translate } from "@/contexts/translate";
import type { StaffCallReason } from "@/store/api/types";

export const STAFF_CALL_REASON_LABELS: Record<StaffCallReason, string> = {
  PAYMENT_HELP: "Help with payment",
  CHANGE_ORDER: "Change order",
  ORDER_DELAY: "Order taking too long",
  WRONG_OR_MISSING_ITEM: "Wrong or missing item",
  NAPKINS_UTENSILS: "Napkins, straws or cutlery",
  DELIVERY_HELP: "Delivery help",
  OTHER: "Something else",
};

// Shown to staff, so it follows the dashboard language (the quick replies below go to customers as written).
export function staffCallReasonLabel(reason: StaffCallReason | null | undefined): string {
  return reason
    ? translate(`enums.call_reason.${reason}`, STAFF_CALL_REASON_LABELS[reason] ?? reason)
    : translate("enums.call_reason.UNKNOWN", "Needs assistance");
}

export const STAFF_CALL_REPLY_LIMIT = 200;

export const STAFF_CALL_QUICK_REPLIES: Record<StaffCallReason, string[]> = {
  PAYMENT_HELP: ["On my way to help with payment.", "Please come to the counter to pay."],
  CHANGE_ORDER: ["Coming over to update your order.", "Sorry, your order is already being made."],
  ORDER_DELAY: ["Almost ready — about 5 more minutes.", "Sorry for the wait, you're next in line."],
  WRONG_OR_MISSING_ITEM: ["Sorry about that — we're fixing it now.", "Coming over to check your order."],
  NAPKINS_UTENSILS: ["Bringing them to you now.", "They're at the pickup counter."],
  DELIVERY_HELP: ["We'll call you shortly about your delivery.", "Your rider is on the way."],
  OTHER: ["On my way!", "Please come to the counter."],
};

export function staffCallQuickReplies(reason: StaffCallReason | null | undefined): string[] {
  return STAFF_CALL_QUICK_REPLIES[reason ?? "OTHER"];
}
