"use client";

import { useState, useSyncExternalStore } from "react";
import toast from "react-hot-toast";
import { apiErrorMessage } from "@/store/api/baseApi";
import { useDownloadOrderInvoiceMutation } from "@/store/api/orderApi";
import { useDownloadBaristaOrderInvoiceMutation } from "@/store/api/baristaOrderApi";
import { useCurrentRole } from "@/store/api/useCurrentRole";
import type { InvoiceLanguage } from "@/store/api/types";
import { useLocalStorageState } from "@/hooks/useLocalStorageState";
import { downloadBlob, printPdfBlob } from "@/lib/utils";
import { translate } from "@/contexts/translate";
import { useI18n } from "@/contexts/I18nContext";

type InvoiceMode = "print" | "view" | "download";

export const orderCode = (orderId: string) =>
  orderId.slice(0, 8).toUpperCase();

export const invoiceTitle = (orderId: string) =>
  translate("invoice.title", "Invoice #{code}", { code: orderCode(orderId) });
export const invoiceFilename = (orderId: string, language: InvoiceLanguage = "EN") =>
  `invoice-${orderCode(orderId)}${language === "KH" ? "-kh" : ""}.pdf`;

const FAILURE: Record<Exclude<InvoiceMode, "view">, () => string> = {
  print: () => translate("invoice.print_failed", "Could not print the invoice."),
  download: () => translate("invoice.download_failed", "Could not download the invoice."),
};

// Printing is shared across screens: which order waits for staff to pick a language, and which one is
// being fetched to print. Any screen can start it, even a toast outside the React tree;
// InvoicePrintDialog, mounted once in the admin layout, asks for the language.
type PrintState = { pending: string | null; printing: string | null };
const IDLE: PrintState = { pending: null, printing: null };
let printState = IDLE;
const printListeners = new Set<() => void>();

function updatePrintState(next: Partial<PrintState>) {
  printState = { ...printState, ...next };
  printListeners.forEach((notify) => notify());
}

function subscribeToPrintState(onChange: () => void) {
  printListeners.add(onChange);
  return () => {
    printListeners.delete(onChange);
  };
}

function usePrintState() {
  return useSyncExternalStore(subscribeToPrintState, () => printState, () => IDLE);
}

export function requestInvoicePrint(orderId: string | null) {
  updatePrintState({ pending: orderId });
}

export function usePendingInvoicePrint() {
  return usePrintState().pending;
}

// The language staff printed in last, so the next invoice starts there; until then, the dashboard's language.
export function useInvoiceLanguage() {
  const { locale } = useI18n();
  return useLocalStorageState<InvoiceLanguage>("invoiceLanguage", (raw) =>
    raw === "EN" || raw === "KH" ? raw : locale === "kh" ? "KH" : "EN",
  );
}

export function useOrderInvoice() {
  const { isAdmin } = useCurrentRole();
  const [adminDownload] = useDownloadOrderInvoiceMutation();
  const [baristaDownload] = useDownloadBaristaOrderInvoiceMutation();
  const { printing } = usePrintState();
  const [busy, setBusy] = useState<{
    orderId: string;
    mode: InvoiceMode;
  } | null>(null);

  const run = async (
    orderId: string,
    mode: Exclude<InvoiceMode, "view">,
    language: InvoiceLanguage = "EN",
  ) => {
    if (busy || (mode === "print" && printing)) return false;
    if (mode === "print") updatePrintState({ printing: orderId });
    else setBusy({ orderId, mode });
    try {
      const blob = await (isAdmin ? adminDownload : baristaDownload)({
        id: orderId,
        language,
      }).unwrap();
      if (mode === "print") printPdfBlob(blob);
      else downloadBlob(blob, invoiceFilename(orderId, language));
      return true;
    } catch (err) {
      toast.error(apiErrorMessage(err as never, FAILURE[mode]()));
      return false;
    } finally {
      if (mode === "print") updatePrintState({ printing: null });
      else setBusy(null);
    }
  };

  return {
    // Opens the language picker; it prints with printInvoiceIn once staff choose.
    printInvoice: (orderId: string) => requestInvoicePrint(orderId),
    printInvoiceIn: (orderId: string, language: InvoiceLanguage) =>
      run(orderId, "print", language),
    viewInvoice: (orderId: string) => {
      window.open(`/invoices/${encodeURIComponent(orderId)}`, "_blank");
    },
    downloadInvoice: (orderId: string) => run(orderId, "download"),
    isBusy: (orderId: string, mode?: InvoiceMode) =>
      (printing === orderId && (!mode || mode === "print")) ||
      (busy?.orderId === orderId && (!mode || busy.mode === mode)),
  };
}
