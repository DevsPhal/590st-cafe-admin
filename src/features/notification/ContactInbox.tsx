"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { CircleCheck, Copy, Loader2, Mail, MessageSquareText, Phone, RotateCcw, TriangleAlert } from "lucide-react";
import {
  NEW_MESSAGES_PREVIEW,
  useListContactMessagesQuery,
  useUpdateContactStatusMutation,
  type ContactMessage,
} from "@/store/api/contactApi";
import { useCurrentRole } from "@/store/api/useCurrentRole";
import { apiErrorMessage } from "@/store/api/baseApi";
import { AlertSection, EmptyAlert } from "@/components/common/OperationalAlerts";
import { useFeedbackAlerts } from "@/hooks/useFeedbackAlerts";
import { usePersistentState } from "@/hooks/usePersistentState";
import { useI18n } from "@/contexts/I18nContext";
import {
  clearContactMessageFocus,
  contactMessageAnchor,
  contactTopicLabel,
  replyMailto,
  useContactMessageFocus,
} from "@/lib/contactMessages";
import { SHOP_TIME_ZONE, parseShopDateTime } from "@/lib/estimate";
import { formatPhone, phoneDigits } from "@/lib/phone";
import { cn, timeAgo, titleCase } from "@/lib/utils";
import { formatLocalDate } from "@/lib/dateFormat";
import { Loader } from "@/components/common/Loader";

type MessageStatus = ContactMessage["status"];

const PAGE_SIZE = 10;
const HIGHLIGHT_MS = 5000;

const BUTTON =
  "inline-flex h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 sm:h-9 [&_svg]:size-4 [&_svg]:shrink-0";
const BUTTON_PRIMARY = "bg-sky-700 text-white hover:bg-sky-800 focus-visible:ring-sky-500";
const BUTTON_RESOLVE = "bg-emerald-700 text-white hover:bg-emerald-800 focus-visible:ring-emerald-500";
const BUTTON_OUTLINE =
  "bg-white text-slate-700 ring-1 ring-inset ring-slate-200 hover:bg-slate-50 focus-visible:ring-slate-400";
// On phones the main actions take a full row and the rest share one, stacking when their labels don't fit.
const ACTION_WIDE = "flex-1 basis-full sm:flex-none sm:basis-auto";
const ACTION_HALF = "flex-1 basis-[calc(50%-0.25rem)] sm:flex-none sm:basis-auto";

// Long messages start folded so one essay doesn't push every other message off screen.
function isLong(text: string) {
  return text.length > 240 || text.split("\n").length > 4;
}

function sentAtLabel(createdAt: string) {
  return formatLocalDate(parseShopDateTime(createdAt), {
    timeZone: SHOP_TIME_ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ContactInbox() {
  const { t } = useI18n();
  const { isAdmin } = useCurrentRole();
  const [page, setPage] = usePersistentState("contact-inbox:page", 1);
  const [status, setStatus] = usePersistentState<MessageStatus>("contact-inbox:status", "NEW");
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const [highlightId, setHighlightId] = useState<string | null>(null);

  const list = useListContactMessagesQuery(
    { page, size: PAGE_SIZE, status },
    { skip: !isAdmin, pollingInterval: 15000, refetchOnMountOrArgChange: true },
  );
  // Same cached request the bell uses, so the "Needs attention" count costs nothing extra.
  const unanswered = useListContactMessagesQuery(NEW_MESSAGES_PREVIEW, { skip: !isAdmin });
  const newCount = unanswered.data?.totalElements ?? 0;
  const { refetch } = list;
  useFeedbackAlerts(useCallback(() => { if (isAdmin) void refetch(); }, [isAdmin, refetch]));

  const [updateStatus, { isLoading: isUpdating, originalArgs }] = useUpdateContactStatusMutation();
  const busyId = isUpdating ? originalArgs?.id : undefined;

  // A toast or the alerts panel picked a message: open the first "Needs attention" page, where new messages land.
  const focusId = useContactMessageFocus();
  const [handledFocusId, setHandledFocusId] = useState<string | null>(null);
  if (focusId !== handledFocusId) {
    setHandledFocusId(focusId);
    if (focusId) {
      setStatus("NEW");
      setPage(1);
      setExpanded((prev) => new Set(prev).add(focusId));
      setHighlightId(focusId);
    }
  }

  const rows = list.currentData?.content;
  const totalPages = Math.max(1, list.currentData?.totalPages ?? 1);
  // Resolving the last message on the last page would otherwise leave an empty page behind.
  if (list.currentData && page > totalPages) setPage(totalPages);

  useEffect(() => {
    if (!focusId || status !== "NEW" || page !== 1 || list.isFetching || !rows) return;
    const card = document.getElementById(contactMessageAnchor(focusId));
    if (card) {
      card.scrollIntoView({ behavior: "smooth", block: "center" });
      card.focus({ preventScroll: true });
    }
    clearContactMessageFocus();
  }, [focusId, status, page, list.isFetching, rows]);

  useEffect(() => {
    if (!highlightId) return;
    const timer = window.setTimeout(() => setHighlightId(null), HIGHLIGHT_MS);
    return () => window.clearTimeout(timer);
  }, [highlightId]);

  if (!isAdmin) return null;

  const changeStatus = async (message: ContactMessage, next: MessageStatus) => {
    try {
      await updateStatus({ id: message.id, status: next }).unwrap();
      toast.success(
        next === "RESOLVED"
          ? t("notifications.contact.toast.resolved", "Marked as resolved")
          : t("notifications.contact.toast.reopened", "Moved back to Needs attention"),
      );
    } catch (error) {
      toast.error(apiErrorMessage(error as never, t("notifications.contact.errors.update", "Could not update the message.")));
    }
  };

  const copyEmail = async (email: string) => {
    try {
      await navigator.clipboard.writeText(email);
      toast.success(t("notifications.contact.toast.email_copied", "Email copied"));
    } catch {
      toast.error(t("notifications.contact.errors.copy", "Could not copy the email."));
    }
  };

  const toggleExpanded = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const filters: { value: MessageStatus; label: string }[] = [
    { value: "NEW", label: t("notifications.contact.tabs.new", "Needs attention") },
    { value: "RESOLVED", label: t("notifications.contact.tabs.resolved", "Resolved") },
  ];

  return (
    <AlertSection
      id="customer-messages"
      tone="sky"
      icon={MessageSquareText}
      label={t("notifications.contact.label", "Customer messages")}
      srTitle={t("alerts.messages", "Customer messages needing a reply ({count})", { count: newCount })}
      count={newCount}
      footer={
        totalPages > 1 ? (
          <nav
            aria-label={t("notifications.contact.pagination", "Message pages")}
            className="mt-3 flex items-center justify-between gap-2 text-sm sm:gap-3"
          >
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className={cn(BUTTON, BUTTON_OUTLINE, "shrink-0")}
            >
              {t("actions.previous", "Previous")}
            </button>
            <span className="min-w-0 text-center text-slate-600">
              {t("notifications.contact.page_of", "Page {page} of {total}", { page, total: totalPages })}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className={cn(BUTTON, BUTTON_OUTLINE, "shrink-0")}
            >
              {t("actions.next", "Next")}
            </button>
          </nav>
        ) : null
      }
    >
      <div
        role="group"
        aria-label={t("notifications.contact.status_label", "Message status")}
        className="inline-flex rounded-xl bg-white p-1 ring-1 ring-inset ring-sky-100"
      >
        {filters.map((filter) => {
          const active = status === filter.value;
          return (
            <button
              key={filter.value}
              type="button"
              aria-pressed={active}
              onClick={() => {
                setStatus(filter.value);
                setPage(1);
              }}
              className={cn(
                "inline-flex h-9 items-center rounded-lg px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 sm:h-8",
                active ? "bg-sky-700 text-white" : "text-slate-600 hover:bg-sky-50",
              )}
            >
              {filter.label}
            </button>
          );
        })}
      </div>

      {list.isLoading || (list.isFetching && !rows) ? (
        <Loader block label={t("notifications.contact.loading", "Loading messages...")} />
      ) : list.error ? (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-800">
          <p className="flex items-start gap-2">
            <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
            {apiErrorMessage(list.error as never, t("notifications.contact.errors.load", "Could not load messages."))}
          </p>
          <button
            type="button"
            className={cn(BUTTON, BUTTON_OUTLINE, "mt-3 text-red-700 ring-red-200 hover:bg-red-100")}
            onClick={() => void refetch()}
          >
            {t("actions.retry", "Retry")}
          </button>
        </div>
      ) : rows?.length ? (
        rows.map((message) => (
          <MessageCard
            key={message.id}
            message={message}
            expanded={expanded.has(message.id)}
            highlighted={highlightId === message.id}
            busy={busyId === message.id}
            onToggle={() => toggleExpanded(message.id)}
            onChangeStatus={(next) => void changeStatus(message, next)}
            onCopyEmail={() => void copyEmail(message.email)}
          />
        ))
      ) : (
        <EmptyAlert tone="sky">
          {status === "NEW"
            ? t("notifications.contact.empty_new", "All caught up — no messages need a reply.")
            : t("notifications.contact.empty_resolved", "No resolved messages yet.")}
        </EmptyAlert>
      )}
    </AlertSection>
  );
}

function MessageCard({
  message,
  expanded,
  highlighted,
  busy,
  onToggle,
  onChangeStatus,
  onCopyEmail,
}: {
  message: ContactMessage;
  expanded: boolean;
  highlighted: boolean;
  busy: boolean;
  onToggle: () => void;
  onChangeStatus: (next: MessageStatus) => void;
  onCopyEmail: () => void;
}) {
  const { t } = useI18n();
  const isNew = message.status === "NEW";
  const long = isLong(message.message);
  const name = titleCase(message.fullName);
  // The form lets customers type any name, so show the account too when it's someone else's.
  const accountName =
    message.customerName && message.customerName.trim().toLowerCase() !== message.fullName.trim().toLowerCase()
      ? titleCase(message.customerName)
      : null;
  const titleId = `${contactMessageAnchor(message.id)}-title`;

  return (
    <article
      id={contactMessageAnchor(message.id)}
      tabIndex={-1}
      aria-labelledby={titleId}
      className={cn(
        "rounded-xl border bg-white p-3 shadow-(--shadow-card) outline-none transition-shadow duration-300 sm:p-4",
        isNew ? "border-sky-200" : "border-slate-200",
        highlighted && "ring-2 ring-sky-500 ring-offset-2",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <h4 id={titleId} className="flex min-w-0 flex-1 basis-60 flex-wrap items-center gap-x-2 gap-y-1">
          <span className="flex min-w-0 items-center gap-2">
            {isNew && (
              <span className="size-2 shrink-0 rounded-full bg-sky-600">
                <span className="sr-only">{t("notifications.contact.unread", "Needs a reply")}: </span>
              </span>
            )}
            <span className="wrap-anywhere text-[15px] font-semibold text-(--ink)">{name}</span>
          </span>
          <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-800">
            {contactTopicLabel(message.topic)}
          </span>
          {!isNew && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800">
              <CircleCheck aria-hidden className="size-3.5" />
              {t("notifications.contact.tabs.resolved", "Resolved")}
            </span>
          )}
        </h4>
        <time dateTime={message.createdAt} className="text-xs font-medium text-slate-500">
          {timeAgo(message.createdAt)} · {sentAtLabel(message.createdAt)}
        </time>
      </div>

      <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-sm text-slate-600">
        <span className="wrap-anywhere">{message.email}</span>
        {message.phoneNumber && <span>{formatPhone(message.phoneNumber)}</span>}
        {accountName && (
          <span className="wrap-anywhere">{t("notifications.contact.account", "Account: {name}", { name: accountName })}</span>
        )}
      </p>

      {/* The padding sits outside the clamped text, or the cut-off line shows through it. */}
      <div className="mt-3 rounded-lg bg-slate-50 p-3">
        <p
          className={cn(
            "whitespace-pre-wrap wrap-break-word text-sm leading-relaxed text-(--ink)",
            long && !expanded && "line-clamp-4",
          )}
        >
          {message.message}
        </p>
      </div>
      {long && (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={onToggle}
          className="mt-1.5 rounded text-sm font-semibold text-sky-700 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
        >
          {expanded
            ? t("notifications.contact.show_less", "Show less")
            : t("notifications.contact.show_more", "Show full message")}
        </button>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
        <a href={replyMailto(message)} className={cn(BUTTON, BUTTON_PRIMARY, ACTION_WIDE)}>
          <Mail aria-hidden />
          {t("notifications.contact.reply_by_email", "Reply by email")}
        </a>
        {message.phoneNumber && (
          <a href={`tel:${phoneDigits(message.phoneNumber)}`} className={cn(BUTTON, BUTTON_OUTLINE, ACTION_HALF)}>
            <Phone aria-hidden />
            {t("notifications.contact.call", "Call")}
          </a>
        )}
        <button type="button" onClick={onCopyEmail} className={cn(BUTTON, BUTTON_OUTLINE, ACTION_HALF)}>
          <Copy aria-hidden />
          {t("notifications.contact.copy_email", "Copy email")}
        </button>
        {isNew ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => onChangeStatus("RESOLVED")}
            className={cn(BUTTON, BUTTON_RESOLVE, ACTION_WIDE, "sm:ml-auto")}
          >
            {busy ? <Loader2 aria-hidden className="animate-spin motion-reduce:animate-none" /> : <CircleCheck aria-hidden />}
            {t("notifications.contact.mark_resolved", "Mark resolved")}
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => onChangeStatus("NEW")}
            className={cn(BUTTON, BUTTON_OUTLINE, ACTION_WIDE, "sm:ml-auto")}
          >
            {busy ? <Loader2 aria-hidden className="animate-spin motion-reduce:animate-none" /> : <RotateCcw aria-hidden />}
            {t("notifications.contact.reopen", "Reopen")}
          </button>
        )}
      </div>
    </article>
  );
}
