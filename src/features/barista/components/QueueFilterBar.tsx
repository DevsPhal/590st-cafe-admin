"use client";

import { useCallback, useEffect, useId, useState, type ReactNode } from "react";
import { format, isValid, parse } from "date-fns";
import type { DateRange } from "react-day-picker";
import { km as dayPickerKhmer } from "react-day-picker/locale";
import {
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  CalendarDays,
  ChevronDown,
  RotateCcw,
  Search,
  Shapes,
  SlidersHorizontal,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/contexts/I18nContext";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { dateFnsLocale } from "@/lib/dateFormat";
import { enumLabel } from "@/lib/enumLabel";
import { trailingDates } from "@/lib/shopDate";
import { cn } from "@/lib/utils";
import type { PaymentMethod, SortDirection } from "@/store/api/types";
import { EMPTY_FILTERS, hasActiveFilters, type OrderTypeFilter, type QueueFilters } from "../queue";
import { Button } from "@/components/common/Button";

type Translate = ReturnType<typeof useI18n>["t"];

// Radix Select can't use "" as an item value, so "no filter" gets its own.
const ANY = "ANY";
const DAY = "yyyy-MM-dd";
const SEARCH_DELAY_MS = 350;
// Secondary buttons in the bar look like its other controls rather than the heavier outlined buttons.
const CONTROL_BUTTON =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-(--radius-control) border border-(--line) bg-(--surface) px-3 text-sm font-medium whitespace-nowrap text-(--ink) transition-colors hover:bg-(--surface-hover)";

function toDate(value: string): Date | undefined {
  if (!value) return undefined;
  const date = parse(value, DAY, new Date());
  return isValid(date) ? date : undefined;
}

type DatePreset = { key: string; label: string; from: string; to: string };

function datePresets(today: string, t: Translate): DatePreset[] {
  const week = trailingDates(today, 7);
  const month = trailingDates(today, 30);
  return [
    { key: "today", label: t("barista.filters.today", "Today"), from: today, to: today },
    { key: "yesterday", label: t("barista.filters.yesterday", "Yesterday"), from: week[5], to: week[5] },
    { key: "week", label: t("barista.filters.last_7_days", "Last 7 days"), from: week[0], to: today },
    { key: "month", label: t("barista.filters.last_30_days", "Last 30 days"), from: month[0], to: today },
  ];
}

function dateRangeLabel(from: string, to: string, presets: DatePreset[], t: Translate): string {
  const start = toDate(from);
  const end = toDate(to || from);
  if (!start || !end) return t("barista.filters.any_date", "Any date");
  const preset = presets.find((option) => option.from === from && option.to === (to || from));
  if (preset) return preset.label;
  const locale = { locale: dateFnsLocale() };
  if (from === (to || from)) return format(start, "d MMM yyyy", locale);
  return start.getFullYear() === end.getFullYear()
    ? `${format(start, "d MMM", locale)} – ${format(end, "d MMM yyyy", locale)}`
    : `${format(start, "d MMM yyyy", locale)} – ${format(end, "d MMM yyyy", locale)}`;
}

function SearchField({ value, onCommit }: { value: string; onCommit: (value: string) => void }) {
  const { t } = useI18n();
  const id = useId();
  const [draft, setDraft] = useState(value);
  const [committed, setCommitted] = useState(value);
  // Follow changes made elsewhere, such as "Clear filters".
  if (value !== committed) {
    setCommitted(value);
    setDraft(value);
  }

  // Search once typing pauses rather than on every keystroke.
  useEffect(() => {
    if (draft === value) return;
    const timer = setTimeout(() => onCommit(draft), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [draft, value, onCommit]);

  const clear = () => {
    setDraft("");
    onCommit("");
  };

  return (
    <div className="form_field">
      <label htmlFor={id} className="sr-only">
        {t("barista.filters.search_label", "Search orders")}
      </label>
      <div className="form_field_control_wrap">
        <Search className="form_field_search_icon" aria-hidden />
        <input
          id={id}
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") onCommit(draft);
            if (event.key === "Escape" && draft) clear();
          }}
          placeholder={t("barista.filters.search_placeholder", "Invoice # or customer")}
          // 16px text on touch screens: iOS Safari zooms the page into any smaller input that gets focus.
          className="form_field_control form_field_search_input pointer-coarse:text-base! [&::-webkit-search-cancel-button]:appearance-none"
          // Room for the clear button while there is text to clear (the stylesheet's padding would win over a
          // utility class); an empty field keeps that space for its placeholder.
          style={draft ? { paddingRight: 36 } : undefined}
        />
        {draft ? (
          <button
            type="button"
            onClick={clear}
            aria-label={t("barista.filters.clear_search", "Clear search")}
            className="absolute top-1/2 right-2 grid h-6 w-6 -translate-y-1/2 place-items-center pointer-coarse:size-11 rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function DateRangeFilter({
  from,
  to,
  today,
  onChange,
}: {
  from: string;
  to: string;
  today: string;
  onChange: (from: string, to: string) => void;
}) {
  const { t, locale } = useI18n();
  const wide = useMediaQuery("(min-width: 768px)");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange | undefined>();
  const presets = datePresets(today, t);
  const todayDate = toDate(today);

  // The calendar edits a draft, so picking a range takes two clicks without searching in between.
  const handleOpenChange = (next: boolean) => {
    if (next) setDraft(from ? { from: toDate(from), to: toDate(to || from) } : undefined);
    setOpen(next);
  };
  const apply = (nextFrom: string, nextTo: string) => {
    onChange(nextFrom, nextTo);
    setOpen(false);
  };

  return (
    <div className="form_field">
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="form_field_select_trigger"
            data-unset={!from || undefined}
            aria-label={`${t("barista.filters.date_label", "Order date")}: ${dateRangeLabel(from, to, presets, t)}`}
          >
            <span className="flex min-w-0 items-center gap-2">
              <CalendarDays aria-hidden />
              <span className="truncate">{dateRangeLabel(from, to, presets, t)}</span>
            </span>
            <ChevronDown aria-hidden />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          collisionPadding={16}
          // Scrolls instead of running off short screens, such as a phone held sideways.
          className="form_field_select_content max-h-(--radix-popover-content-available-height) max-w-[calc(100vw-2rem)] overflow-y-auto p-0"
        >
          <div className="flex flex-col md:flex-row">
            <div className="flex flex-wrap gap-1.5 border-b border-(--line-subtle) p-3 md:w-40 md:flex-col md:flex-nowrap md:border-r md:border-b-0">
              {presets.map((preset) => {
                const active = from === preset.from && (to || from) === preset.to;
                return (
                  <button
                    key={preset.key}
                    type="button"
                    onClick={() => apply(preset.from, preset.to)}
                    aria-pressed={active}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-left text-sm whitespace-nowrap text-(--ink) transition-colors hover:bg-(--option-hover-bg)",
                      active && "bg-(--option-selected-bg) font-semibold text-(--option-selected-ink)"
                    )}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
            <div>
              <Calendar
                mode="range"
                numberOfMonths={wide ? 2 : 1}
                selected={draft}
                onSelect={setDraft}
                defaultMonth={draft?.from ?? todayDate}
                disabled={todayDate ? { after: todayDate } : undefined}
                locale={locale === "kh" ? dayPickerKhmer : undefined}
              />
              <div className="flex items-center justify-end gap-2 border-t border-(--line-subtle) px-3 py-2.5">
                <Button variant="outline" onClick={() => apply("", "")} disabled={!from}>
                  {t("barista.filters.any_date", "Any date")}
                </Button>
                <Button
                 
                  variant="primary"
                  disabled={!draft?.from}
                  onClick={() => {
                    if (!draft?.from) return;
                    apply(format(draft.from, DAY), format(draft.to ?? draft.from, DAY));
                  }}
                >
                  {t("barista.filters.apply", "Apply")}
                </Button>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function FilterSelect({
  label,
  icon: Icon,
  value,
  onValueChange,
  children,
}: {
  label: string;
  icon: LucideIcon;
  value: string;
  onValueChange: (value: string) => void;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <div className="form_field">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      {/* With no filter chosen ("" value) the trigger shows the filter's name, greyed like a placeholder. */}
      <Select value={value} onValueChange={(next) => onValueChange(next === ANY ? "" : next)}>
        <SelectTrigger id={id} className="form_field_select_trigger">
          <span className="flex min-w-0 items-center gap-2">
            <Icon aria-hidden />
            {/* Radix drops classes set on Select.Value itself, so a wrapper truncates long labels. */}
            <span className="min-w-0 truncate">
              <SelectValue placeholder={label} />
            </span>
          </span>
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
    </div>
  );
}

function SortToggle({ value, onChange }: { value: SortDirection; onChange: (value: SortDirection) => void }) {
  const { t } = useI18n();
  const options = [
    { value: "DESC" as const, label: t("barista.filters.newest", "Newest"), icon: ArrowDownWideNarrow },
    { value: "ASC" as const, label: t("barista.filters.oldest", "Oldest"), icon: ArrowUpNarrowWide },
  ];
  return (
    <div
      role="group"
      aria-label={t("barista.filters.sort", "Sort orders")}
      className="flex h-9 w-full items-center rounded-(--radius-control) border border-(--line) bg-(--surface) p-0.5 md:w-auto"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "inline-flex h-full flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-medium whitespace-nowrap text-(--ink-muted) transition-colors hover:text-(--ink) md:flex-none",
            value === option.value &&
              "bg-(--brand-ink) text-white hover:text-white dark:bg-(--ink-strong) dark:text-(--brand-ink) dark:hover:text-(--brand-ink)"
          )}
        >
          <option.icon className="h-3.5 w-3.5" aria-hidden />
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function QueueFilterBar({
  filters,
  onChange,
  direction,
  onDirectionChange,
  today,
}: {
  filters: QueueFilters;
  onChange: (next: QueueFilters) => void;
  direction: SortDirection;
  onDirectionChange: (next: SortDirection) => void;
  /** The shop's date (yyyy-MM-dd), for the date presets. */
  today: string;
}) {
  const { t } = useI18n();
  const panelId = useId();
  const [panelOpen, setPanelOpen] = useState(false);
  const moreFilters = [filters.from || filters.to, filters.orderType, filters.paymentMethod].filter(Boolean).length;
  const filtering = hasActiveFilters(filters);
  const commitSearch = useCallback((search: string) => onChange({ ...filters, search }), [filters, onChange]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex min-w-0 flex-[1_1_12rem] items-center gap-2">
        <div className="min-w-0 flex-1">
          <SearchField value={filters.search} onCommit={commitSearch} />
        </div>
        <button
          type="button"
          onClick={() => setPanelOpen((open) => !open)}
          aria-expanded={panelOpen}
          aria-controls={panelId}
          className={cn(CONTROL_BUTTON, "shrink-0 md:hidden")}
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden />
          {/* The smallest phones show only the icon, leaving the search room for its placeholder. */}
          <span className="max-[379px]:sr-only">{t("barista.filters.toggle", "Filters")}</span>
          {moreFilters ? (
            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-(--brand-lime) px-1 text-[11px] font-bold text-(--brand-ink)">
              {moreFilters}
            </span>
          ) : null}
        </button>
      </div>

      {/* On phones these fold away behind "Filters"; from tablets up they sit in the same row as the search. */}
      <div id={panelId} className={cn("w-full grid-cols-2 gap-2 md:contents", panelOpen ? "grid" : "hidden")}>
        <div className="col-span-2 md:w-44">
          <DateRangeFilter
            from={filters.from}
            to={filters.to}
            today={today}
            onChange={(from, to) => onChange({ ...filters, from, to })}
          />
        </div>
        {/* Each select gets a full row on the narrowest phones, so its name isn't cut short. */}
        <div className="col-span-2 min-w-0 min-[380px]:col-span-1 md:w-40">
          <FilterSelect
            label={t("barista.filters.order_type", "Order type")}
            icon={Shapes}
            value={filters.orderType}
            onValueChange={(value) => onChange({ ...filters, orderType: value as OrderTypeFilter })}
          >
            <SelectItem value={ANY}>{t("barista.filters.all_types", "All types")}</SelectItem>
            <SelectSeparator />
            <SelectGroup>
              <SelectLabel>{t("barista.filters.ordered_from", "Ordered from")}</SelectLabel>
              <SelectItem value="WALK_IN">{t("barista.labels.walk_in", "Walk-in")}</SelectItem>
              <SelectItem value="ONLINE">{t("barista.card.online", "Online")}</SelectItem>
            </SelectGroup>
            <SelectSeparator />
            <SelectGroup>
              <SelectLabel>{t("barista.filters.served_as", "Served as")}</SelectLabel>
              <SelectItem value="DINE_IN">{t("fulfillment.dine_in", "Dine-in")}</SelectItem>
              <SelectItem value="PICKUP">{t("fulfillment.pickup_or_take_away", "Pickup / Take away")}</SelectItem>
              <SelectItem value="DELIVERY">{t("fulfillment.delivery", "Delivery")}</SelectItem>
            </SelectGroup>
          </FilterSelect>
        </div>
        <div className="col-span-2 min-w-0 min-[380px]:col-span-1 md:w-36">
          <FilterSelect
            label={t("barista.filters.payment", "Payment")}
            icon={Wallet}
            value={filters.paymentMethod}
            onValueChange={(value) => onChange({ ...filters, paymentMethod: value as "" | PaymentMethod })}
          >
            <SelectItem value={ANY}>{t("barista.filters.all_payments", "All payments")}</SelectItem>
            <SelectItem value="CASH">{enumLabel(t, "payment_method", "CASH")}</SelectItem>
            <SelectItem value="BAKONG">{enumLabel(t, "payment_method", "BAKONG")}</SelectItem>
          </FilterSelect>
        </div>
        <div className={cn("md:w-auto", filtering ? "col-span-1" : "col-span-2")}>
          <SortToggle value={direction} onChange={onDirectionChange} />
        </div>
        {filtering ? (
          <button type="button" onClick={() => onChange(EMPTY_FILTERS)} className={cn(CONTROL_BUTTON, "w-full md:w-auto")}>
            <RotateCcw className="h-4 w-4" aria-hidden />
            {t("barista.filters.clear", "Clear filters")}
          </button>
        ) : null}
      </div>
    </div>
  );
}
