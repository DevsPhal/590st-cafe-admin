import { format, type Locale as DateFnsLocale } from "date-fns";
import { km } from "date-fns/locale";
import { currentLocale } from "@/contexts/translate";

/** date-fns locale for the language on screen; English uses date-fns' built-in default. */
export function dateFnsLocale(): DateFnsLocale | undefined {
  return currentLocale() === "kh" ? km : undefined;
}

const MONTH_TOKENS: Record<string, string> = { "2-digit": "MM", numeric: "M", short: "MMM", long: "MMMM", narrow: "MMMMM" };

// The same fields as the Intl options, as a date-fns pattern. Khmer weekday abbreviations are a single
// letter, so the (already short) full names are used instead.
function khmerPattern(options: Intl.DateTimeFormatOptions): string {
  const weekday = options.weekday ? "EEEE" : "";
  const date = [
    options.day && (options.day === "2-digit" ? "dd" : "d"),
    options.month && MONTH_TOKENS[options.month],
    options.year && (options.year === "2-digit" ? "yy" : "yyyy"),
  ].filter(Boolean).join(" ");
  const time = options.hour ? `${options.hour === "2-digit" ? "HH" : "H"}:mm` : "";
  return [weekday, date, time].filter(Boolean).join(", ");
}

/**
 * `date.toLocaleString(english, options)` in English. In Khmer, the same fields with Khmer month and weekday
 * names on a 24-hour clock. Browsers only ship Intl date data for their own UI languages and Khmer is usually
 * missing (Chrome silently falls back to US English), so Khmer goes through date-fns, which bundles it.
 */
export function formatLocalDate(date: Date, options: Intl.DateTimeFormatOptions, english = "en-GB"): string {
  if (currentLocale() !== "kh") return new Intl.DateTimeFormat(english, options).format(date);
  return format(options.timeZone ? wallClockIn(options.timeZone, date) : date, khmerPattern(options), { locale: km });
}

// The same instant as a local Date showing the wall-clock time in `timeZone` (e.g. the shop's), so date-fns
// can format it. Numeric parts come out the same in every browser, unlike month names.
function wallClockIn(timeZone: string, date: Date): Date {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone, year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", hourCycle: "h23",
  }).formatToParts(date).map((part) => [part.type, Number(part.value)]));
  return new Date(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
}
