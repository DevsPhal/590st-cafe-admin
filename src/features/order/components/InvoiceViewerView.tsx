"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Loader2, Printer, ShieldAlert } from "lucide-react";
import type { FetchBaseQueryError } from "@reduxjs/toolkit/query";
import { apiErrorMessage } from "@/store/api/baseApi";
import { useDownloadOrderInvoiceMutation } from "@/store/api/orderApi";
import { useDownloadBaristaOrderInvoiceMutation } from "@/store/api/baristaOrderApi";
import { useCurrentRole } from "@/store/api/useCurrentRole";
import {
  invoiceFilename,
  invoiceTitle,
} from "@/hooks/useOrderInvoice";
import { downloadBlob } from "@/lib/utils";

/**
 * The invoice on its own page (/invoices/:orderId), so the tab shows a real app address — on
 * localhost and in production alike — instead of a blob: link. The PDF is fetched with the
 * signed-in session, so the link is useless to anyone who is not logged in as staff.
 */
export default function InvoiceViewerView({ orderId }: { orderId: string }) {
  const { isAdmin } = useCurrentRole();
  const [adminDownload] = useDownloadOrderInvoiceMutation();
  const [baristaDownload] = useDownloadBaristaOrderInvoiceMutation();
  const [pdf, setPdf] = useState<{ blob: Blob; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const title = invoiceTitle(orderId);

  useEffect(() => {
    document.title = title;
  }, [title]);

  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;
    (isAdmin ? adminDownload : baristaDownload)(orderId)
      .unwrap()
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setPdf({ blob, url });
      })
      .catch((err: FetchBaseQueryError) => {
        if (!cancelled)
          setError(apiErrorMessage(err, "Could not load the invoice."));
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [orderId, isAdmin, adminDownload, baristaDownload]);

  return (
    <div className="flex h-screen flex-col bg-[#525659]">
      <header className="flex items-center justify-between gap-3 bg-white px-4 py-3 shadow-sm">
        <h1 className="text-base font-bold text-gray-900">{title}</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!pdf}
            onClick={() => frameRef.current?.contentWindow?.print()}
            className="btn_primary_black"
          >
            <Printer />
            Print
          </button>
          <button
            type="button"
            disabled={!pdf}
            onClick={() => pdf && downloadBlob(pdf.blob, invoiceFilename(orderId))}
            className="btn_outline_black"
          >
            <Download />
            Download
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
