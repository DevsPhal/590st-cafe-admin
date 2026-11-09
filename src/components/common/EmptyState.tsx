"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The one "nothing here" message: an optional icon, a title, an optional line of help and an optional action.
 * Tables use TableState (which renders this for an empty page); everything else uses this directly.
 */
export function EmptyState({
  title,
  description,
  icon: Icon,
  action,
  compact = false,
  className,
}: {
  title: string;
  description?: ReactNode;
  icon?: LucideIcon;
  action?: ReactNode;
  /** Less padding, for a small panel or a single table cell. */
  compact?: boolean;
  className?: string;
}) {
  return (
    <div role="status" className={cn("ui_empty_state", compact && "is_compact", className)}>
      {Icon ? (
        <span className="ui_empty_state_icon" aria-hidden>
          <Icon />
        </span>
      ) : null}
      <p className="ui_empty_state_title">{title}</p>
      {description ? <p className="ui_empty_state_description">{description}</p> : null}
      {action ? <div className="ui_empty_state_action">{action}</div> : null}
    </div>
  );
}
