import { format, isValid, parse } from "date-fns";
import { dateFnsLocale } from "@/lib/dateFormat";

// Attendance times are Cambodia wall-clock values with no offset (the API's LocalDateTime),
// so they are shown as written and never shifted through the browser's time zone.
export function formatShiftTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = parse(value.slice(0, 16), "yyyy-MM-dd'T'HH:mm", new Date());
  return isValid(date) ? format(date, "dd MMM yyyy, h:mm a", { locale: dateFnsLocale() }) : "—";
}

const wallClockMs = (value: string) => Date.parse(`${value.length === 16 ? `${value}:00` : value.slice(0, 19)}Z`);

/** Minutes a running shift has lasted by `now`: 0 in its first minute, null when the check-in can't be read. */
export function minutesSoFar(checkInAt: string, now: string): number | null {
  const diff = wallClockMs(now) - wallClockMs(checkInAt);
  return Number.isFinite(diff) ? Math.max(0, Math.floor(diff / 60000)) : null;
}

/**
 * Worked minutes for a finished shift, calculated from its check-in and check-out times. Falls back to the
 * stored workedMinutes when the times can't be read, and gives null for a running shift or unusable data.
 */
export function shiftWorkedMinutes(record: {
  checkInAt: string | null;
  checkOutAt: string | null;
  workedMinutes: number | null;
}): number | null {
  if (!record.checkOutAt) return null;
  const fromTimes = record.checkInAt ? minutesBetween(record.checkInAt, record.checkOutAt) : null;
  if (fromTimes != null) return fromTimes;
  const stored = record.workedMinutes;
  return typeof stored === "number" && Number.isFinite(stored) && stored >= 0 ? stored : null;
}

/** Whole minutes from one wall-clock value to a later one, the way the API computes workedMinutes. */
export function minutesBetween(from: string, to: string): number | null {
  const diff = wallClockMs(to) - wallClockMs(from);
  return Number.isFinite(diff) && diff > 0 ? Math.floor(diff / 60000) : null;
}
