"use client";

import { format, parseISO } from "date-fns";

import { ErrorState, SkeletonBlock } from "@/components/common/AdminKit";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useI18n } from "@/contexts/I18nContext";
import { dateFnsLocale } from "@/lib/dateFormat";
import { cn } from "@/lib/utils";
import { useGetTableHistoryQuery } from "@/store/api/tableApi";
import type { TableAuditAction, TableResponse } from "@/store/api/types";
import type { StatusLabels } from "./useTableActions";

/** Admin only: every status change on a table, who made it, and why rules were overridden. */
export function TableHistoryDialog({
  table,
  labels,
  onClose,
}: {
  table: TableResponse | null;
  labels: StatusLabels;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const { data, isLoading, isFetching, error, refetch } = useGetTableHistoryQuery(table?.id ?? "", {
    skip: !table,
    refetchOnMountOrArgChange: true,
  });
  const actionLabel: Record<TableAuditAction, string> = {
    STATUS_CHANGED: t("tables.history.status_changed", "Status changed"),
    ORDER_SEATED: t("tables.history.order_seated", "Seated by an order"),
    ORDER_ADDED: t("tables.history.order_added", "Order added for the seated party"),
    ORDERS_FINISHED: t("tables.history.orders_finished", "Last order finished"),
    RESERVATION_HELD: t("tables.history.reservation_held", "Held for a booking"),
    RESERVATION_CHECKED_IN: t("tables.history.checked_in", "Booked party checked in"),
    RESERVATION_RELEASED: t("tables.history.released", "Booking released the table"),
  };

  return (
    <Dialog open={table !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="admin_modal sm:max-w-[560px]">
        <DialogHeader className="admin_modal_header">
          <DialogTitle className="admin_modal_title">
            {t("tables.history.title", "Table {number} history", { number: table?.tableNumber ?? "" })}
          </DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="grid gap-2 p-4">
            {Array.from({ length: 4 }).map((_, index) => <SkeletonBlock key={index} className="h-14 rounded-xl" />)}
          </div>
        ) : error ? (
          <div className="p-4">
            <ErrorState error={error} fallback={t("tables.history.load_error", "Could not load the history.")} onRetry={refetch} isRetrying={isFetching} />
          </div>
        ) : (data ?? []).length === 0 ? (
          <p className="p-4 text-sm text-gray-500">{t("tables.history.empty", "No changes recorded yet.")}</p>
        ) : (
          <ol className="table_history_list">
            {(data ?? []).map((entry) => (
              <li key={entry.id} className={cn(entry.override && "is_override")}>
                <div className="table_history_head">
                  <b>{actionLabel[entry.action]}</b>
                  <small>{format(parseISO(entry.createdAt), "d MMM, h:mm a", { locale: dateFnsLocale() })}</small>
                </div>
                <span>
                  {entry.fromStatus && entry.fromStatus !== entry.toStatus
                    ? `${labels[entry.fromStatus]} → ${labels[entry.toStatus]}`
                    : labels[entry.toStatus]}
                  {entry.toStatus === "OCCUPIED" && entry.guestCount > 0
                    ? ` · ${t("tables.history.guests", "{count} guests", { count: entry.guestCount })}`
                    : ""}
                </span>
                <small>{entry.actor ? entry.actor.name : t("tables.history.system", "System")}</small>
                {entry.override ? (
                  <>
                    <span className="table_override_tag">{t("tables.history.override", "Admin override")}</span>
                    {entry.reason ? <small>“{entry.reason}”</small> : null}
                  </>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </DialogContent>
    </Dialog>
  );
}
