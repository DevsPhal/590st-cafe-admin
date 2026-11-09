"use client";

import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  ArrowRight,
  ChevronRight,
  CircleCheck,
  Clock,
  ConciergeBell,
  PackageMinus,
  PhoneCall,
  ShoppingBag,
  MessageSquareText,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { useListLowStockQuery } from "@/store/api/inventoryApi";
import {
  useAnswerStaffCallMutation,
  useListOrdersQuery,
  useListStaffCallsQuery,
} from "@/store/api/orderApi";
import {
  useAnswerBaristaStaffCallMutation,
  useListAllBaristaOrdersQuery,
  useListBaristaStaffCallsQuery,
} from "@/store/api/baristaOrderApi";
import { useCurrentRole } from "@/store/api/useCurrentRole";
import { apiErrorMessage } from "@/store/api/baseApi";
import { NEW_MESSAGES_PREVIEW, useListContactMessagesQuery } from "@/store/api/contactApi";
import { contactMessageToastId, contactTopicLabel, focusContactMessage } from "@/lib/contactMessages";
import { useStaffOrderAlerts } from "@/hooks/useStaffOrderAlerts";
import { useStaffCallAlerts } from "@/hooks/useStaffCallAlerts";
import { useInventoryAlerts } from "@/hooks/useInventoryAlerts";
import { useFeedbackAlerts } from "@/hooks/useFeedbackAlerts";
import { cn, fulfillmentLabel, timeAgo, titleCase } from "@/lib/utils";
import { enumLabel } from "@/lib/enumLabel";
import { notify } from "@/components/common/AppToast";
import { useI18n } from "@/contexts/I18nContext";
import { Input } from "@/components/ui/input";
import {
  STAFF_CALL_REPLY_LIMIT,
  staffCallQuickReplies,
  staffCallReasonLabel,
} from "@/lib/staffCall";
import type { StaffCallResponse } from "@/store/api/types";
import { lowStockNotice, newMessageNotice, orderNotice, staffCallNotice, staffCallToastId } from "@/lib/liveNotifications";
import { Loader } from "@/components/common/Loader";

const polling = { pollingInterval: 30000, skipPollingIfUnfocused: true };

const SEEN_KEY = "alerts-seen-count";

function readSeen(): number {
  try {
    const stored = Number(window.localStorage.getItem(SEEN_KEY));
    return Number.isFinite(stored) && stored > 0 ? stored : 0;
  } catch {
    return 0;
  }
}

function writeSeen(value: number) {
  try {
    window.localStorage.setItem(SEEN_KEY, String(value));
  } catch {
  }
}

let seenValue: number | null = null;
const seenListeners = new Set<() => void>();

function publishSeen(next: number, persist: boolean) {
  if (seenValue === next) return;
  seenValue = next;
  if (persist) writeSeen(next);
  seenListeners.forEach((notify) => notify());
}

function subscribeSeen(notify: () => void) {
  seenListeners.add(notify);
  return () => {
    seenListeners.delete(notify);
  };
}

function useUnseenCount(count: number | undefined) {
  const seen = useSyncExternalStore(
    subscribeSeen,
    () => seenValue,
    () => null,
  );

  useEffect(() => {
    if (seenValue === null) publishSeen(readSeen(), false);
  }, []);

  useEffect(() => {
    if (count === undefined || seen === null || count >= seen) return;
    publishSeen(count, true);
  }, [count, seen]);

  const markSeen = useCallback(() => {
    if (count !== undefined) publishSeen(count, true);
  }, [count]);

  const unseen =
    count === undefined || seen === null
      ? undefined
      : Math.max(0, count - seen);

  return { unseen, markSeen };
}

export function useOperationalAlerts() {
  const { t } = useI18n();
  const { isAdmin, isBarista, isLoading: roleLoading } = useCurrentRole();
  const adminOrders = useListOrdersQuery(
    { status: "PENDING", page: 1, size: 5 },
    { ...polling, skip: !isAdmin },
  );
  const baristaOrders = useListAllBaristaOrdersQuery(
    { status: "PENDING", page: 1, size: 5 },
    { ...polling, skip: !isBarista },
  );
  const stock = useListLowStockQuery(
    { page: 1, size: 5 },
    { ...polling, skip: !isAdmin && !isBarista },
  );
  const messages = useListContactMessagesQuery(NEW_MESSAGES_PREVIEW, {
    ...polling,
    skip: !isAdmin,
  });
  const adminStaffCalls = useListStaffCallsQuery(undefined, {
    ...polling,
    skip: !isAdmin,
  });
  const baristaStaffCalls = useListBaristaStaffCallsQuery(undefined, {
    ...polling,
    skip: !isBarista,
  });
  const orders = isBarista ? baristaOrders : adminOrders;
  const staffCalls = isBarista ? baristaStaffCalls : adminStaffCalls;
  const [adminAnswerStaffCall, { isLoading: isAnsweringAdmin }] =
    useAnswerStaffCallMutation();
  const [baristaAnswerStaffCall, { isLoading: isAnsweringBarista }] =
    useAnswerBaristaStaffCallMutation();
  const answerStaffCallMutation = isBarista
    ? baristaAnswerStaffCall
    : adminAnswerStaffCall;
  const error = orders.error || stock.error || staffCalls.error;
  const loading =
    roleLoading || orders.isLoading || stock.isLoading || staffCalls.isLoading;
  const count =
    orders.data && stock.data && !error
      ? orders.data.totalElements +
        stock.data.totalElements +
        (messages.data?.totalElements ?? 0) +
        (staffCalls.data?.length ?? 0)
      : undefined;
  const { unseen, markSeen } = useUnseenCount(count);

  useStaffOrderAlerts(
    useCallback(
      (message) => {
        if (!isAdmin && !isBarista) return;
        void orders.refetch();
        const notice = orderNotice(message, {
          orders: isBarista ? "/barista-queue" : "/orders",
          deliveryFee: isBarista ? "/barista-queue" : "/payments",
        });
        if (notice) notify({ ...notice, icon: <ShoppingBag /> });
      },
      [isAdmin, isBarista, orders],
    ),
  );

  useStaffCallAlerts(
    useCallback(
      (message) => {
        if (!isAdmin && !isBarista) return;
        void staffCalls.refetch();
        if (message.type === "ANSWERED") toast.dismiss(staffCallToastId(message.orderId));
        const notice = staffCallNotice(message, "/notifications");
        if (notice) notify({ ...notice, icon: <ConciergeBell /> });
      },
      [isAdmin, isBarista, staffCalls],
    ),
  );

  useInventoryAlerts(
    useCallback(() => {
      if (isAdmin || isBarista) void stock.refetch();
    }, [isAdmin, isBarista, stock]),
  );
  useFeedbackAlerts(
    useCallback(
      (change) => {
        if (!isAdmin) return;
        if (change.change !== "CREATED") {
          // Someone already handled this message, so its pop-up is no longer news.
          toast.dismiss(contactMessageToastId(change.id));
          void messages.refetch();
          return;
        }
        // The new message is the newest, so the refreshed preview has the sender, topic and text for the pop-up.
        void messages.refetch().then((result) => {
          const message = result.data?.content.find((item) => item.id === change.id);
          notify({
            ...newMessageNotice(change.id, message, "/notifications"),
            icon: <MessageSquareText />,
            onAction: () => focusContactMessage(change.id),
          });
        });
      },
      [isAdmin, messages],
    ),
  );

  const lowStockTotal = stock.data?.totalElements;
  const previousLowStock = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (lowStockTotal === undefined) return;
    const previous = previousLowStock.current;
    previousLowStock.current = lowStockTotal;
    if (previous !== undefined && lowStockTotal > previous) {
      notify({ ...lowStockNotice(lowStockTotal, "/stock-alerts"), icon: <PackageMinus /> });
    }
  }, [lowStockTotal]);

  const answerStaffCall = useCallback(
    async (orderId: string, reply?: string): Promise<boolean> => {
      try {
        await answerStaffCallMutation({ id: orderId, reply: reply?.trim() || undefined }).unwrap();
        toast.success(reply?.trim() ? t("alerts.reply_sent", "Reply sent to the customer.") : t("alerts.on_the_way", "Customer notified that you're on the way."));
        return true;
      } catch (err) {
        toast.error(
          apiErrorMessage(err as never, t("alerts.answer_failed", "Could not answer the call.")),
        );
        return false;
      }
    },
    [answerStaffCallMutation, t],
  );

  return {
    orders,
    stock,
    staffCalls,
    messages,
    showMessages: isAdmin,
    answerStaffCall,
    isAnsweringStaffCall: isAnsweringAdmin || isAnsweringBarista,
    error,
    loading,
    count,
    unseen,
    markSeen,
    ordersHref: isBarista ? "/barista-queue" : "/orders",
    refresh: () => {
      if (isAdmin || isBarista) {
        void orders.refetch();
        void stock.refetch();
        void staffCalls.refetch();
      }
      if (isAdmin) void messages.refetch();
    },
  };
}

type AlertTone = "red" | "orange" | "amber" | "sky";

const TONE: Record<
  AlertTone,
  { section: string; icon: string; badge: string; item: string; link: string; empty: string }
> = {
  red: {
    section: "border-red-100 bg-red-50/60",
    icon: "bg-red-100 text-red-600",
    badge: "bg-red-600 text-white",
    item: "border-red-100 hover:border-red-300 focus-visible:ring-red-500",
    link: "text-red-700 hover:text-red-800 focus-visible:ring-red-500",
    empty: "border-red-200",
  },
  orange: {
    section: "border-orange-100 bg-orange-50/60",
    icon: "bg-orange-100 text-orange-600",
    badge: "bg-orange-700 text-white",
    item: "border-orange-100 hover:border-orange-300 focus-visible:ring-orange-500",
    link: "text-orange-700 hover:text-orange-800 focus-visible:ring-orange-500",
    empty: "border-orange-200",
  },
  amber: {
    section: "border-amber-200/70 bg-amber-50/70",
    icon: "bg-amber-100 text-amber-600",
    badge: "bg-amber-400 text-amber-950",
    item: "border-amber-100 hover:border-amber-300 focus-visible:ring-amber-500",
    link: "text-amber-800 hover:text-amber-900 focus-visible:ring-amber-500",
    empty: "border-amber-200",
  },
  sky: {
    section: "border-sky-100 bg-sky-50/60",
    icon: "bg-sky-100 text-sky-700",
    badge: "bg-sky-700 text-white",
    item: "border-sky-100 hover:border-sky-300 focus-visible:ring-sky-500",
    link: "text-sky-700 hover:text-sky-800 focus-visible:ring-sky-500",
    empty: "border-sky-200",
  },
};

const ALERT_ITEM =
  "group flex items-center gap-2 rounded-xl border bg-white p-3 shadow-(--shadow-card) transition-[border-color,box-shadow] duration-150 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 sm:gap-3 sm:p-3.5";

export function AlertSection({
  id,
  tone,
  icon: Icon,
  label,
  srTitle,
  count,
  children,
  footer,
}: {
  id?: string;
  tone: AlertTone;
  icon: LucideIcon;
  label: string;
  srTitle: string;
  count: number;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const headingId = useId();
  return (
    <section id={id} aria-labelledby={headingId} className={cn("rounded-2xl border p-3 sm:p-5", TONE[tone].section)}>
      <h3 id={headingId} className="flex items-center gap-3">
        <span aria-hidden className={cn("grid size-9 shrink-0 place-items-center rounded-xl", TONE[tone].icon)}>
          <Icon className="size-4.5" />
        </span>
        <span className="sr-only">{srTitle}</span>
        <span aria-hidden className="min-w-0 flex-1 text-[15px] font-semibold leading-snug text-(--ink)">
          {label}
        </span>
        <span
          aria-hidden
          className={cn(
            "inline-flex h-7 min-w-7 shrink-0 items-center justify-center rounded-full px-2 text-sm font-bold tabular-nums",
            count > 0 ? TONE[tone].badge : "bg-white text-slate-500 ring-1 ring-inset ring-slate-200"
          )}
        >
          {count}
        </span>
      </h3>
      <div className="mt-3 space-y-2">{children}</div>
      {footer}
    </section>
  );
}

export function EmptyAlert({ tone, children }: { tone: AlertTone; children: ReactNode }) {
  return (
    <p
      className={cn(
        "flex items-center gap-2 rounded-xl border border-dashed bg-white/80 px-3.5 py-3 text-sm text-slate-600",
        TONE[tone].empty
      )}
    >
      <CircleCheck aria-hidden className="size-4 shrink-0 text-emerald-600" />
      {children}
    </p>
  );
}

function SectionLink({ tone, href, children }: { tone: AlertTone; href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(
        "group mt-3 inline-flex items-center gap-1.5 rounded-md text-sm font-semibold underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        TONE[tone].link
      )}
    >
      {children}
      <ArrowRight
        aria-hidden
        className="size-4 transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none"
      />
    </Link>
  );
}

export function OperationalAlertsContent({
  alerts,
  showMessages = true,
}: {
  alerts: ReturnType<typeof useOperationalAlerts>;
  // The alerts page shows the full message inbox instead, so it turns this summary off.
  showMessages?: boolean;
}) {
  const { t } = useI18n();
  if (alerts.loading)
    return (
      <Loader block label={t("alerts.loading", "Loading current alerts...")} />
    );
  if (alerts.error)
    return (
      <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        <p className="flex items-start gap-2">
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          {apiErrorMessage(
            alerts.error as never,
            t("alerts.load_failed", "Could not load current alerts."),
          )}
        </p>
        <button
          type="button"
          className="mt-3 inline-flex h-9 items-center rounded-lg bg-white px-3.5 font-semibold text-red-700 ring-1 ring-inset ring-red-200 transition-colors hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          onClick={alerts.refresh}
        >
          {t("actions.retry", "Retry")}
        </button>
      </div>
    );
  const staffCallCount = alerts.staffCalls.data?.length ?? 0;
  const pendingOrderCount = alerts.orders.data?.totalElements ?? 0;
  const lowStockCount = alerts.stock.data?.totalElements ?? 0;
  const messageCount = alerts.messages.data?.totalElements ?? 0;
  return (
    <div className="space-y-4">
      <p className="flex items-start gap-2.5 text-sm leading-relaxed text-slate-600">
        <span aria-hidden className="relative mt-1.75 flex size-2 shrink-0">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75 motion-reduce:hidden" />
          <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
        </span>
        {alerts.showMessages
          ? t("alerts.intro_with_messages", "Current staff calls, pending orders, low stock and customer messages. Updates every 30 seconds.")
          : t("alerts.intro", "Current staff calls, pending orders and low stock. Updates every 30 seconds.")}
      </p>
      <AlertSection
        tone="red"
        icon={PhoneCall}
        label={t("alerts.staff_calls_label", "Staff calls")}
        srTitle={t("alerts.staff_calls", "Staff calls ({count})", { count: staffCallCount })}
        count={staffCallCount}
      >
        {alerts.staffCalls.data?.length ? (
          alerts.staffCalls.data.map((call) => (
            <StaffCallItem
              key={call.orderId}
              call={call}
              disabled={alerts.isAnsweringStaffCall}
              onAnswer={alerts.answerStaffCall}
            />
          ))
        ) : (
          <EmptyAlert tone="red">{t("alerts.no_staff_calls", "No open staff calls.")}</EmptyAlert>
        )}
      </AlertSection>
      <AlertSection
        tone="orange"
        icon={ShoppingBag}
        label={t("alerts.pending_orders_label", "Pending orders")}
        srTitle={t("alerts.pending_orders", "Pending orders ({count})", { count: pendingOrderCount })}
        count={pendingOrderCount}
        footer={
          <SectionLink tone="orange" href={alerts.ordersHref}>
            {t("alerts.view_all_orders", "View all orders")}
          </SectionLink>
        }
      >
        {alerts.orders.data?.content.length ? (
          alerts.orders.data.content.map((order) => (
            <Link
              key={order.id}
              href={alerts.ordersHref}
              className={cn(ALERT_ITEM, TONE.orange.item)}
            >
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-semibold tracking-wide text-(--ink)">
                    #{order.id.slice(0, 8).toUpperCase()}
                  </span>
                  {order.fulfillmentMethod === "DELIVERY" &&
                    order.deliveryFeeSetAt == null && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                        {t("alerts.needs_delivery_fee", "Needs delivery fee")}
                      </span>
                    )}
                </span>
                <span className="mt-1 flex flex-wrap items-center gap-x-1.5 text-sm text-slate-600">
                  <span className="wrap-anywhere font-medium text-(--ink)">
                    {order.customerName ? titleCase(order.customerName) : t("alerts.walk_in", "Walk-in")}
                  </span>
                  <span>·</span>
                  <span>{order.paymentMethod ? enumLabel(t, "payment_method", order.paymentMethod) : t("alerts.unpaid", "Unpaid")}</span>
                </span>
              </span>
              <span className="shrink-0 text-base font-bold tabular-nums text-(--ink)">
                <span className="sr-only">· </span>${Number(order.totalAmount).toFixed(2)}
              </span>
              <ChevronRight
                aria-hidden
                className="size-4 shrink-0 text-slate-400 transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none"
              />
            </Link>
          ))
        ) : (
          <EmptyAlert tone="orange">{t("alerts.no_pending_orders", "No pending orders.")}</EmptyAlert>
        )}
      </AlertSection>
      <AlertSection
        tone="amber"
        icon={PackageMinus}
        label={t("alerts.low_stock_label", "Low stock")}
        srTitle={t("alerts.low_stock", "Low stock ({count})", { count: lowStockCount })}
        count={lowStockCount}
        footer={
          <SectionLink tone="amber" href="/stock-alerts">
            {t("alerts.view_stock_alerts", "View stock alerts")}
          </SectionLink>
        }
      >
        {alerts.stock.data?.content.length ? (
          alerts.stock.data.content.map((item) => (
            <Link
              key={item.productId}
              href="/stock-alerts"
              className={cn(ALERT_ITEM, TONE.amber.item)}
            >
              <span className="min-w-0 flex-1 wrap-break-word text-sm font-medium text-(--ink)">
                {titleCase(item.productName)}
                <span className="sr-only">:</span>
              </span>
              <span className="shrink-0 rounded-lg bg-amber-100 px-2.5 py-1 text-sm font-bold tabular-nums text-amber-900">
                {Number(item.quantityOnHand).toLocaleString()}{" "}
                <span className="text-xs font-semibold tracking-wide">{enumLabel(t, "unit", item.unit)}</span>
              </span>
              <ChevronRight
                aria-hidden
                className="size-4 shrink-0 text-slate-400 transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none"
              />
            </Link>
          ))
        ) : (
          <EmptyAlert tone="amber">{t("alerts.no_low_stock", "No low-stock items.")}</EmptyAlert>
        )}
      </AlertSection>
      {alerts.showMessages && showMessages && (
        <AlertSection
          tone="sky"
          icon={MessageSquareText}
          label={t("alerts.messages_label", "Customer messages")}
          srTitle={t("alerts.messages", "Customer messages needing a reply ({count})", { count: messageCount })}
          count={messageCount}
          footer={
            <SectionLink tone="sky" href="/notifications">
              {t("alerts.open_inbox", "Open message inbox")}
            </SectionLink>
          }
        >
          {alerts.messages.data?.content.length ? (
            alerts.messages.data.content.map((message) => (
              <Link
                key={message.id}
                href="/notifications"
                onClick={() => focusContactMessage(message.id)}
                className={cn(ALERT_ITEM, TONE.sky.item)}
              >
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="wrap-anywhere text-sm font-semibold text-(--ink)">
                      {titleCase(message.fullName)}
                    </span>
                    <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-800">
                      {contactTopicLabel(message.topic)}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500">
                      <Clock aria-hidden className="size-3.5" />
                      {timeAgo(message.createdAt)}
                    </span>
                  </span>
                  <span className="mt-1 line-clamp-2 wrap-break-word text-sm text-slate-600">
                    {message.message}
                  </span>
                </span>
                <ChevronRight
                  aria-hidden
                  className="size-4 shrink-0 text-slate-400 transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none"
                />
              </Link>
            ))
          ) : alerts.messages.error ? (
            <p role="alert" className="text-sm text-red-700">
              {apiErrorMessage(alerts.messages.error as never, t("notifications.contact.errors.load", "Could not load messages."))}
            </p>
          ) : (
            <EmptyAlert tone="sky">{t("alerts.no_messages", "No messages waiting for a reply.")}</EmptyAlert>
          )}
        </AlertSection>
      )}
    </div>
  );
}

function StaffCallItem({
  call,
  disabled,
  onAnswer,
}: {
  call: StaffCallResponse;
  disabled: boolean;
  onAnswer: (orderId: string, reply?: string) => Promise<boolean>;
}) {
  const { t } = useI18n();
  const [replying, setReplying] = useState(false);
  const [reply, setReply] = useState("");

  const send = async (text?: string) => {
    const sent = await onAnswer(call.orderId, text);
    if (sent) {
      setReplying(false);
      setReply("");
    }
  };

  return (
    <div className="rounded-xl border border-red-200 bg-white p-3 shadow-(--shadow-card) sm:p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1 basis-60">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-semibold tracking-wide text-(--ink)">
              #{call.orderId.slice(0, 8).toUpperCase()}
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700">
              <Clock aria-hidden className="size-3.5" />
              {timeAgo(call.calledAt)}
            </span>
          </span>
          <span className="mt-1.5 inline-block rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-800">
            {staffCallReasonLabel(call.reason)}
          </span>
          {call.note && (
            <span className="mt-1.5 block wrap-break-word text-sm italic text-slate-700">
              &ldquo;{call.note}&rdquo;
            </span>
          )}
          <span className="mt-1 block wrap-break-word text-sm text-slate-600">
            <span className="font-medium text-(--ink)">
              {call.customerName ? titleCase(call.customerName) : t("alerts.walk_in", "Walk-in")}
            </span>{" "}
            · {enumLabel(t, "order_status", call.orderStatus)}
            {call.fulfillmentMethod
              ? ` · ${fulfillmentLabel(call)}`
              : ""}
          </span>
        </div>
        {!replying && (
          <button
            type="button"
            className="inline-flex h-10 w-full shrink-0 items-center justify-center rounded-lg bg-red-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:opacity-50 sm:h-9 sm:w-auto"
            disabled={disabled}
            onClick={() => setReplying(true)}
          >
            {t("alerts.respond", "Respond")}
          </button>
        )}
      </div>
      {replying && (
        <form
          className="mt-3 space-y-2.5 border-t border-red-100 pt-3"
          onSubmit={(event) => {
            event.preventDefault();
            void send(reply);
          }}
        >
          <div className="flex flex-wrap gap-1.5">
            {staffCallQuickReplies(call.reason).map((text) => (
              <button
                key={text}
                type="button"
                disabled={disabled}
                onClick={() => void send(text)}
                className="rounded-full border border-red-200 bg-white px-3 py-2 text-xs font-medium text-red-800 transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:opacity-50 sm:py-1"
              >
                {text}
              </button>
            ))}
          </div>
          <Input
            aria-label={t("alerts.reply_label", "Reply to customer")}
            value={reply}
            maxLength={STAFF_CALL_REPLY_LIMIT}
            onChange={(event) => setReply(event.target.value)}
            placeholder={t("alerts.reply_placeholder", "Or type a reply to the customer…")}
            disabled={disabled}
            className="bg-white"
          />
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              className="inline-flex h-10 flex-1 items-center justify-center whitespace-nowrap rounded-lg px-3.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 sm:h-9 sm:flex-none"
              disabled={disabled}
              onClick={() => {
                setReplying(false);
                setReply("");
              }}
            >
              {t("actions.cancel", "Cancel")}
            </button>
            <button
              type="submit"
              className="inline-flex h-10 flex-1 items-center justify-center whitespace-nowrap rounded-lg bg-red-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:opacity-50 sm:h-9 sm:flex-none"
              disabled={disabled}
            >
              {reply.trim() ? t("alerts.send_reply", "Send reply") : t("alerts.answer_silently", "Answer without message")}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
