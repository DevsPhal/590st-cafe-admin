"use client";

import { Loader2 } from "lucide-react";
import { useI18n } from "@/contexts/I18nContext";
import { cn } from "@/lib/utils";

/**
 * The one loading indicator: a spinner and a short label, announced to screen readers.
 * `block` centres it in a padded area (a card or panel still loading); inline sits in a line of text.
 */
export function Loader({ label, block = false, className }: { label?: string; block?: boolean; className?: string }) {
  const { t } = useI18n();
  return (
    <span role="status" aria-live="polite" className={cn("ui_loader", block && "is_block", className)}>
      <Loader2 className="ui_loader_icon" aria-hidden />
      <span>{label ?? t("states.loading", "Loading...")}</span>
    </span>
  );
}
