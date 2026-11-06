"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Loader2, Printer, ShieldAlert } from "lucide-react";
import type { FetchBaseQueryError } from "@reduxjs/toolkit/query";
import { apiErrorMessage } from "@/store/api/baseApi";
import { useDownloadOrderInvoiceMutation } from "@/store/api/orderApi";
import { useDownloadBaristaOrderInvoiceMutation } from "@/store/api/baristaOrderApi";
import { useCurrentRole } from "@/store/api/useCurrentRole";
import type { InvoiceLanguage } from "@/store/api/types";
import {
  invoiceFilename,
  orderCode,
  useInvoiceLanguage,
} from "@/hooks/useOrderInvoice";
import { cn, downloadBlob } from "@/lib/utils";
import { translate, useI18n } from "@/contexts/I18nContext";

const LANGUAGES: { value: InvoiceLanguage; label: string; htmlLang: string }[] = [
  { value: "EN", label: "English", htmlLang: "en" },
  { value: "KH", label: "ខ្មែរ", htmlLang: "km" },
];

export default function InvoiceViewerView({ orderId }: { orderId: string }) {
  const { t } = useI18n();
  const { isAdmin } = useCurrentRole();
  const [adminDownload] = useDownloadOrderInvoiceMutation();
  const [baristaDownload] = useDownloadBaristaOrderInvoiceMutation();
  const [language, setLanguage] = useInvoiceLanguage();
  // Tagged with its language so switching shows the spinner until the other PDF arrives.
  const [loaded, setLoaded] = useState<{
    language: InvoiceLanguage;
    pdf?: { blob: Blob; url: string };
    error?: string;
  } | null>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const title = t("orders.invoice.title", "Invoice #{code}", { code: orderCode(orderId) });
  const current = loaded?.language === language ? loaded : null;
  const pdf = current?.pdf ?? null;
  const error = current?.error ?? null;

  useEffect(() => {
    document.title = title;
  }, [title]);

  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;
    (isAdmin ? adminDownload : baristaDownload)({ id: orderId, language })
      .unwrap()
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setLoaded({ language, pdf: { blob, url } });
      })
      .catch((err: FetchBaseQueryError) => {
        if (!cancelled)
          setLoaded({
            language,
            error: apiErrorMessage(err, translate("orders.invoice.load_error", "Could not load the invoice.")),
          });
      });
    return () => {
      cancelled = true;
      const revoked = url;
      if (revoked) {
        URL.revokeObjectURL(revoked);
        setLoaded((previous) => (previous?.pdf?.url === revoked ? null : previous));
      }
    };
  }, [orderId, language, isAdmin, adminDownload, baristaDownload]);

  return (
    <div className="flex h-screen flex-col bg-[#525659]">
      <header className="flex flex-wrap items-center justify-between gap-3 bg-white px-4 py-3 shadow-sm">
        <h1 className="text-base font-bold text-gray-900">{title}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label={t("invoice.language", "Invoice language")}
            className="invoice_viewer_language"
          >
            {LANGUAGES.map((option) => (
              <button
                key={option.value}
                type="button"
                lang={option.htmlLang}
                aria-pressed={option.value === language}
                onClick={() => setLanguage(option.value)}
                className={cn(option.value === language && "is_active")}
              >
                {option.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={!pdf}
            onClick={() => frameRef.current?.contentWindow?.print()}
            className="btn_primary_black"
          >
            <Printer />
            {t("actions.print", "Print")}
          </button>
          <button
            type="button"
            disabled={!pdf}
            onClick={() => pdf && downloadBlob(pdf.blob, invoiceFilename(orderId, language))}
            className="btn_outline_black"
          >
            <Download />
            {t("actions.download", "Download")}
          </button>
        </div>
      </header>

      {pdf ? (
        <iframe
          ref={frameRef}
          src={pdf.url}
          title={title}
          className="w-full flex-1 border-0"
        />
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-white">
          {error ? (
            <>
              <ShieldAlert className="h-8 w-8" />
              <p className="text-sm">{error}</p>
            </>
          ) : (
            <Loader2 className="h-6 w-6 animate-spin" />
          )}
        </div>
      )}
    </div>
  );
}
