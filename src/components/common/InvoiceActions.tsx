"use client";

import { CheckCircle2, Download, FileText, Loader2, Printer } from "lucide-react";
import toast from "react-hot-toast";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { orderCode, useOrderInvoice } from "@/hooks/useOrderInvoice";
import type { OrderResponse } from "@/store/api/types";
import { cn, formatByCurrency } from "@/lib/utils";
import { enumLabel } from "@/lib/enumLabel";
import { translate, useI18n } from "@/contexts/I18nContext";
import { Button } from "@/components/common/Button";

const orderNumber = (order: Pick<OrderResponse, "id">) =>
  `#${orderCode(order.id)}`;

export function InvoiceActions({
  order,
  className,
  autoFocusPrint = false,
}: {
  order: Pick<OrderResponse, "id" | "paidAt">;
  className?: string;
  autoFocusPrint?: boolean;
}) {
  const { printInvoice, viewInvoice, downloadInvoice, isBusy } =
    useOrderInvoice();
  const { t } = useI18n();
  if (order.paidAt == null) return null;
  const busy = isBusy(order.id);

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <Button
       
        onClick={() => printInvoice(order.id)}
        disabled={busy}
        autoFocus={autoFocusPrint}
        variant="primary"
      >
        {isBusy(order.id, "print") ? (
          <Loader2 className="animate-spin" />
        ) : (
          <Printer />
        )}
        {isBusy(order.id, "print") ? t("states.preparing", "Preparing...") : t("invoice.print", "Print Invoice")}
      </Button>
      <Button
       
        onClick={() => viewInvoice(order.id)}
        disabled={busy}
        variant="outline"
      >
        {isBusy(order.id, "view") ? (
          <Loader2 className="animate-spin" />
        ) : (
          <FileText />
        )}
        {isBusy(order.id, "view") ? t("states.opening", "Opening...") : t("invoice.view_pdf", "View PDF")}
      </Button>
      <Button
       
        onClick={() => downloadInvoice(order.id)}
        disabled={busy}
        variant="outline"
      >
        {isBusy(order.id, "download") ? (
          <Loader2 className="animate-spin" />
        ) : (
          <Download />
        )}
        {isBusy(order.id, "download") ? t("states.downloading", "Downloading...") : t("actions.download", "Download")}
      </Button>
    </div>
  );
}

export function PrintInvoiceIconButton({
  order,
  className,
}: {
  order: Pick<OrderResponse, "id" | "paidAt">;
  className?: string;
}) {
  const { printInvoice, isBusy } = useOrderInvoice();
  const { t } = useI18n();
  if (order.paidAt == null) return null;
  const busy = isBusy(order.id);

  return (
    <button
      type="button"
      onClick={() => printInvoice(order.id)}
      disabled={busy}
      aria-label={t("invoice.print_for_order", "Print invoice for order {number}", { number: orderNumber(order) })}
      title={t("actions.print_invoice", "Print invoice")}
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded-full pointer-coarse:size-11 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 disabled:opacity-50",
        className
      )}
    >
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Printer className="h-4 w-4" />
      )}
    </button>
  );
}

export function toastPaidWithInvoice(
  message: string,
  orderId: string,
  printInvoice: (orderId: string) => void,
) {
  toast.success(
    (t) => (
      <span className="flex flex-col items-start">
        <span className="app_toast_text">{message}</span>
        <button
          type="button"
          onClick={() => {
            toast.dismiss(t.id);
            printInvoice(orderId);
          }}
          className="app_toast_action"
        >
          <Printer aria-hidden="true" /> {translate("actions.print_invoice", "Print invoice")}
        </button>
      </span>
    ),
    { duration: 8000 },
  );
}

export function SaleCompleteModal({
  sale,
  onNewSale,
}: {
  sale: OrderResponse | null;
  onNewSale: () => void;
}) {
  const { t } = useI18n();
  const change = Number(sale?.changeDue ?? 0);

  return (
    <Dialog open={sale != null} onOpenChange={(open) => !open && onNewSale()}>
      <DialogContent className="admin_modal sm:max-w-[440px]">
        <DialogHeader className="admin_modal_header">
          <DialogTitle className="admin_modal_title">{t("invoice.sale_complete", "Sale Complete")}</DialogTitle>
        </DialogHeader>
        {sale && (
          <div className="admin_modal_body">
            <div className="flex flex-col items-center gap-2 px-6 pt-2 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-600" />
              <p className="font-mono text-sm text-gray-500">
                {t("invoice.order_number", "Order {number}", { number: orderNumber(sale) })}
              </p>
              <p className="text-3xl font-bold tabular-nums">
                {formatByCurrency(sale.totalAmount, "USD")}
              </p>
              <p className="text-sm text-gray-500">
                {t("invoice.paid_by", "Paid by {method}", { method: sale.paymentMethod ? enumLabel(t, "payment_method", sale.paymentMethod) : t("invoice.cash", "cash") })}
                {sale.amountTendered != null
                  ? ` · ${t("invoice.received", "Received {amount}", { amount: formatByCurrency(sale.amountTendered, sale.amountTenderedCurrency) })}`
                  : ""}
              </p>
              {change > 0 && (
                <p className="mt-1 rounded-lg bg-amber-50 px-4 py-2 text-base font-semibold text-amber-900 tabular-nums">
                  {t("invoice.change_due", "Change due: {amount}", { amount: formatByCurrency(change, sale.changeCurrency) })}
                </p>
              )}
            </div>
            <InvoiceActions
              order={sale}
              autoFocusPrint
              className="justify-center px-6 pt-6"
            />
          </div>
        )}
        <DialogFooter className="admin_modal_footer">
          <Button
           
            onClick={onNewSale}
            variant="accent"
          >
            {t("invoice.new_sale", "New Sale")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
