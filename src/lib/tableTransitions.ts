// The table rules the API enforces (Coffee-Shop-API: TableRules.java and DiningTableServiceImpl.claimForOrder).
// The screens use them to offer only the moves that will work; the API still has the final say.
// Keep both sides in step: tableTransitions.test.mjs uses the same matrix as TableRulesTest.java.

export type TableStatus = "AVAILABLE" | "OCCUPIED" | "RESERVED" | "CLEANING";
export type Verdict = "ALLOWED" | "ADMIN_OVERRIDE" | "NEVER";

export const TABLE_STATUSES: readonly TableStatus[] = ["AVAILABLE", "OCCUPIED", "RESERVED", "CLEANING"];

/**
 * A status change made by hand on the Tables screen.
 *
 *              to AVAILABLE   to OCCUPIED    to RESERVED   to CLEANING
 * AVAILABLE    -              yes            never         yes
 * OCCUPIED     admin          -              never         yes
 * RESERVED     yes (*)        admin          -             yes
 * CLEANING     yes            yes            never         -
 *
 * RESERVED only ever comes from a booking. (*) only when no booking holds the table.
 * On top of this: a party with active orders can't be cleared, and seating anyone at a table a booking
 * is holding needs an admin override (see manualChangeAt).
 */
export function manualChange(from: TableStatus, to: TableStatus): Verdict {
  if (from === to) return "ALLOWED";
  if (to === "RESERVED") return "NEVER";
  if (from === "OCCUPIED" && to === "AVAILABLE") return "ADMIN_OVERRIDE";
  if (from === "RESERVED" && to === "OCCUPIED") return "ADMIN_OVERRIDE";
  return "ALLOWED";
}

export type TableContext = {
  /** Active (unfinished) orders at the table. */
  activeOrders: number;
  /** A booking whose hold window has started is keeping this table. */
  heldByBooking: boolean;
};

/** manualChange plus the checks that depend on the table's orders and bookings. */
export function manualChangeAt(from: TableStatus, to: TableStatus, context: TableContext): Verdict {
  const base = manualChange(from, to);
  if (base === "NEVER" || from === to) return base;
  if (from === "OCCUPIED" && context.activeOrders > 0) return "NEVER";
  if (from === "RESERVED" && to === "AVAILABLE" && context.heldByBooking) return "NEVER";
  if (to === "OCCUPIED" && from !== "OCCUPIED" && context.heldByBooking) return "ADMIN_OVERRIDE";
  return base;
}

export type PosSeating = {
  /** The order is for the party already at the table. */
  forSeatedParty: boolean;
  /** An admin overrides the table rules; a reason is required. */
  override: boolean;
  overrideReason: string;
};

/**
 * What a POS order at a table of this status needs (mirrors claimForOrder):
 *  - "WALK_IN": nothing extra, the table is free;
 *  - "SEATED_PARTY": staff confirm it is for the party already there (occupied, or waiting to be cleaned),
 *    or an admin overrides;
 *  - "OVERRIDE": reserved, only an admin override seats it (the booked party is checked in from Tables).
 */
export function posRequirement(status: TableStatus): "WALK_IN" | "SEATED_PARTY" | "OVERRIDE" {
  if (status === "AVAILABLE") return "WALK_IN";
  if (status === "RESERVED") return "OVERRIDE";
  return "SEATED_PARTY";
}

/** Why the POS can't send the order to this table yet, or null when it can. */
export function posBlocker(
  status: TableStatus | undefined,
  seating: PosSeating,
  isAdmin: boolean
): "CONFIRM_SEATED_PARTY" | "RESERVED" | "OVERRIDE_REASON" | null {
  if (!status) return null;
  const requirement = posRequirement(status);
  if (requirement === "WALK_IN") return null;
  const overriding = isAdmin && seating.override;
  if (overriding) return seating.overrideReason.trim() ? null : "OVERRIDE_REASON";
  if (requirement === "SEATED_PARTY") return seating.forSeatedParty ? null : "CONFIRM_SEATED_PARTY";
  return "RESERVED";
}

/** The request fields for a POS order, sending only the choices that apply to the table's status. */
export function posSeatingFields(status: TableStatus | undefined, seating: PosSeating, isAdmin: boolean) {
  if (!status || posRequirement(status) === "WALK_IN") return {};
  if (isAdmin && seating.override) return { override: true, overrideReason: seating.overrideReason.trim() };
  if (posRequirement(status) === "SEATED_PARTY" && seating.forSeatedParty) return { forSeatedParty: true };
  return {};
}

/** A booked party can be marked as a no-show only once its time has come. */
export function canMarkNoShow(reservedFor: string, nowShopTime: string): boolean {
  return reservedFor.slice(0, 16) <= nowShopTime.slice(0, 16);
}

/** The API holds a table this long before its booking (app.table.reservation.hold-before-minutes). */
export const HOLD_BEFORE_MINUTES = 60;

type BookingLike = { id: string; tableId: string | null; status: string; reservedFor: string; customerName: string };

/** yyyy-MM-ddTHH:mm plus some minutes, as wall-clock text (no time zone involved). */
export function addMinutesToShopTime(shopTime: string, minutes: number): string {
  const [date, time] = shopTime.slice(0, 16).split("T");
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const moved = new Date(Date.UTC(year, month - 1, day, hour, minute + minutes));
  return moved.toISOString().slice(0, 16);
}

/**
 * Another booking on the same table that is held first (earlier, and its hold window has started), so
 * seating this party there needs an admin override. Null when the table is free for this booking.
 */
export function heldByOther<T extends BookingLike>(booking: T, bookings: readonly T[], nowShopTime: string): T | null {
  const holdStarted = addMinutesToShopTime(nowShopTime, HOLD_BEFORE_MINUTES);
  return (
    bookings
      .filter((other) => other.id !== booking.id && other.tableId === booking.tableId && other.status === "BOOKED")
      .filter((other) => other.reservedFor < booking.reservedFor && other.reservedFor.slice(0, 16) <= holdStarted)
      .sort((a, b) => a.reservedFor.localeCompare(b.reservedFor))[0] ?? null
  );
}
