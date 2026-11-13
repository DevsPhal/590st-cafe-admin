"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Banknote, Delete, Loader2, QrCode, RefreshCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn, formatByCurrency } from "@/lib/utils";
import type { Currency } from "@/store/api/types";

export type PosCartItem = {
  id: string;
  name: string;
  note?: string;
  originalPrice?: number;
  price: number;
  quantity: number;
  accent: string;
};

export type PosPaymentMethod = "cash" | "bakong";

/** Everything the Bakong tab needs — owned by PosView, since it holds the actual mutations. */
export type PosBakongState = {
  currency: Currency;
  onCurrencyChange: (currency: Currency) => void;
  qrDataUrl: string | null;
  amount: number | null;
  isGenerating: boolean;
  secondsLeft: number | null;
  isChecking: boolean;
  failure: string | null;
  onCheckPayment: () => void;
  onRetry: () => void;
};

/** Everything the Cash tab needs for a KHR-aware till, not just USD. */
export type PosCashState = {
  currency: Currency;
  onCurrencyChange: (currency: Currency) => void;
  /** Riel per dollar. Null while the rate is still loading — KHR stays disabled until it lands. */
  khrPerUsdRate: number | null;
};

type PosPaymentModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: readonly PosCartItem[];
  total: number;
  orderTable?: string;
  orderId?: string;
  method: PosPaymentMethod;
  onMethodChange: (method: PosPaymentMethod) => void;
  /** Receives the currency and amount tendered on the numpad; resolves once the API settles. */
  onConfirm?: (currency: Currency, amountTendered: number) => void | Promise<void>;
  isLoading?: boolean;
  cash: PosCashState;
  bakong: PosBakongState;
};

const NUMPAD_ROWS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["00", "0", "backspace"],
] as const;

// Common note denominations, offered as one-tap shortcuts above the numpad.
const QUICK_AMOUNTS: Record<Currency, number[]> = {
  USD: [1, 5, 10, 20, 50],
  KHR: [2000, 5000, 10000, 20000, 50000],
};

function formatCountdown(seconds: number | null): string {
  if (seconds === null) return "--:--";
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export function PosPaymentModal({
  open,
  onOpenChange,
  items,
  total,
  orderTable = "Order Table #51",
  orderId = "#542845",
  method,
  onMethodChange,
  onConfirm,
  isLoading = false,
  cash,
  bakong,
}: PosPaymentModalProps) {
  // The grand total is always stored in USD — this is what the cash tab actually charges
  // against, converted into whichever currency the customer is handing over.
  const payable = useMemo(() => {
    if (cash.currency === "USD" || !cash.khrPerUsdRate) return total;
    return total * cash.khrPerUsdRate;
  }, [total, cash.currency, cash.khrPerUsdRate]);

  const [cashInput, setCashInput] = useState(() => formatForInput(payable, cash.currency));

  // Re-seeds the numpad to the exact amount whenever the modal (re)opens, the total changes,
  // or the currency is switched — a stale USD figure left over from before a currency swap
  // would silently short-change the till.
  useEffect(() => {
    if (open) {
      setCashInput(formatForInput(payable, cash.currency));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, payable, cash.currency]);

  const credit = useMemo(() => {
    const parsed = Number.parseFloat(cashInput);
    return Number.isFinite(parsed) ? parsed : 0;
  }, [cashInput]);

  const balance = credit - payable;

  const appendValue = (value: string) => {
    if (value === "." && cash.currency === "KHR") return; // Riel has no fractional unit.
    setCashInput((current) => {
      if (current === "0" && value !== ".") {
        return value === "00" ? "0" : value;
      }
      if (value === "00") {
        return `${current}00`;
      }
      if (value === "." && current.includes(".")) {
        return current;
      }
      return `${current}${value}`;
    });
  };

  const handleBackspace = () => {
    setCashInput((current) => (current.length <= 1 ? "0" : current.slice(0, -1)));
  };

  const isBakong = method === "bakong";
  const canUseKhr = cash.khrPerUsdRate != null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="admin_modal is_pos_payment">
        <DialogHeader className="admin_modal_header">
          <DialogTitle className="admin_modal_title">Checkout Order Payment</DialogTitle>
        </DialogHeader>

        <div className="pos_payment_modal_body">
          {/* Tender type — the numpad and the QR panel below swap based on this. */}
          <div className="pos_payment_method_tabs" role="tablist" aria-label="Payment method">
            <button
              type="button"
              role="tab"
              aria-selected={method === "cash"}
              className={cn("pos_payment_method_tab", method === "cash" && "is_active")}
              onClick={() => onMethodChange("cash")}
            >
              <Banknote className="h-4 w-4" /> Cash
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={isBakong}
              className={cn("pos_payment_method_tab", isBakong && "is_active")}
              onClick={() => onMethodChange("bakong")}
            >
              <QrCode className="h-4 w-4" /> Bakong QR
            </button>
          </div>

          <div className="pos_payment_modal_layout">
            <section className="pos_payment_left" aria-label="Payment calculator">
              <div className="pos_payment_payable">
                <p>Payable Amount (Grand Total)</p>
                <strong>{formatByCurrency(payable, isBakong ? "USD" : cash.currency)}</strong>
              </div>

              {!isBakong ? (
                <div className="pos_payment_cash">
                  <div className="pos_payment_cash_head">
                    <span className="pos_payment_cash_label">Cash</span>
                    <div className="pos_payment_currency_tabs" role="tablist" aria-label="Cash currency">
                      {(["USD", "KHR"] as const).map((option) => (
                        <button
                          key={option}
                          type="button"
                          role="tab"
                          aria-selected={cash.currency === option}
                          className={cn(
                            "pos_payment_currency_tab",
                            cash.currency === option && "is_active"
                          )}
                          disabled={option === "KHR" && !canUseKhr}
                          onClick={() => cash.onCurrencyChange(option)}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pos_payment_cash_input">
                    {formatByCurrency(credit, cash.currency)}
                  </div>

                  <div className="pos_payment_quick_amounts">
                    <button
                      type="button"
                      className="pos_payment_quick_btn"
                      onClick={() => setCashInput(formatForInput(payable, cash.currency))}
                    >
                      Exact
                    </button>
                    {QUICK_AMOUNTS[cash.currency].map((amount) => (
                      <button
                        key={amount}
                        type="button"
                        className="pos_payment_quick_btn"
                        onClick={() => setCashInput(String(amount))}
                      >
                        {cash.currency === "KHR" ? amount.toLocaleString() : `$${amount}`}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {NUMPAD_ROWS.flatMap((row) =>
                      row.map((key) => {
                        if (key === "backspace") {
                          return (
                            <button
                              key={key}
                              type="button"
                              className="pos_payment_key is_icon"
                              aria-label="Backspace"
                              onClick={handleBackspace}
                            >
                              <Delete />
                            </button>
                          );
                        }

                        return (
                          <button
                            key={key}
                            type="button"
                            className="pos_payment_key"
                            onClick={() => appendValue(key)}
                          >
                            {key}
                          </button>
                        );
                      })
                    )}

                    <button
                      type="button"
                      className="pos_payment_key"
                      disabled={cash.currency === "KHR"}
                      onClick={() => appendValue(".")}
                    >
                      .
                    </button>
                    <button
                      type="button"
                      className="pos_payment_key col-span-2 is_cancel"
                      onClick={() => setCashInput("0")}
                    >
                      Clear
                    </button>
                  </div>
                </div>
              ) : (
                <div className="pos_payment_bakong">
                  <div className="pos_payment_currency_tabs" role="tablist" aria-label="QR currency">
                    {(["USD", "KHR"] as const).map((option) => (
                      <button
                        key={option}
                        type="button"
                        role="tab"
                        aria-selected={bakong.currency === option}
                        className={cn(
                          "pos_payment_currency_tab",
                          bakong.currency === option && "is_active"
                        )}
                        onClick={() => bakong.onCurrencyChange(option)}
                        disabled={bakong.isGenerating}
                      >
                        {option}
                      </button>
                    ))}
                  </div>

                  <div className="pos_payment_bakong_qr">
                    {bakong.qrDataUrl ? (
                      <Image
                        src={bakong.qrDataUrl}
                        alt="Bakong KHQR for this order"
                        width={220}
                        height={220}
                        unoptimized
                      />
                    ) : bakong.isGenerating ? (
                      <Loader2 className="h-8 w-8 animate-spin text-gray-300" />
                    ) : (
                      <p className="px-4 text-center text-xs font-semibold text-gray-500">
                        {bakong.failure ?? "No QR generated yet."}
                      </p>
                    )}
                  </div>

                  {bakong.qrDataUrl && (
                    <>
                      <p className="pos_payment_bakong_amount">
                        {formatByCurrency(Number(bakong.amount ?? 0), bakong.currency)}
                      </p>
                      <p className="pos_payment_bakong_hint">
                        Have the customer scan this on their banking app — this screen is for
                        the counter, not their phone.
                      </p>
                      <p className="pos_payment_bakong_timer">
                        Expires in {formatCountdown(bakong.secondsLeft)}
                      </p>
                    </>
                  )}

                  {bakong.failure && !bakong.isGenerating && (
                    <p className="pos_payment_bakong_error">{bakong.failure}</p>
                  )}

                  <div className="flex gap-2">
                    {bakong.qrDataUrl && (bakong.secondsLeft ?? 0) > 0 ? (
                      <button
                        type="button"
                        className="btn_primary_yellow flex-1 text-xs"
                        disabled={bakong.isChecking}
                        onClick={bakong.onCheckPayment}
                      >
                        {bakong.isChecking ? "Checking..." : "Check Payment"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn_primary_yellow flex-1 text-xs"
                        disabled={bakong.isGenerating}
                        onClick={bakong.onRetry}
                      >
                        <RefreshCw className="mr-1 inline h-3.5 w-3.5" />
                        {bakong.qrDataUrl ? "Get a new QR" : "Generate QR"}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </section>

            <section className="pos_payment_right" aria-label="Order summary">
              <div className="pos_payment_summary_head">
                <h2>Order Summary</h2>
                <div>
                  <strong>{orderTable}</strong>
                  <span>{orderId}</span>
                </div>
              </div>

              <div className="pos_payment_items">
                {items.map((item) => (
                  <article key={item.id} className="pos_payment_item">
                    <div className="pos_payment_item_info">
                      <h3>{item.name}</h3>
                      {item.note ? <p>{item.note}</p> : null}
                    </div>
                    <div className="pos_payment_item_meta">
                      <strong>QTY: {item.quantity}</strong>
                      <div className="pos_cart_price">
                        {item.originalPrice ? (
                          <span className="is_struck">${item.originalPrice.toFixed(2)}</span>
                        ) : null}
                        <strong>${item.price.toFixed(2)}</strong>
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              {!isBakong ? (
                <>
                  <dl className="pos_payment_totals">
                    <dt>Credit:</dt>
                    <dd>{formatByCurrency(credit, cash.currency)}</dd>
                    <dt className="is_balance">Balance:</dt>
                    <dd className={cn("is_balance", balance < 0 && "is_negative")}>
                      {balance < 0 ? "-" : ""}
                      {formatByCurrency(Math.abs(balance), cash.currency)}
                    </dd>
                  </dl>

                  <button
                    type="button"
                    className="btn_primary_yellow pos_payment_confirm"
                    // Short-changing the till is a hard stop, not a warning.
                    disabled={isLoading || balance < 0 || items.length === 0}
                    onClick={() => onConfirm?.(cash.currency, credit)}
                  >
                    {isLoading ? "Processing..." : "Confirm Payment"}
                  </button>
                </>
              ) : (
                <dl className="pos_payment_totals">
                  <dt>Total:</dt>
                  <dd>${total.toFixed(2)}</dd>
                </dl>
              )}
            </section>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function formatForInput(amount: number, currency: Currency): string {
  return currency === "KHR" ? String(Math.round(amount)) : amount.toFixed(2);
}
