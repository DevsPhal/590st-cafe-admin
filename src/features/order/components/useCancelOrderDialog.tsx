"use client";

import { useRef, useState } from "react";
import { Banknote, Recycle, Undo2 } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormTextarea } from "@/components/common/AdminKit";
import { Button } from "@/components/common/Button";
import { useI18n } from "@/contexts/I18nContext";
import { orderCode } from "@/hooks/useOrderInvoice";
import { STAFF_CANCEL_REASONS, type CancelPolicy } from "@/lib/orderCancel";
import { cn } from "@/lib/utils";
import type { CancelOrderRequest, OrderResponse } from "@/store/api/types";

type Allowed = Extract<CancelPolicy, { allowed: true }>;
type Request = { order: OrderResponse; policy: Allowed };

/**
 * Asks why an order is being cancelled, what happens to stock already taken for it, and shows the cash to hand
 * back for a paid order. Resolves to the request body to send, or null when the staff keep the order.
 */
export function useCancelOrderDialog() {
  const { t } = useI18n();
  const [request, setRequest] = useState<Request | null>(null);
  const [preset, setPreset] = useState<string | null>(null);
  const [details, setDetails] = useState("");
  const [restock, setRestock] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const resolver = useRef<((value: CancelOrderRequest | null) => void) | null>(null);

  const askCancel = (order: OrderResponse, policy: Allowed) => {
    setRequest({ order, policy });
    setPreset(null);
    setDetails("");
    setRestock(true);
    setError(undefined);
    return new Promise<CancelOrderRequest | null>((resolve) => {
      resolver.current = resolve;
    });
  };

  const settle = (value: CancelOrderRequest | null) => {
    resolver.current?.(value);
    resolver.current = null;
    setRequest(null);
  };

  const confirm = () => {
    const chosen = preset ? t(`orders.cancel.reasons.${preset}`, STAFF_CANCEL_REASONS.find(([key]) => key === preset)?.[1] ?? "") : "";
    const extra = details.trim();
    const reason = chosen && extra ? `${chosen}: ${extra}` : chosen || extra;
    if (!reason) {
      setError(t("orders.cancel.reason_required", "Choose a reason or write one."));
      return;
    }
    settle({ reason: reason.slice(0, 300), ...(request?.policy.stockTaken ? { restock } : {}) });
  };

  const refund = request?.policy.refund;
  const refundLabel = refund
    ? refund.currency === "KHR"
      ? `${refund.amount.toLocaleString("en-US")} ៛`
      : `$${refund.amount.toFixed(2)}`
    : null;

  const dialog = (
    <Dialog open={request !== null} onOpenChange={(open) => { if (!open) settle(null); }}>
      <DialogContent className="admin_modal is_cancel_order_modal sm:max-w-[480px]">
        <DialogHeader className="admin_modal_header">
          <DialogTitle className="admin_modal_title">
            {t("orders.cancel.title", "Cancel order #{code}", { code: request ? orderCode(request.order.id) : "" })}
          </DialogTitle>
          <DialogDescription className="cancel_order_hint">
            {t("orders.cancel.hint", "The customer and the staff see the reason with the order.")}
          </DialogDescription>
        </DialogHeader>
        <div className="admin_modal_body cancel_order_body">
          <fieldset className="cancel_order_group">
            <legend>{t("orders.cancel.why", "Why is it cancelled?")}</legend>
            <div className="cancel_order_chips">
              {STAFF_CANCEL_REASONS.map(([key, english]) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={preset === key}
                  className={cn("cancel_order_chip", preset === key && "is_selected")}
                  onClick={() => {
                    setPreset(preset === key ? null : key);
                    setError(undefined);
                  }}
                >
                  {t(`orders.cancel.reasons.${key}`, english)}
                </button>
              ))}
            </div>
            <FormTextarea
              label={preset ? t("orders.cancel.details", "More details (optional)") : t("orders.cancel.other", "Or write the reason")}
              rows={2}
              maxLength={250}
              value={details}
              error={error}
              onChange={(event) => {
                setDetails(event.target.value);
                setError(undefined);
              }}
            />
          </fieldset>

          {request?.policy.stockTaken ? (
            <fieldset className="cancel_order_group">
              <legend>{t("orders.cancel.stock_question", "The stock for this order was already taken. Was it made?")}</legend>
              <div className="cancel_order_options" role="radiogroup">
                <button
                  type="button"
                  role="radio"
                  aria-checked={restock}
                  className={cn("cancel_order_option", restock && "is_selected")}
                  onClick={() => setRestock(true)}
                >
                  <Undo2 aria-hidden />
                  <span>
                    <b>{t("orders.cancel.restock", "Not made yet")}</b>
                    <small>{t("orders.cancel.restock_hint", "Put everything back in stock.")}</small>
                  </span>
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={!restock}
                  className={cn("cancel_order_option", !restock && "is_selected")}
                  onClick={() => setRestock(false)}
                >
                  <Recycle aria-hidden />
                  <span>
                    <b>{t("orders.cancel.waste", "Already made")}</b>
                    <small>{t("orders.cancel.waste_hint", "Count it as waste in the inventory.")}</small>
                  </span>
                </button>
              </div>
            </fieldset>
          ) : null}

          {refundLabel ? (
            <div className="cancel_order_refund" role="note">
              <Banknote aria-hidden />
              <span>
                {t("orders.cancel.refund", "This order is paid. Hand back {amount} in cash; it leaves the sales figures.", {
                  amount: refundLabel,
                })}
              </span>
            </div>
          ) : null}
        </div>
        <DialogFooter className="admin_modal_footer">
          <Button variant="outline" onClick={() => settle(null)}>
            {t("orders.cancel.keep", "Keep order")}
          </Button>
          <Button variant="danger" onClick={confirm}>
            {refundLabel ? t("orders.cancel.confirm_refund", "Cancel and refund") : t("orders.cancel.confirm", "Cancel order")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return { askCancel, cancelDialog: dialog };
}

/** Why the Cancel action isn't offered, for a tooltip or a toast. */
export function cancelBlockedMessage(
  t: (key: string, fallback: string) => string,
  why: Extract<CancelPolicy, { allowed: false }>["why"]
): string {
  switch (why) {
    case "FINISHED":
      return t("orders.cancel.blocked_finished", "This order is finished and can't be cancelled.");
    case "BAKONG_PAID":
      return t("orders.cancel.blocked_bakong", "Paid by Bakong KHQR: the refund goes through the bank, so it can't be cancelled here.");
    case "ADMIN_ONLY":
      return t("orders.cancel.blocked_admin", "This order is paid. Only an admin can cancel it and refund the cash.");
    case "OTHER_HANDLER":
      return t("orders.cancel.blocked_handler", "Another staff member is handling this order.");
  }
}

/** "Cancelled by the customer: Changed my mind", for cancelled orders on cards and in details. */
export function cancellationLabel(
  t: (key: string, fallback: string, params?: Record<string, string | number>) => string,
  order: Pick<OrderResponse, "cancelReason" | "cancelledByRole" | "refundAmount" | "refundCurrency">
): string | null {
  if (!order.cancelReason) return null;
  const who =
    order.cancelledByRole === "CUSTOMER"
      ? t("orders.cancel.by_customer", "Cancelled by the customer")
      : order.cancelledByRole
        ? t("orders.cancel.by_staff", "Cancelled by staff")
        : t("orders.cancel.by_system", "Cancelled automatically");
  const refund =
    order.refundAmount != null
      ? ` · ${t("orders.cancel.refunded", "refunded {amount}", {
          amount:
            order.refundCurrency === "KHR"
              ? `${Number(order.refundAmount).toLocaleString("en-US")} ៛`
              : `$${Number(order.refundAmount).toFixed(2)}`,
        })}`
      : "";
  return `${who}: ${order.cancelReason}${refund}`;
}
