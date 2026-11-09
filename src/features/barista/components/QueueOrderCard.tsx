"use client";

import type { ReactNode } from "react";
import {
  Armchair,
  Banknote,
  Bike,
  CircleHelp,
  Clock,
  ExternalLink,
  Globe,
  MapPin,
  MapPinned,
  MessageSquareText,
  Phone,
  QrCode,
  ShoppingBag,
  Store,
  TriangleAlert,
  X,
  type LucideIcon,
} from "lucide-react";
import { OrderEstimateChip } from "@/components/common/OrderEstimateEditor";
import { PrintInvoiceIconButton } from "@/components/common/InvoiceActions";
import { useI18n } from "@/contexts/I18nContext";
import { orderCode } from "@/hooks/useOrderInvoice";
import { optionSummary } from "@/lib/drinkOptions";
import { enumLabel } from "@/lib/enumLabel";
import { formatPhone } from "@/lib/phone";
import { cn, fulfillmentLabel, timeAgo, titleCase } from "@/lib/utils";
import type { OrderResponse, OrderStatus } from "@/store/api/types";
import { STATUS_TONE, TONE_CLASSES, formatShopDateTime, money } from "../queue";
import { Button } from "@/components/common/Button";

type Translate = ReturnType<typeof useI18n>["t"];

export interface CardAction {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
}

export function statusLabel(t: Translate, status: OrderStatus): string {
  return status === "PENDING"
    ? t("barista.queue.awaiting_payment", "Awaiting Payment")
    : enumLabel(t, "order_status", status);
}

export function QueueStatusBadge({ status }: { status: OrderStatus }) {
  const { t } = useI18n();
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide whitespace-nowrap uppercase",
        // Khmer script needs a larger size than the Latin capitals to stay legible.
        "in-[:lang(km)]:text-xs in-[:lang(km)]:font-semibold in-[:lang(km)]:tracking-normal",
        TONE_CLASSES[STATUS_TONE[status]].badge
      )}
    >
      {statusLabel(t, status)}
    </span>
  );
}

function Chip({ icon: Icon, className, children }: { icon: LucideIcon; className?: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700 in-[:lang(km)]:text-xs",
        className
      )}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden />
      {children}
    </span>
  );
}

function PaymentChip({ order }: { order: OrderResponse }) {
  const { t } = useI18n();
  if (!order.paymentMethod) {
    return <Chip icon={CircleHelp}>{t("barista.card.payment_not_chosen", "Payment not chosen")}</Chip>;
  }
  const paid = order.paidAt != null;
  // An online cash order is made first and paid at handover; once it's on the bar the cash is "due".
  const due = !paid && order.paymentMethod === "CASH" && order.status !== "PENDING" && order.status !== "CANCELLED";
  return (
    <Chip
      icon={order.paymentMethod === "BAKONG" ? QrCode : Banknote}
      className={
        paid
          ? "bg-green-50 text-green-800"
          : order.status === "CANCELLED"
            ? undefined
            : "bg-amber-50 font-semibold text-amber-800"
      }
    >
      {enumLabel(t, "payment_method", order.paymentMethod)} ·{" "}
      {paid
        ? t("barista.payment.paid", "Paid")
        : due
          ? t("barista.payment.due", "Due")
          : t("barista.payment.unpaid", "Unpaid")}
    </Chip>
  );
}

function formatDistance(meters: number): string {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
}

function ContactDetails({ order }: { order: OrderResponse }) {
  const { t } = useI18n();
  const isDelivery = order.fulfillmentMethod === "DELIVERY";
  const hasPin = order.deliveryLatitude != null && order.deliveryLongitude != null;
  // An online customer's contact name usually repeats the name already shown above.
  const contactName =
    order.contactName && order.contactName.trim().toLowerCase() !== (order.customerName ?? "").trim().toLowerCase()
      ? order.contactName
      : null;
  if (!contactName && !order.contactPhone && !order.deliveryAddress && !(isDelivery && hasPin)) return null;

  return (
    <div className="mx-3.5 mt-3 space-y-1 rounded-lg bg-gray-50 px-2.5 py-2 text-xs text-gray-700">
      {contactName ? <p className="font-semibold text-gray-900">{titleCase(contactName)}</p> : null}
      {order.contactPhone ? (
        <a href={`tel:${order.contactPhone}`} className="flex w-fit items-center gap-1.5 tabular-nums hover:underline">
          <Phone className="h-3 w-3 shrink-0" aria-hidden />
          {formatPhone(order.contactPhone)}
        </a>
      ) : null}
      {order.deliveryAddress ? (
        <p className="flex gap-1.5">
          <MapPin className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
          <span className="line-clamp-2 wrap-break-word">{order.deliveryAddress}</span>
        </p>
      ) : null}
      {isDelivery && hasPin ? (
        <a
          href={`https://www.google.com/maps?q=${order.deliveryLatitude},${order.deliveryLongitude}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 flex w-full items-center gap-2 rounded-lg border border-gray-200 bg-white py-1.5 pr-2.5 pl-1.5 font-semibold text-gray-900 shadow-xs transition-colors hover:border-gray-300 hover:bg-gray-100 pointer-coarse:py-2"
        >
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-600">
            <MapPinned className="h-4 w-4" aria-hidden />
          </span>
          <span className="min-w-0 flex-1 leading-snug">{t("fulfillment.view_pin", "View pinned location on map")}</span>
          {order.distanceMeters != null ? (
            <span className="shrink-0 rounded-full bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-600 tabular-nums">
              {formatDistance(Number(order.distanceMeters))}
            </span>
          ) : null}
          <ExternalLink className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden />
        </a>
      ) : null}
    </div>
  );
}

export function QueueOrderCard({
  order,
  now,
  primary,
  secondary,
  hint,
  onCancel,
  onOpen,
  isBusy = false,
}: {
  order: OrderResponse;
  /** Shared clock, so every card's elapsed time ticks together. */
  now: number;
  primary?: CardAction;
  secondary?: CardAction;
  hint?: string;
  onCancel?: () => void;
  onOpen: () => void;
  isBusy?: boolean;
}) {
  const { t } = useI18n();
  const code = orderCode(order.id);
  const PrimaryIcon = primary?.icon;
  const fulfillmentIcon =
    order.fulfillmentMethod === "DELIVERY" ? Bike : order.fulfillmentMethod === "DINE_IN" ? Armchair : ShoppingBag;

  return (
    <article
      className={cn(
        "flex min-w-0 flex-col rounded-xl border border-l-4 border-gray-200 bg-white shadow-xs",
        TONE_CLASSES[STATUS_TONE[order.status]].accent
      )}
    >
      <div className="flex items-start gap-2 px-3.5 pt-3">
        <button
          type="button"
          onClick={onOpen}
          className="group min-w-0 flex-1 text-left"
          aria-label={t("barista.card.view_order", "View order {id}", { id: code })}
        >
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-mono text-[15px] font-bold tracking-wide text-gray-900 group-hover:underline">
              #{code}
            </span>
            <QueueStatusBadge status={order.status} />
          </span>
          <span className="mt-1 block truncate text-sm font-semibold text-gray-900">
            {order.customerName ? titleCase(order.customerName) : t("barista.labels.walk_in", "Walk-in")}
          </span>
        </button>
        {/* Icon buttons get a thumb-sized hit area on touch screens; the icons themselves stay small. */}
        <div className="-mr-1.5 flex shrink-0 items-center pointer-coarse:-mt-1 pointer-coarse:-mr-2">
          <PrintInvoiceIconButton order={order} className="pointer-coarse:size-11" />
          {onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              disabled={isBusy}
              aria-label={t("barista.card.cancel_order", "Cancel order")}
              title={t("barista.card.cancel_order", "Cancel order")}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 pointer-coarse:size-11"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-1 flex items-center justify-between gap-2 px-3.5 text-xs text-gray-500">
        <time dateTime={order.createdAt}>{formatShopDateTime(order.createdAt)}</time>
        <span className="inline-flex shrink-0 items-center gap-1 font-medium text-gray-700 tabular-nums">
          <Clock className="h-3.5 w-3.5" aria-hidden />
          {timeAgo(order.createdAt, now)}
        </span>
      </div>

      <div className="mt-2.5 flex flex-wrap gap-1.5 px-3.5">
        <Chip icon={order.customerId ? Globe : Store}>
          {order.customerId ? t("barista.card.online", "Online") : t("barista.labels.walk_in", "Walk-in")}
        </Chip>
        {order.fulfillmentMethod ? (
          <Chip
            icon={fulfillmentIcon}
            className={order.fulfillmentMethod === "DINE_IN" ? "font-semibold text-gray-900" : undefined}
          >
            {fulfillmentLabel(order)}
          </Chip>
        ) : null}
        <PaymentChip order={order} />
        {order.status === "PENDING" && order.fulfillmentMethod === "DELIVERY" && order.deliveryFeeSetAt == null ? (
          <Chip icon={TriangleAlert} className="bg-amber-100 font-semibold text-amber-800">
            {t("barista.card.fee_needed", "Fee needed")}
          </Chip>
        ) : null}
        <OrderEstimateChip order={order} />
      </div>

      <ul className="mx-3.5 mt-3 divide-y divide-dashed divide-gray-200 border-t border-dashed border-gray-200">
        {order.items.map((item) => {
          const options = optionSummary({
            variantName: item.variantName,
            sugarLevel: item.sugarLevel,
            iceLevel: item.iceLevel,
            milkType: item.milkType,
            extras: item.extras.map((extra) => ({ name: titleCase(extra.name) })),
          });
          return (
            <li key={item.id} className="flex items-start justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="text-sm leading-snug text-gray-900">
                  <span className="font-bold tabular-nums">{item.quantity}×</span> {titleCase(item.productName)}
                </p>
                {options ? <p className="mt-0.5 text-xs leading-snug text-gray-500">{options}</p> : null}
              </div>
              <span className="shrink-0 text-sm font-semibold text-gray-900 tabular-nums">{money(item.subtotal)}</span>
            </li>
          );
        })}
      </ul>

      <ContactDetails order={order} />
      {order.note ? (
        <div className="mx-3.5 mt-3 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2">
          <MessageSquareText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden />
          <p className="min-w-0 text-xs font-medium whitespace-pre-line wrap-break-word text-amber-900">{order.note}</p>
        </div>
      ) : null}

      <div className="mt-auto px-3.5 pt-3 pb-3.5">
        <div className="flex items-baseline justify-between gap-3 border-t border-gray-100 pt-2.5">
          <span className="text-xs font-medium text-gray-500">{t("fields.total", "Total")}</span>
          <span className="text-lg font-bold text-gray-900 tabular-nums">{money(order.totalAmount)}</span>
        </div>
        {primary ? (
          <div className="mt-2.5 flex flex-wrap gap-2">
            {secondary ? (
              <Button
               
                onClick={secondary.onClick}
                disabled={isBusy}
                variant="outline" className="grow basis-30"
              >
                {secondary.label}
              </Button>
            ) : null}
            <Button onClick={primary.onClick} disabled={isBusy} variant="primary" className="grow basis-30">
              {PrimaryIcon ? <PrimaryIcon aria-hidden /> : null}
              {primary.label}
            </Button>
          </div>
        ) : hint ? (
          <p className="mt-2.5 rounded-lg bg-gray-50 px-3 py-2 text-center text-xs text-gray-500">{hint}</p>
        ) : null}
      </div>
    </article>
  );
}
