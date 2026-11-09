"use client";

import { useState } from "react";
import { Timer } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ESTIMATE_MAX_MINUTES,
  ESTIMATE_QUICK_MINUTES,
  getOrderEstimate,
  type OrderEstimate,
} from "@/lib/estimate";
import { useNow } from "@/hooks/useNow";
import type { OrderResponse } from "@/store/api/types";
import { estimateMinutesSchema } from "@/lib/formSchemas";
import { useI18n, type TranslationParams } from "@/contexts/I18nContext";
import { FieldError } from "@/components/common/AdminKit";
import { useFormErrors } from "@/hooks/useFormErrors";

type EstimateOrder = Pick<OrderResponse, "status" | "estimatedReadyAt">;

const REFRESH_MS = 30_000;

type Translate = (key: string, fallback?: string, params?: TranslationParams) => string;

function describeEstimate(estimate: OrderEstimate, t: Translate): string {
  switch (estimate.state) {
    case "counting":
      return t("estimate.counting", "~{minutes} min left · ready by {clock}", { minutes: estimate.minutesLeft, clock: estimate.clock });
    case "due":
      return t("estimate.due", "Overdue · was due at {clock}", { clock: estimate.clock });
    case "none":
      return t("estimate.none", "Not set — the customer sees “The shop will confirm the time shortly”.");
    case "finished":
      return "";
  }
}

export function OrderEstimateChip({ order }: { order: EstimateOrder }) {
  const { t } = useI18n();
  const now = useNow(REFRESH_MS);
  const estimate = getOrderEstimate(order, now);
  if (estimate.state !== "counting" && estimate.state !== "due") return null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold",
        estimate.state === "due" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"
      )}
      title={t("estimate.ready_by", "Ready by {clock}", { clock: estimate.clock })}
    >
      <Timer className="h-3 w-3" aria-hidden="true" />
      {estimate.state === "due" ? t("estimate.overdue", "Overdue") : t("estimate.minutes_approx", "~{minutes} min", { minutes: estimate.minutesLeft })}
    </span>
  );
}

export function OrderEstimateEditor({
  order,
  onSave,
  isSaving = false,
}: {
  order: EstimateOrder;
  onSave: (minutes: number) => void;
  isSaving?: boolean;
}) {
  const { t } = useI18n();
  const now = useNow(REFRESH_MS);
  const [custom, setCustom] = useState("");
  const validation = useFormErrors(estimateMinutesSchema, { minutes: custom });
  const estimate = getOrderEstimate(order, now);
  if (estimate.state === "finished") return null;

  const submitCustom = () => {
    const parsed = validation.validate();
    if (!parsed) return;
    onSave(parsed.minutes);
    setCustom("");
  };

  return (
    <section className="mt-4 rounded-xl border border-gray-200 bg-white p-3.5" aria-label={t("estimate.title", "Estimated time")}>
      <div className="flex items-start gap-2.5">
        <span
          className={cn(
            "grid h-8 w-8 shrink-0 place-items-center rounded-full",
            estimate.state === "due"
              ? "bg-red-50 text-red-600"
              : estimate.state === "counting"
                ? "bg-emerald-50 text-emerald-600"
                : "bg-gray-100 text-gray-500"
          )}
        >
          <Timer className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900">{t("estimate.title", "Estimated time")}</p>
          <p
            className={cn(
              "text-xs",
              estimate.state === "due" ? "font-medium text-red-600" : "text-gray-500"
            )}
          >
            {describeEstimate(estimate, t)}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {ESTIMATE_QUICK_MINUTES.map((minutes) => (
          <button
            key={minutes}
            type="button"
            onClick={() => onSave(minutes)}
            disabled={isSaving}
            className="rounded-full border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 transition hover:border-gray-900 hover:text-gray-900 disabled:opacity-50"
          >
            {t("estimate.minutes", "{minutes} min", { minutes })}
          </button>
        ))}
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            min="1"
            max={ESTIMATE_MAX_MINUTES}
            step="1"
            inputMode="numeric"
            placeholder={t("estimate.custom", "Custom")}
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submitCustom();
              }
            }}
            className="h-9 w-24 rounded-full border border-gray-300 px-3 text-base outline-none focus:border-gray-900"
            aria-label={t("estimate.custom_label", "Custom estimated minutes")}
            aria-invalid={validation.errors.minutes ? true : undefined}
            aria-describedby={validation.errors.minutes ? "estimate-minutes-error" : undefined}
          />
          <button
            type="button"
            onClick={submitCustom}
            disabled={isSaving || !custom.trim()}
            className="btn_primary_black h-9 rounded-full px-3 text-xs font-medium disabled:opacity-50"
          >
            {isSaving ? t("states.saving", "Saving...") : t("actions.set", "Set")}
          </button>
        </div>
      </div>
      <FieldError id="estimate-minutes-error" error={validation.errors.minutes} />
    </section>
  );
}
