"use client";

import { useRef, useState } from "react";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { Check, Loader2, Printer } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LanguageFlag } from "@/components/common/AdminKit";
import {
  orderCode,
  requestInvoicePrint,
  useInvoiceLanguage,
  useOrderInvoice,
  usePendingInvoicePrint,
} from "@/hooks/useOrderInvoice";
import type { InvoiceLanguage } from "@/store/api/types";
import { localeInfo } from "@/contexts/locales";
import { useI18n } from "@/contexts/I18nContext";
import { cn } from "@/lib/utils";
import { Button } from "@/components/common/Button";

const OPTIONS: {
  value: InvoiceLanguage;
  titleKey: string;
  title: string;
  nativeName: string;
  htmlLang: string;
  flag: string;
}[] = [
  {
    value: "EN",
    titleKey: "invoice.english_invoice",
    title: "English Invoice",
    nativeName: "English",
    htmlLang: "en",
    flag: localeInfo("en").flag,
  },
  {
    value: "KH",
    titleKey: "invoice.khmer_invoice",
    title: "Khmer Invoice",
    nativeName: "ភាសាខ្មែរ",
    htmlLang: "km",
    flag: localeInfo("kh").flag,
  },
];

// The printed wording, mirrored from ReceiptLabels.java in the API, which renders the real PDF.
const RECEIPT_LABELS: Record<
  InvoiceLanguage,
  Record<"title" | "order" | "date" | "servedBy" | "customer" | "total" | "payment" | "thanks", string>
> = {
  EN: {
    title: "INVOICE",
    order: "Order No.",
    date: "Date",
    servedBy: "Served by",
    customer: "Customer",
    total: "TOTAL",
    payment: "Payment method",
    thanks: "Thank you, come again!",
  },
  KH: {
    title: "វិក្កយបត្រ",
    order: "លេខបញ្ជាទិញ",
    date: "កាលបរិច្ឆេទ",
    servedBy: "បម្រើដោយ",
    customer: "អតិថិជន",
    total: "សរុប",
    payment: "វិធីបង់ប្រាក់",
    thanks: "សូមអរគុណ សូមអញ្ជើញមកម្តងទៀត",
  },
};

// Asks which language to print an invoice in, then prints only that one. Every Print Invoice
// button opens it through requestInvoicePrint.
export function InvoicePrintDialog() {
  const { t } = useI18n();
  const orderId = usePendingInvoicePrint();
  const { printInvoiceIn, isBusy } = useOrderInvoice();
  const [savedLanguage, saveLanguage] = useInvoiceLanguage();
  const [choice, setChoice] = useState<InvoiceLanguage | null>(null);
  // Keeps the order on screen while the dialog animates closed.
  const [shownOrderId, setShownOrderId] = useState(orderId);
  const printButton = useRef<HTMLButtonElement>(null);
  if (orderId != null && orderId !== shownOrderId) setShownOrderId(orderId);

  const language = choice ?? savedLanguage;
  const printing = shownOrderId != null && isBusy(shownOrderId, "print");

  const close = () => {
    if (printing) return;
    requestInvoicePrint(null);
    setChoice(null);
  };

  const print = async () => {
    if (orderId == null) return;
    if (await printInvoiceIn(orderId, language)) {
      saveLanguage(language);
      requestInvoicePrint(null);
      setChoice(null);
    }
  };

  return (
    <Dialog open={orderId != null} onOpenChange={(open) => !open && close()}>
      <DialogContent
        className="admin_modal is_invoice_language_modal"
        onOpenAutoFocus={(event) => {
          // Print is one Enter away; the language last used is already selected.
          event.preventDefault();
          printButton.current?.focus();
        }}
      >
        <DialogHeader className="admin_modal_header">
          <DialogTitle className="admin_modal_title">
            {t("invoice.choose_language", "Choose Invoice Language")}
          </DialogTitle>
          <DialogDescription className="invoice_language_hint">
            {t(
              "invoice.choose_language_hint",
              "Order {number} · only the selected language is printed.",
              { number: shownOrderId ? `#${orderCode(shownOrderId)}` : "" },
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="admin_modal_body">
          <RadioGroupPrimitive.Root
            value={language}
            onValueChange={(value) => setChoice(value as InvoiceLanguage)}
            disabled={printing}
            aria-label={t("invoice.language", "Invoice language")}
            className="invoice_language_options"
          >
            {OPTIONS.map((option) => {
              const selected = option.value === language;
              return (
                <RadioGroupPrimitive.Item
                  key={option.value}
                  value={option.value}
                  className={cn("invoice_language_option", selected && "is_selected")}
                >
                  <span className="invoice_language_option_head">
                    <LanguageFlag src={option.flag} alt="" />
                    <span className="invoice_language_option_name">
                      <span className="invoice_language_option_title">
                        {t(option.titleKey, option.title)}
                      </span>
                      <span className="invoice_language_option_native" lang={option.htmlLang}>
                        {option.nativeName}
                      </span>
                    </span>
                  </span>
                  <ReceiptPreview language={option.value} orderId={shownOrderId} />
                  <span className="invoice_language_option_select" aria-hidden="true">
                    {selected && <Check />}
                    {selected ? t("invoice.selected", "Selected") : t("invoice.select", "Select")}
                  </span>
                </RadioGroupPrimitive.Item>
              );
            })}
          </RadioGroupPrimitive.Root>
        </div>

        <DialogFooter className="admin_modal_footer">
          <Button onClick={close} disabled={printing} variant="outline">
            {t("actions.cancel", "Cancel")}
          </Button>
          <Button
            ref={printButton}
           
            onClick={print}
            disabled={printing}
            variant="primary"
          >
            {printing ? <Loader2 className="animate-spin" /> : <Printer />}
            {printing
              ? t("states.preparing", "Preparing...")
              : t("invoice.print_selected", "Print Selected Invoice")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// A thumbnail of the printed receipt: the real labels in the PDF's layout and fonts, with bars
// standing in for the order's details. The logo between rules opens it; the thanks between rules and two
// coffee beans close it, as on paper.
// The two beans printed under the thanks: tilted ovals with the crease left white.
function CoffeeBeans() {
  return (
    <svg className="invoice_receipt_beans" viewBox="0 0 20 12" aria-hidden="true">
      {[
        { x: 6, angle: 28 },
        { x: 14, angle: -28 },
      ].map(({ x, angle }) => (
        <g key={x} transform={`translate(${x} 6) rotate(${angle})`}>
          <ellipse rx="3" ry="4.4" fill="currentColor" />
          <path d="M0 -3.7 C1.6 -1.3 -1.6 1.3 0 3.7" fill="none" stroke="#fff" strokeWidth="0.75" strokeLinecap="round" />
        </g>
      ))}
    </svg>
  );
}

function ReceiptPreview({
  language,
  orderId,
}: {
  language: InvoiceLanguage;
  orderId: string | null;
}) {
  const labels = RECEIPT_LABELS[language];
  return (
    <span className="invoice_receipt_tray" aria-hidden="true">
      <span
        className={cn("invoice_receipt_preview", language === "KH" && "is_khmer")}
        lang={language === "KH" ? "km" : "en"}
      >
        <span className="invoice_receipt_flanked">
          <span className="invoice_receipt_flank" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logos/logo-black.png" alt="" className="invoice_receipt_logo" />
          <span className="invoice_receipt_flank" />
        </span>
        <span className="invoice_receipt_title">{labels.title}</span>
        <span className="invoice_receipt_rule is_dashed" />
        <span className="invoice_receipt_line is_split">
          <span>{labels.order}</span>
          <span>{orderId ? `#${orderCode(orderId)}` : ""}</span>
        </span>
        {(
          [
            [labels.date, "38%"],
            [labels.servedBy, "26%"],
            [labels.customer, "32%"],
          ] as const
        ).map(([label, width]) => (
          <span key={label} className="invoice_receipt_line is_split">
            <span>{label}</span>
            <span className="invoice_receipt_bar" style={{ width }} />
          </span>
        ))}
        <span className="invoice_receipt_rule is_dashed" />
        {["55%", "40%"].map((width, index) => (
          <span key={width} className="invoice_receipt_item">
            <span className="invoice_receipt_line is_split">
              <span>
                <span className="invoice_receipt_quantity">{index + 1}×</span>
                <span className="invoice_receipt_bar" style={{ width }} />
              </span>
              <span className="invoice_receipt_bar" style={{ width: "16%" }} />
            </span>
            <span className="invoice_receipt_line is_detail">
              <span className="invoice_receipt_bar" style={{ width: index === 0 ? "62%" : "34%" }} />
            </span>
          </span>
        ))}
        <span className="invoice_receipt_rule" />
        <span className="invoice_receipt_line is_split is_total">
          <span>{labels.total}</span>
          <span className="invoice_receipt_bar" style={{ width: "22%" }} />
        </span>
        <span className="invoice_receipt_rule" />
        <span className="invoice_receipt_line is_split">
          <span>{labels.payment}</span>
          <span className="invoice_receipt_bar" style={{ width: "20%" }} />
        </span>
        <span className="invoice_receipt_rule is_dashed" />
        <span className="invoice_receipt_flanked is_thanks">
          <span className="invoice_receipt_flank" />
          <span className={cn("invoice_receipt_thanks", language === "EN" && "is_script")}>{labels.thanks}</span>
          <span className="invoice_receipt_flank" />
        </span>
        <span className="invoice_receipt_flanked is_ornament">
          <span className="invoice_receipt_flank" />
          <CoffeeBeans />
          <span className="invoice_receipt_flank" />
        </span>
      </span>
    </span>
  );
}
