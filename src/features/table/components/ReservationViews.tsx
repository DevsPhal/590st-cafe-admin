"use client";

import { useCallback, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { format, parseISO } from "date-fns";
import { CalendarClock, CalendarPlus, Clock, Pencil, Phone, Users, UtensilsCrossed, X } from "lucide-react";

import { DataCard, ErrorState, FormInput, FormModal, FormSelect, FormTextarea, SkeletonBlock } from "@/components/common/AdminKit";
import { Button } from "@/components/common/Button";
import { EmptyState } from "@/components/common/EmptyState";
import { useI18n } from "@/contexts/I18nContext";
import { useFormErrors } from "@/hooks/useFormErrors";
import { useRealtimeTopic } from "@/hooks/useRealtimeTopic";
import { dateFnsLocale } from "@/lib/dateFormat";
import { reservationSchema } from "@/lib/formSchemas";
import { shopDate, shopDateTimeInput } from "@/lib/shopDate";
import { addMinutesToShopTime, canMarkNoShow, heldByOther } from "@/lib/tableTransitions";
import { cn } from "@/lib/utils";
import {
  type StaffScope,
  useCreateReservationMutation,
  useListReservationsQuery,
  useUpdateReservationMutation,
} from "@/store/api/tableApi";
import type { ReservationResponse, ReservationStatus, TableResponse } from "@/store/api/types";
import type { TableActions } from "./useTableActions";

const DURATIONS = [60, 90, 120, 150, 180, 240];

export function bookingTime(iso: string) {
  return format(parseISO(iso), "h:mm a", { locale: dateFnsLocale() });
}

export function bookingDayAndTime(iso: string) {
  return format(parseISO(iso), "d MMM, h:mm a", { locale: dateFnsLocale() });
}

function useStatusLabel() {
  const { t } = useI18n();
  return (status: ReservationStatus) =>
    ({
      BOOKED: t("tables.booking.status.booked", "Booked"),
      SEATED: t("tables.booking.status.seated", "Seated"),
      COMPLETED: t("tables.booking.status.completed", "Completed"),
      CANCELLED: t("tables.booking.status.cancelled", "Cancelled"),
      NO_SHOW: t("tables.booking.status.no_show", "No-show"),
    })[status];
}

/** One booking with what can be done to it now. */
export function BookingCard({
  reservation,
  sameTableBookings,
  actions,
  onEdit,
  showTable = false,
}: {
  reservation: ReservationResponse;
  /** Other bookings on the same table, to know whether an earlier one holds it first. */
  sameTableBookings: readonly ReservationResponse[];
  actions: TableActions;
  onEdit: (reservation: ReservationResponse) => void;
  showTable?: boolean;
}) {
  const { t } = useI18n();
  const statusLabel = useStatusLabel();
  const now = shopDateTimeInput();
  const booked = reservation.status === "BOOKED";
  const closed = !booked && reservation.status !== "SEATED";
  const heldBy = booked ? heldByOther(reservation, sameTableBookings, now) : null;

  return (
    <article
      className={cn("table_booking_card", reservation.status === "SEATED" && "is_seated", closed && "is_closed")}
      aria-label={t("tables.booking.card_label", "Booking for {name}", { name: reservation.customerName })}
    >
      <div className="table_booking_head">
        <b>{reservation.customerName}</b>
        <span className={cn("table_booking_status", `is_${reservation.status.toLowerCase()}`)}>
          {statusLabel(reservation.status)}
        </span>
      </div>
      <div className="table_booking_meta">
        <span>
          <Clock aria-hidden />
          {bookingTime(reservation.reservedFor)}–{bookingTime(reservation.endsAt)}
        </span>
        <span>
          <Users aria-hidden />
          {t("tables.booking.guests", "{count} guests", { count: reservation.partySize })}
        </span>
        {showTable ? (
          <span>
            <UtensilsCrossed aria-hidden />
            {t("tables.booking.table", "Table {number}", { number: reservation.tableNumber })}
          </span>
        ) : null}
        {reservation.customerPhone ? (
          <span>
            <Phone aria-hidden />
            <a href={`tel:${reservation.customerPhone.replace(/[^0-9+]/g, "")}`}>{reservation.customerPhone}</a>
          </span>
        ) : null}
      </div>
      {reservation.note ? <p className="table_detail_hint">{reservation.note}</p> : null}
      {reservation.closeReason ? <p className="table_detail_hint">{reservation.closeReason}</p> : null}
      {reservation.status === "SEATED" && reservation.seatedAt ? (
        <p className="table_detail_hint">
          {t("tables.booking.seated_at", "Seated at {time}", { time: bookingTime(reservation.seatedAt) })}
        </p>
      ) : null}
      {booked && heldBy ? (
        <p className="table_detail_hint">
          {t("tables.booking.held_first", "{name} ({time}) is ahead on this table.", {
            name: heldBy.customerName,
            time: bookingTime(heldBy.reservedFor),
          })}
        </p>
      ) : null}
      {booked ? (
        <div className="table_booking_actions">
          <Button
            variant="primary"
            disabled={actions.busy || reservation.tableId === null || (heldBy !== null && actions.scope !== "admin")}
            onClick={() => void actions.checkInBooking(reservation, { heldBy })}
          >
            {t("tables.booking.check_in", "Check in")}
          </Button>
          <Button variant="outline" disabled={actions.busy} onClick={() => onEdit(reservation)}>
            <Pencil />
            {t("actions.edit", "Edit")}
          </Button>
          <Button variant="outline" disabled={actions.busy} onClick={() => void actions.cancelBooking(reservation)}>
            <X />
            {t("tables.booking.cancel", "Cancel")}
          </Button>
          {canMarkNoShow(reservation.reservedFor, now) ? (
            <Button variant="outline" className="text-red-600" disabled={actions.busy} onClick={() => void actions.markNoShow(reservation)}>
              {t("tables.booking.no_show", "No-show")}
            </Button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

type BookingForm = {
  tableId: string;
  customerName: string;
  customerPhone: string;
  partySize: string;
  reservedFor: string;
  durationMinutes: string;
  note: string;
};

/** The next half hour in shop time, as a datetime-local value. */
function nextHalfHour() {
  const now = shopDateTimeInput();
  const minutes = Number(now.slice(14, 16));
  return addMinutesToShopTime(now, minutes < 30 ? 30 - minutes : 60 - minutes);
}

export type BookingTarget = { reservation?: ReservationResponse; tableId?: string } | null;

/** Book a table, or change a booking that has not been seated yet. */
export function BookingFormModal({
  target,
  onClose,
  scope,
  tables,
}: {
  target: BookingTarget;
  onClose: () => void;
  scope: StaffScope;
  tables: readonly TableResponse[];
}) {
  return target ? <BookingFormBody key={target.reservation?.id ?? `new-${target.tableId ?? ""}`} {...{ target, onClose, scope, tables }} /> : null;
}

function BookingFormBody({
  target,
  onClose,
  scope,
  tables,
}: {
  target: NonNullable<BookingTarget>;
  onClose: () => void;
  scope: StaffScope;
  tables: readonly TableResponse[];
}) {
  const { t } = useI18n();
  const editing = target.reservation;
  const [form, setForm] = useState<BookingForm>(() =>
    editing
      ? {
          tableId: editing.tableId ?? "",
          customerName: editing.customerName,
          customerPhone: editing.customerPhone ?? "",
          partySize: String(editing.partySize),
          reservedFor: editing.reservedFor.slice(0, 16),
          durationMinutes: String(editing.durationMinutes),
          note: editing.note ?? "",
        }
      : {
          tableId: target.tableId ?? "",
          customerName: "",
          customerPhone: "",
          partySize: "2",
          reservedFor: nextHalfHour(),
          durationMinutes: "90",
          note: "",
        }
  );
  const validation = useFormErrors(reservationSchema, form);
  const [create, createState] = useCreateReservationMutation();
  const [update, updateState] = useUpdateReservationMutation();
  const table = tables.find((candidate) => candidate.id === form.tableId);
  const durations = DURATIONS.includes(Number(form.durationMinutes)) ? DURATIONS : [...DURATIONS, Number(form.durationMinutes)];

  const save = async () => {
    const parsed = validation.validate();
    if (!parsed) return;
    if (table && parsed.partySize > table.capacity) {
      toast.error(t("tables.booking.too_many", "Table {number} seats at most {count} guests.", {
        number: table.tableNumber,
        count: table.capacity,
      }));
      return;
    }
    const body = { ...parsed, reservedFor: parsed.reservedFor.slice(0, 16) };
    try {
      if (editing) {
        await update({ scope, id: editing.id, body }).unwrap();
        toast.success(t("tables.booking.updated", "Booking updated"));
      } else {
        const created = await create({ scope, body }).unwrap();
        toast.success(t("tables.booking.created", "Table {number} booked for {name} at {time}", {
          number: created.tableNumber,
          name: created.customerName,
          time: bookingDayAndTime(created.reservedFor),
        }));
      }
      onClose();
    } catch (err) {
      validation.showServerError(err, t("tables.booking.save_error", "Could not save the booking."));
    }
  };

  return (
    <FormModal
      open
      onOpenChange={(open) => { if (!open) onClose(); }}
      title={
        editing
          ? t("tables.booking.edit_title", "Edit {name}'s booking", { name: editing.customerName })
          : t("tables.booking.new_title", "Book a table")
      }
      submitLabel={editing ? t("tables.booking.save", "Save booking") : t("tables.booking.book", "Book table")}
      onSubmit={save}
      isLoading={createState.isLoading || updateState.isLoading}
    >
      <div className="grid gap-4 p-4 md:grid-cols-2">
        <FormSelect
          label={t("tables.booking.field_table", "Table")}
          required
          value={form.tableId}
          error={validation.errors.tableId}
          placeholder={t("tables.booking.choose_table", "Choose a table")}
          onChange={(event) => setForm({ ...form, tableId: event.target.value })}
        >
          {tables.map((option) => (
            <option key={option.id} value={option.id}>
              {t("tables.booking.table_option", "Table {number} · {count} seats", {
                number: option.tableNumber,
                count: option.capacity,
              })}
            </option>
          ))}
        </FormSelect>
        <FormInput
          label={t("tables.booking.field_time", "Date and time")}
          type="datetime-local"
          required
          value={form.reservedFor}
          min={editing ? undefined : shopDateTimeInput()}
          error={validation.errors.reservedFor}
          onChange={(event) => setForm({ ...form, reservedFor: event.target.value })}
        />
        <FormInput
          label={t("tables.booking.field_name", "Guest name")}
          required
          maxLength={100}
          value={form.customerName}
          error={validation.errors.customerName}
          onChange={(event) => setForm({ ...form, customerName: event.target.value })}
        />
        <FormInput
          label={t("tables.booking.field_phone", "Phone (optional)")}
          type="tel"
          maxLength={30}
          autoComplete="off"
          value={form.customerPhone}
          error={validation.errors.customerPhone}
          onChange={(event) => setForm({ ...form, customerPhone: event.target.value })}
        />
        <FormInput
          label={table
            ? t("tables.booking.field_guests_max", "Guests (up to {count})", { count: table.capacity })
            : t("tables.booking.field_guests", "Guests")}
          required
          inputMode="numeric"
          value={form.partySize}
          error={validation.errors.partySize}
          onChange={(event) => setForm({ ...form, partySize: event.target.value.replace(/\D/g, "") })}
        />
        <FormSelect
          label={t("tables.booking.field_length", "Keeps the table for")}
          value={form.durationMinutes}
          error={validation.errors.durationMinutes}
          onChange={(event) => setForm({ ...form, durationMinutes: event.target.value })}
        >
          {durations.map((minutes) => (
            <option key={minutes} value={String(minutes)}>
              {minutes % 60 === 0
                ? t("tables.booking.hours", "{count} h", { count: minutes / 60 })
                : t("tables.booking.hours_minutes", "{hours} h {minutes} min", { hours: Math.floor(minutes / 60), minutes: minutes % 60 })}
            </option>
          ))}
        </FormSelect>
        <div className="md:col-span-2">
          <FormTextarea
            label={t("tables.booking.field_note", "Note (optional)")}
            rows={2}
            maxLength={500}
            value={form.note}
            error={validation.errors.note}
            onChange={(event) => setForm({ ...form, note: event.target.value })}
          />
        </div>
        <p className="table_detail_hint md:col-span-2">
          {t(
            "tables.booking.rules_hint",
            "The table is held for the party from 1 hour before, and walk-ins can't take it. A party 30 minutes late is marked as a no-show and the table is freed."
          )}
        </p>
      </div>
    </FormModal>
  );
}

/** All bookings for a day, with check-in, edit, cancel and no-show. */
export function BookingsCard({
  scope,
  tables,
  actions,
  onNew,
  onEdit,
}: {
  scope: StaffScope;
  tables: readonly TableResponse[];
  actions: TableActions;
  onNew: () => void;
  onEdit: (reservation: ReservationResponse) => void;
}) {
  const { t } = useI18n();
  const [date, setDate] = useState(() => shopDate());
  const query = useListReservationsQuery({ scope, date });
  const { data, isLoading, isFetching, error, refetch } = query;
  useRealtimeTopic("/topic/tables", useCallback(() => { void refetch(); }, [refetch]));
  const bookings = useMemo(() => data ?? [], [data]);
  const active = bookings.filter((booking) => booking.status === "BOOKED" || booking.status === "SEATED");
  const closed = bookings.filter((booking) => booking.status !== "BOOKED" && booking.status !== "SEATED");

  return (
    <DataCard
      title={t("tables.bookings.title", "Bookings")}
      meta={t("tables.bookings.meta", "{count} active on this day", { count: active.length })}
      actions={
        <Button variant="primary" onClick={onNew} disabled={tables.length === 0}>
          <CalendarPlus />
          {t("tables.booking.new_title", "Book a table")}
        </Button>
      }
    >
      <div className="table_bookings_toolbar">
        <FormInput
          label={t("tables.bookings.day", "Day")}
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value || shopDate())}
        />
        {date !== shopDate() ? (
          <Button variant="outline" onClick={() => setDate(shopDate())}>
            {t("tables.bookings.today", "Today")}
          </Button>
        ) : null}
      </div>
      {isLoading ? (
        <div className="table_bookings_grid">
          {Array.from({ length: 3 }).map((_, index) => <SkeletonBlock key={index} className="h-28 rounded-2xl" />)}
        </div>
      ) : error ? (
        <ErrorState
          error={error}
          fallback={t("tables.bookings.load_error", "Could not load bookings.")}
          onRetry={refetch}
          isRetrying={isFetching}
        />
      ) : bookings.length === 0 ? (
        <EmptyState icon={CalendarClock} title={t("tables.bookings.empty", "No bookings on this day.")} />
      ) : (
        <div className="table_bookings_grid">
          {[...active, ...closed].map((reservation) => (
            <BookingCard
              key={reservation.id}
              reservation={reservation}
              sameTableBookings={bookings}
              actions={actions}
              onEdit={onEdit}
              showTable
            />
          ))}
        </div>
      )}
    </DataCard>
  );
}
