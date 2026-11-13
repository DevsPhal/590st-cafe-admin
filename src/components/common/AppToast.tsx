"use client";

import type { JSX } from "react";
import Link from "next/link";
import { BellRing, CircleCheck, Info, Loader2, OctagonX, X } from "lucide-react";
import toast, { resolveValue, type Toast } from "react-hot-toast";
import { translate, useI18n } from "@/contexts/I18nContext";

const TONE_ICONS = {
  success: CircleCheck,
  error: OctagonX,
  loading: Loader2,
  blank: Info,
} as const;

type Tone = keyof typeof TONE_ICONS;

export function AppToast({ t }: { t: Toast }) {
  const { t: tr } = useI18n();
  const tone: Tone = t.type in TONE_ICONS ? (t.type as Tone) : "blank";
  const Icon = TONE_ICONS[tone];
  const message = resolveValue(t.message, t);
  const showProgress = tone !== "loading" && Number.isFinite(t.duration);

  return (
    <div
      {...t.ariaProps}
      data-tone={tone}
      className={`app_toast ${t.visible ? "app_toast_enter" : "app_toast_leave"} ${t.className ?? ""}`}
      style={t.style}
    >
      <span className="app_toast_icon" aria-hidden="true">
        {t.icon ?? <Icon className={tone === "loading" ? "animate-spin" : undefined} />}
      </span>
      <div className="app_toast_body">
        {typeof message === "string" ? <p className="app_toast_text">{message}</p> : message}
      </div>
      {tone !== "loading" && (
        <button
          type="button"
          onClick={() => toast.dismiss(t.id)}
          aria-label={tr("toast.dismiss", "Dismiss notification")}
          className="app_toast_close"
        >
          <X aria-hidden="true" />
        </button>
      )}
      {showProgress && (
        <span className="app_toast_progress" style={{ animationDuration: `${t.duration}ms` }} />
      )}
    </div>
  );
}

export type NotifyTone = "info" | "success" | "urgent";

export interface NotifyOptions {
  id: string;
  title: string;
  description?: string;
  tone?: NotifyTone;
  icon?: JSX.Element;
  href?: string;
  actionLabel?: string;
  // Runs when the action link is clicked, just before navigating to href.
  onAction?: () => void;
  duration?: number;
}

export function notify({
  id,
  title,
  description,
  tone = "info",
  icon,
  href,
  actionLabel = translate("actions.view", "View"),
  onAction,
  duration = 8000,
}: NotifyOptions) {
  const content = (
    <div className="app_toast_notice">
      <p className="app_toast_title">{title}</p>
      {description ? <p className="app_toast_text app_toast_muted">{description}</p> : null}
      {href ? (
        <Link
          href={href}
          onClick={() => {
            onAction?.();
            toast.dismiss(id);
          }}
          className="app_toast_action"
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
  const options = {
    id,
    duration,
    icon: icon ?? <BellRing />,
    className: tone === "urgent" ? "is_urgent" : undefined,
  };
  return tone === "success" ? toast.success(content, options) : toast(content, options);
}
