"use client";

import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

import { useI18n } from "@/contexts/I18nContext";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { useReasonDialog } from "@/hooks/useReasonDialog";
import { apiErrorMessage } from "@/store/api/baseApi";
import {
  type StaffScope,
  useCancelReservationMutation,
  useCheckInReservationMutation,
  useMarkReservationNoShowMutation,
  useUpdateBaristaTableStatusMutation,
  useUpdateTableStatusMutation,
} from "@/store/api/tableApi";
import type { ReservationResponse, TableResponse, TableStatus, UpdateTableStatusRequest } from "@/store/api/types";
import type { Verdict } from "@/lib/tableTransitions";

export type StatusLabels = Record<TableStatus, string>;

/** The POS screen, opened for a table: seated=true adds the order to the party already there. */
export function posHref(tableNumber: string, seated: boolean) {
  const params = new URLSearchParams({ table: tableNumber });
  if (seated) params.set("seated", "1");
  return `/pos?${params.toString()}`;
}

/**
 * Every table and booking action, with the admin override flow: when the rules need an override, an admin
 * is asked for a reason (it goes in the table history) and baristas never see the action at all.
 */
export function useTableActions({ isAdmin, labels }: { isAdmin: boolean; labels: StatusLabels }) {
  const { t } = useI18n();
  const router = useRouter();
  const scope: StaffScope = isAdmin ? "admin" : "barista";
  const { askReason, reasonDialog } = useReasonDialog();
  const { confirm, confirmDialog } = useConfirmDialog();
  const [updateAdminStatus, adminStatus] = useUpdateTableStatusMutation();
  const [updateBaristaStatus, baristaStatus] = useUpdateBaristaTableStatusMutation();
  const [checkIn, checkInState] = useCheckInReservationMutation();
  const [cancel, cancelState] = useCancelReservationMutation();
  const [noShow, noShowState] = useMarkReservationNoShowMutation();
  const busy =
    adminStatus.isLoading || baristaStatus.isLoading || checkInState.isLoading || cancelState.isLoading || noShowState.isLoading;

  const askOverride = (description: string) =>
    askReason({
      title: t("tables.override.title", "Override table rules"),
      description,
      label: t("tables.override.reason", "Reason"),
      placeholder: t("tables.override.placeholder", "Why is this needed? It is saved in the table history."),
      confirmLabel: t("tables.override.confirm", "Override"),
      required: true,
    });

  const changeStatus = async (
    table: TableResponse,
    to: TableStatus,
    options: { verdict: Verdict; guestCount?: number; overrideNote?: string }
  ): Promise<boolean> => {
    if (options.verdict === "NEVER" || (options.verdict === "ADMIN_OVERRIDE" && !isAdmin)) return false;
    let body: UpdateTableStatusRequest = { status: to, guestCount: to === "OCCUPIED" ? options.guestCount ?? 1 : 0 };
    if (options.verdict === "ADMIN_OVERRIDE") {
      const reason = await askOverride(
        options.overrideNote ??
          t("tables.override.status", "Table {number} goes from {from} to {to}, which the table rules normally block.", {
            number: table.tableNumber,
            from: labels[table.status],
            to: labels[to],
          })
      );
      if (reason === null) return false;
      body = { ...body, override: true, overrideReason: reason };
    }
    try {
      const update = isAdmin ? updateAdminStatus : updateBaristaStatus;
      const updated = await update({ id: table.id, body }).unwrap();
      if (updated.status !== table.status) {
        toast.success(
          to === "AVAILABLE" && updated.status === "RESERVED"
            ? t("tables.toast.held_after_clean", "Table {number} is clean and now held for its booking", {
                number: table.tableNumber,
              })
            : t("tables.toast.status_now", "Table {number}: {status}", {
                number: table.tableNumber,
                status: labels[updated.status],
              })
        );
      }
      return true;
    } catch (err) {
      toast.error(apiErrorMessage(err as never, t("tables.toast.update_error", "Could not update the table.")));
      return false;
    }
  };

  const takeOrder = (tableNumber: string, seated: boolean) => router.push(posHref(tableNumber, seated));

  const checkInBooking = async (
    reservation: ReservationResponse,
    options: { guestCount?: number; heldBy?: ReservationResponse | null } = {}
  ) => {
    let body: { guestCount?: number; override?: boolean; overrideReason?: string } = { guestCount: options.guestCount };
    if (options.heldBy) {
      if (!isAdmin) {
        toast.error(
          t("tables.booking.held_by_other", "Table {number} is held for {name} first. Check that party in, or move this booking.", {
            number: reservation.tableNumber,
            name: options.heldBy.customerName,
          })
        );
        return;
      }
      const reason = await askOverride(
        t("tables.override.check_in", "Table {number} is held for {name}. Seat {guest} there anyway?", {
          number: reservation.tableNumber,
          name: options.heldBy.customerName,
          guest: reservation.customerName,
        })
      );
      if (reason === null) return;
      body = { ...body, override: true, overrideReason: reason };
    }
    try {
      await checkIn({ scope, id: reservation.id, body }).unwrap();
    } catch (err) {
      toast.error(apiErrorMessage(err as never, t("tables.booking.check_in_error", "Could not check the party in.")));
      return;
    }
    const orderNow = await confirm({
      title: t("tables.booking.seated_title", "{name} is seated at table {number}", {
        name: reservation.customerName,
        number: reservation.tableNumber,
      }),
      description: t("tables.booking.seated_description", "The table is now occupied. Take their order now?"),
      confirmLabel: t("tables.actions.take_order", "Take order"),
      cancelLabel: t("tables.booking.later", "Later"),
    });
    if (orderNow) takeOrder(reservation.tableNumber, true);
  };

  const cancelBooking = async (reservation: ReservationResponse) => {
    const reason = await askReason({
      title: t("tables.booking.cancel_title", "Cancel {name}'s booking", { name: reservation.customerName }),
      label: t("tables.booking.cancel_reason", "Reason (optional)"),
      confirmLabel: t("tables.booking.cancel_confirm", "Cancel booking"),
    });
    if (reason === null) return;
    try {
      await cancel({ scope, id: reservation.id, body: reason ? { reason } : {} }).unwrap();
      toast.success(t("tables.booking.cancelled", "Booking cancelled"));
    } catch (err) {
      toast.error(apiErrorMessage(err as never, t("tables.booking.cancel_error", "Could not cancel the booking.")));
    }
  };

  const markNoShow = async (reservation: ReservationResponse) => {
    const ok = await confirm({
      title: t("tables.booking.no_show_title", "Mark {name} as a no-show?", { name: reservation.customerName }),
      description: t("tables.booking.no_show_description", "The booking closes and table {number} is freed.", {
        number: reservation.tableNumber,
      }),
      confirmLabel: t("tables.booking.no_show", "No-show"),
      tone: "danger",
    });
    if (!ok) return;
    try {
      await noShow({ scope, id: reservation.id }).unwrap();
      toast.success(t("tables.booking.marked_no_show", "Marked as a no-show"));
    } catch (err) {
      toast.error(apiErrorMessage(err as never, t("tables.booking.no_show_error", "Could not update the booking.")));
    }
  };

  return {
    scope,
    busy,
    changeStatus,
    takeOrder,
    checkInBooking,
    cancelBooking,
    markNoShow,
    dialogs: (
      <>
        {reasonDialog}
        {confirmDialog}
      </>
    ),
  };
}

export type TableActions = ReturnType<typeof useTableActions>;
