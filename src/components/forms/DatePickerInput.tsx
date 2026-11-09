"use client";

import { useState } from "react";
import { format, isValid, parse } from "date-fns";
import { km as dayPickerKhmer } from "react-day-picker/locale";
import { dateFnsLocale } from "@/lib/dateFormat";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useI18n } from "@/contexts/I18nContext";

// Same string formats the native <input type="..."> used, so callers keep their state as-is.
const VALUE_FORMAT = {
  date: "yyyy-MM-dd",
  "datetime-local": "yyyy-MM-dd'T'HH:mm",
  month: "yyyy-MM",
} as const;

const DISPLAY_FORMAT = {
  date: "dd MMM yyyy",
  "datetime-local": "dd MMM yyyy, h:mm a",
  month: "MMM yyyy",
} as const;

const PLACEHOLDER = {
  date: ["date_picker.select_date", "Select date"],
  "datetime-local": ["date_picker.select_date_time", "Select date & time"],
  month: ["date_picker.select_month", "Select month"],
} as const;

export type DatePickerType = keyof typeof VALUE_FORMAT;

export const DATE_PICKER_TYPES = new Set<string>(Object.keys(VALUE_FORMAT));

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

function parseValue(type: DatePickerType, value?: string | number) {
  if (value == null || value === "") return undefined;
  const raw = String(value);
  // Accept a value with seconds too (yyyy-MM-ddTHH:mm:ss) by trimming to the expected length.
  const date = parse(raw.slice(0, VALUE_FORMAT[type].replace(/'/g, "").length), VALUE_FORMAT[type], new Date());
  return isValid(date) ? date : undefined;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function DatePickerInput({
  type,
  value,
  onChange,
  min,
  max,
  placeholder,
  disabled = false,
  readOnly = false,
  className,
  id,
  "aria-label": ariaLabel,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
}: {
  type: DatePickerType;
  value?: string | number;
  onChange?: (value: string) => void;
  min?: string | number;
  max?: string | number;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
  className?: string;
  id?: string;
  "aria-label"?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}) {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const months = Array.from({ length: 12 }, (_, i) => format(new Date(2000, i, 1), "MMM", { locale: dateFnsLocale() }));
  const selected = parseValue(type, value);
  const minDate = parseValue(type, min);
  const maxDate = parseValue(type, max);
  const [viewYear, setViewYear] = useState(() => (selected ?? new Date()).getFullYear());

  const emit = (next: Date | undefined) => {
    if (!next) {
      onChange?.("");
      return;
    }
    let clamped = next;
    if (minDate && clamped < minDate) clamped = minDate;
    if (maxDate && clamped > maxDate) clamped = maxDate;
    onChange?.(format(clamped, VALUE_FORMAT[type]));
  };

  const handleOpenChange = (next: boolean) => {
    if (disabled || readOnly) return;
    if (next) setViewYear((selected ?? new Date()).getFullYear());
    setOpen(next);
  };

  const pickDay = (day: Date | undefined) => {
    if (!day) return;
    if (type === "date") {
      emit(day);
      setOpen(false);
      return;
    }
    // Keep the chosen time when moving to another day; default new picks to the current hour.
    const time = selected ?? new Date(new Date().setMinutes(0, 0, 0));
    emit(new Date(day.getFullYear(), day.getMonth(), day.getDate(), time.getHours(), time.getMinutes()));
  };

  const setTime = (part: "hour" | "minute" | "period", next: string) => {
    const base = selected ?? new Date(new Date().setHours(0, 0, 0, 0));
    let hours = base.getHours();
    let minutes = base.getMinutes();
    const isPm = hours >= 12;
    if (part === "hour") hours = (Number(next) % 12) + (isPm ? 12 : 0);
    if (part === "minute") minutes = Number(next);
    if (part === "period") hours = (hours % 12) + (next === "PM" ? 12 : 0);
    emit(new Date(base.getFullYear(), base.getMonth(), base.getDate(), hours, minutes));
  };

  const monthDisabled = (year: number, month: number) => {
    const key = year * 12 + month;
    if (minDate && key < minDate.getFullYear() * 12 + minDate.getMonth()) return true;
    if (maxDate && key > maxDate.getFullYear() * 12 + maxDate.getMonth()) return true;
    return false;
  };

  const now = new Date();
  const hour12 = selected ? String(selected.getHours() % 12 || 12) : undefined;
  const minute = selected ? String(selected.getMinutes()).padStart(2, "0") : undefined;
  const period = selected ? (selected.getHours() >= 12 ? "PM" : "AM") : undefined;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          disabled={disabled}
          aria-label={ariaLabel}
          // A button can't carry aria-invalid; the description still announces the error.
          data-invalid={ariaInvalid ? "true" : undefined}
          aria-describedby={ariaDescribedBy}
          className={cn(
            "form_field_control form_field_date",
            !selected && "is_placeholder",
            readOnly && "is_readonly",
            disabled && "is_disabled",
            className
          )}
        >
          <span className="truncate">
            {selected ? format(selected, DISPLAY_FORMAT[type], { locale: dateFnsLocale() }) : placeholder ?? t(PLACEHOLDER[type][0], PLACEHOLDER[type][1])}
          </span>
          <CalendarDays className="form_field_icon" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="date_picker_popover">
        {type === "month" ? (
          <div className="date_picker_months">
            <div className="date_picker_months_header">
              <button type="button" className="date_picker_nav" onClick={() => setViewYear(viewYear - 1)} aria-label={t("date_picker.previous_year", "Previous year")}>
                <ChevronLeft />
              </button>
              <span>{viewYear}</span>
              <button type="button" className="date_picker_nav" onClick={() => setViewYear(viewYear + 1)} aria-label={t("date_picker.next_year", "Next year")}>
                <ChevronRight />
              </button>
            </div>
            <div className="date_picker_months_grid">
              {months.map((label, month) => {
                const isSelected = selected?.getFullYear() === viewYear && selected.getMonth() === month;
                const isCurrent = now.getFullYear() === viewYear && now.getMonth() === month;
                return (
                  <button
                    key={label}
                    type="button"
                    disabled={monthDisabled(viewYear, month)}
                    className={cn("date_picker_month", isCurrent && "is_current", isSelected && "is_selected")}
                    onClick={() => {
                      emit(new Date(viewYear, month, 1));
                      setOpen(false);
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <Calendar
            mode="single"
            locale={locale === "kh" ? dayPickerKhmer : undefined}
            selected={selected}
            onSelect={pickDay}
            defaultMonth={selected ?? minDate ?? maxDate}
            disabled={[
              ...(minDate ? [{ before: startOfDay(minDate) }] : []),
              ...(maxDate ? [{ after: maxDate }] : []),
            ]}
          />
        )}

        {type === "datetime-local" ? (
          <div className="date_picker_time">
            <span className="date_picker_time_label">{t("fields.time", "Time")}</span>
            <div className="date_picker_time_controls">
              <Select value={hour12 ?? ""} onValueChange={(next) => setTime("hour", next)}>
                <SelectTrigger className="date_picker_time_select" aria-label={t("date_picker.hour", "Hour")}>
                  <SelectValue placeholder="--" />
                </SelectTrigger>
                <SelectContent className="form_field_select_content max-h-60">
                  {HOURS.map((hour) => (
                    <SelectItem key={hour} value={hour} className="form_field_select_item">
                      {hour.padStart(2, "0")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-[var(--ink-muted)]">:</span>
              <Select value={minute ?? ""} onValueChange={(next) => setTime("minute", next)}>
                <SelectTrigger className="date_picker_time_select" aria-label={t("date_picker.minute", "Minute")}>
                  <SelectValue placeholder="--" />
                </SelectTrigger>
                <SelectContent className="form_field_select_content max-h-60">
                  {MINUTES.map((m) => (
                    <SelectItem key={m} value={m} className="form_field_select_item">
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="date_picker_period" role="group" aria-label={t("date_picker.am_pm", "AM or PM")}>
                {(["AM", "PM"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={cn(period === p && "is_selected")}
                    onClick={() => setTime("period", p)}
                  >
                    {p === "AM" ? t("date_picker.am", "AM") : t("date_picker.pm", "PM")}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        <div className="date_picker_footer">
          <button
            type="button"
            className="date_picker_link"
            onClick={() => {
              emit(undefined);
              setOpen(false);
            }}
          >
            {t("actions.clear", "Clear")}
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="date_picker_link"
              onClick={() => {
                emit(type === "datetime-local" ? new Date(new Date().setSeconds(0, 0)) : startOfDay(now));
                if (type !== "datetime-local") setOpen(false);
              }}
            >
              {type === "datetime-local" ? t("date_picker.now", "Now") : type === "month" ? t("date_picker.this_month", "This month") : t("date_picker.today", "Today")}
            </button>
            {type === "datetime-local" ? (
              <button type="button" className="btn_primary_black date_picker_done" onClick={() => setOpen(false)}>
                {t("date_picker.done", "Done")}
              </button>
            ) : null}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
