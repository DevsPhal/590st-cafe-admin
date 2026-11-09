"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { Children, isValidElement, ReactElement, ReactNode, useId, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { type DateRange } from "react-day-picker";
import {
  Bell,
  CalendarDays,
  Coffee,
  ImageIcon,
  UserRound,
  Check,
  CheckCheck,
  Clock,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  Download,
  Eye,
  Printer,
  Filter,
  Inbox,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Trash2,
  TriangleAlert,
  Upload,
  X,
  type LucideIcon,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useI18n } from "@/contexts/I18nContext";
import { LOCALES, localeInfo } from "@/contexts/locales";
import { dateFnsLocale } from "@/lib/dateFormat";
import { cn, downloadBlob, formatSku, titleCase } from "@/lib/utils";
import { formatPhoneInput, PHONE_MAX_LENGTH, PHONE_PLACEHOLDER } from "@/lib/phone";
import { apiErrorMessage } from "@/store/api/baseApi";

import { OperationalAlertsContent, useOperationalAlerts } from "./OperationalAlerts";
import { ThemeToggle } from "./ThemeToggle";
import { UserAvatar } from "./UserAvatar";
import { MoneyInput, type MoneyInputProps } from "@/components/forms/MoneyInput";
import { DATE_PICKER_TYPES, DatePickerInput, type DatePickerType } from "@/components/forms/DatePickerInput";
import { IMAGE_ACCEPT, imageFileProblem } from "@/lib/imageFile";
import { Button } from "@/components/common/Button";
import { EmptyState } from "@/components/common/EmptyState";

export type FieldOption = {
  label: string;
  value: string;
};

export function LanguageFlag({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "relative inline-block h-5 w-5 overflow-hidden rounded-full border border-black/10",
        className
      )}
    >
      <Image src={src} alt={alt} fill sizes="20px" className="object-cover" />
    </span>
  );
}

export function AdminTopActions() {
  const alerts = useOperationalAlerts();
  const [open, setOpen] = useState(false);
  const { locale, setLocale, t } = useI18n();
  const currentLang = localeInfo(locale);
  const pathname = usePathname();
  const onAlertsPage = pathname === "/notifications";

  return (
    <>
      <div className="header_top_actions">
        <ThemeToggle />
        <button
          type="button"
          onClick={() => {
            alerts.markSeen();
            if (!onAlertsPage) setOpen(true);
          }}
          className="header_action_btn header_notify_btn"
          aria-label={t("alerts.notifications", "Notifications")}
        >
          <Bell className="h-5 w-5" />
          {alerts.unseen !== undefined && alerts.unseen > 0 && <span className="header_notify_badge">{alerts.unseen}</span>}
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="header_action_btn header_lang_btn"
              aria-label={t("language.label", "Language")}
            >
              <LanguageFlag src={currentLang.flag} alt={t(currentLang.flagAltKey, currentLang.flagAlt)} />
              <span className="header_lang_label">{currentLang.label}</span>
              <ChevronDown className="dropdown_chevron h-4 w-4" aria-hidden />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="header_lang_menu min-w-[10rem] rounded-lg border border-black bg-white p-1 shadow-md"
          >
            {LOCALES.map((lang) => {
              const isActive = locale === lang.code;
              return (
                <DropdownMenuItem
                  key={lang.code}
                  role="menuitemradio"
                  aria-checked={isActive}
                  onClick={() => setLocale(lang.code)}
                  className="header_lang_option flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-sm font-medium text-gray-900"
                >
                  <LanguageFlag src={lang.flag} alt={t(lang.flagAltKey, lang.flagAlt)} />
                  <span className="flex-1">{lang.shortLabel}</span>
                  {isActive && <Check aria-hidden strokeWidth={2.5} className="h-4 w-4 text-(--option-selected-ink)" />}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="notify_slider_popup" showCloseButton={false}>
          <div className="notify_header">
            <div>
              <SheetTitle className="notify_header_title">{t("alerts.title", "Current alerts")}</SheetTitle>
              <p className={cn("notify_header_sub", alerts.count ? "is_alert" : undefined)}>{alerts.count === undefined ? t("alerts.checking", "Checking current activity") : t("alerts.need_attention", "{count} items need attention", { count: alerts.count })}</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="notify_icon_btn" aria-label={t("alerts.close", "Close notifications")}>
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="notify_body"><OperationalAlertsContent alerts={alerts} /></div>
        </SheetContent>
      </Sheet>
    </>
  );
}

export function FilterPanel({
  children,
  collapsible = true,
  defaultCollapsed = false,
  title,
}: {
  children?: ReactNode;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  title?: string;
}) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const { t } = useI18n();

  return (
    <section className={cn("box_collapse", isCollapsed && "is_collapsed")}>
      <div className="filter_header">
        <button
          type="button"
          className="filter_icon_wrapper"
          onClick={() => collapsible && setIsCollapsed(!isCollapsed)}
          aria-label={t("filters.toggle", "Toggle filter panel")}
        >
          <SlidersHorizontal className="filter_icon" />
        </button>
        <h2 className="filter_title">{title ?? t("filters.title", "Filters")}</h2>
      </div>
      {!isCollapsed && children && (
        // A form so Enter in any filter field runs Search (its button is the submit button).
        <form
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            event.currentTarget.querySelector<HTMLButtonElement>('button[type="submit"]')?.click();
          }}
          className={cn("grid grid-cols-1 gap-4 px-5 py-4 md:grid-cols-2 xl:grid-cols-4 filter_content_wrapper", collapsible && "has_top_border")}
        >
          {children}
        </form>
      )}
    </section>
  );
}

// The date picker hands back a plain string; wrap it so callers can keep reading e.target.value.
function pickerChangeEvent(value: string) {
  return { target: { value }, currentTarget: { value } } as React.ChangeEvent<HTMLInputElement>;
}

/** The message under a field that failed validation; the control points at it with aria-describedby. */
export function FieldError({ id, error }: { id: string; error?: string }) {
  return error ? (
    <span id={id} role="alert" className="form_field_error">
      {error}
    </span>
  ) : null;
}

/** aria props that mark a control invalid and link it to its FieldError. */
function invalidProps(errorId: string, error?: string) {
  return error ? { "aria-invalid": true as const, "aria-describedby": errorId } : {};
}

export function TextField({
  label,
  placeholder,
  value,
  onChange,
  type = "text",
  error,
}: {
  label: string;
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  error?: string;
}) {
  const { t } = useI18n();
  const errorId = useId();
  return (
    <label className="form_field">
      <span className="form_field_label">{label}</span>
      {DATE_PICKER_TYPES.has(type) ? (
        <DatePickerInput
          type={type as DatePickerType}
          value={value}
          onChange={(next) => onChange?.(pickerChangeEvent(next))}
          aria-label={label}
          {...invalidProps(errorId, error)}
        />
      ) : (
        <input
          type={type}
          value={value || ""}
          onChange={onChange}
          className="form_field_control"
          placeholder={placeholder ?? t("form.placeholder", "Placeholder")}
          {...invalidProps(errorId, error)}
        />
      )}
      <FieldError id={errorId} error={error} />
    </label>
  );
}

type SelectOptionProps = { value?: string | number; children?: ReactNode; disabled?: boolean };

const UNSET = "__unset__";

function optionsFromChildren(children: ReactNode): { value: string; label: ReactNode; disabled?: boolean }[] {
  return Children.toArray(children)
    .filter((child): child is ReactElement<SelectOptionProps> => isValidElement(child) && child.type === "option")
    .map((child) => {
      const raw = child.props.value;
      const text = typeof child.props.children === "string" ? child.props.children : "";
      const value = raw === "" ? UNSET : raw != null ? String(raw) : text || UNSET;
      return { value, label: child.props.children, disabled: child.props.disabled };
    });
}

function withUnsetOption(options: { value: string; label: ReactNode; disabled?: boolean }[], placeholder: string) {
  return options.some((option) => option.value === UNSET)
    ? options
    : [{ value: UNSET, label: placeholder }, ...options];
}

export function SelectField({
  label,
  placeholder: placeholderProp,
  value,
  onChange,
  children,
  error,
}: {
  label: string;
  placeholder?: string;
  value?: string | number;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  children?: React.ReactNode;
  error?: string;
}) {
  const { t } = useI18n();
  const placeholder = placeholderProp ?? t("form.select_method", "Select Method");
  const id = useId();
  const errorId = useId();
  const rawOptions = children
    ? optionsFromChildren(children)
    : optionsFromChildren(
        <>
          <option>Paid</option>
          <option>Pending</option>
          <option>Enabled</option>
        </>
      );
  const options = withUnsetOption(rawOptions, placeholder);
  const selected = value ? String(value) : UNSET;
  return (
    <div className="form_field">
      <label htmlFor={id} className="form_field_label">
        {label}
      </label>
      <Select
        value={selected}
        onValueChange={(next) =>
          onChange?.({ target: { value: next === UNSET ? "" : next } } as React.ChangeEvent<HTMLSelectElement>)
        }
      >
        <SelectTrigger
          id={id}
          className="form_field_select_trigger"
          data-unset={selected === UNSET || undefined}
          {...invalidProps(errorId, error)}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className="form_field_select_content">
          {options.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              disabled={option.disabled}
              className="form_field_select_item"
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FieldError id={errorId} error={error} />
    </div>
  );
}

export function DateField({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder?: string;
  value?: DateRange;
  onChange?: (range: DateRange | undefined) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [internalRange, setInternalRange] = useState<DateRange | undefined>();
  const range = value ?? internalRange;

  const handleSelect = (next: DateRange | undefined) => {
    if (onChange) {
      onChange(next);
    } else {
      setInternalRange(next);
    }
  };

  const displayValue = range?.from
    ? range.to
      ? `${format(range.from, "dd MMM yyyy", { locale: dateFnsLocale() })} - ${format(range.to, "dd MMM yyyy", { locale: dateFnsLocale() })}`
      : format(range.from, "dd MMM yyyy", { locale: dateFnsLocale() })
    : placeholder ?? t("form.date_range", "Start Date - End Date");

  return (
    <div className="form_field">
      <span className="form_field_label">{label}</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "form_field_control form_field_date text-left",
              !range?.from && "is_placeholder"
            )}
            aria-label={label}
          >
            <span className="truncate">{displayValue}</span>
            <CalendarDays className="form_field_icon" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            numberOfMonths={2}
            selected={range}
            onSelect={handleSelect}
            defaultMonth={range?.from}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function FormDateField({
  label,
  placeholder,
  value,
  onChange,
  required = false,
}: {
  label: string;
  placeholder?: string;
  value?: Date;
  onChange?: (date: Date | undefined) => void;
  required?: boolean;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [internalDate, setInternalDate] = useState<Date | undefined>();
  const date = value ?? internalDate;

  const handleSelect = (next: Date | undefined) => {
    if (onChange) {
      onChange(next);
    } else {
      setInternalDate(next);
    }
    if (next) {
      setOpen(false);
    }
  };

  const displayValue = date
    ? format(date, "dd MMM yyyy", { locale: dateFnsLocale() })
    : placeholder ?? t("form.select_date", "Select date");

  return (
    <div className="form_field">
      <span className="form_field_label">
        {label}
        {required && <span className="form_field_required"> *</span>}
      </span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "form_field_control form_field_date text-left",
              !date && "is_placeholder"
            )}
            aria-label={label}
          >
            <span className="truncate">{displayValue}</span>
            <CalendarDays className="form_field_icon" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={handleSelect}
            defaultMonth={date}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

// Filters apply as you type; Search refreshes the list and brings the results into view,
// which matters on phones where the table sits below the filter panel.
function revealResults(from: HTMLElement) {
  const results = from.closest(".box_collapse")?.nextElementSibling;
  if (!(results instanceof HTMLElement)) return;
  const top = results.getBoundingClientRect().top;
  if (top > window.innerHeight * 0.5 || top < 0) {
    results.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

export function FilterActions({ onClear, onSearch }: { onClear: () => void; onSearch: () => void }) {
  const { t } = useI18n();
  return (
    <div className="flex items-end justify-end gap-3 xl:col-span-4">
      <Button onClick={onClear} variant="outline">
        {t("actions.clear", "Clear")}
      </Button>
      <Button
        type="submit"
        onClick={(event) => {
          event.preventDefault();
          onSearch();
          const button = event.currentTarget;
          window.requestAnimationFrame(() => revealResults(button));
        }}
        variant="primary"
      >
        {t("actions.search", "Search")}
        <Search />
      </Button>
    </div>
  );
}

export function TableActions({
  onRegister,
  onExport,
  primaryLabel,
  showRegister = true,
}: {
  onRegister?: () => void;
  onExport?: () => void;
  primaryLabel?: string;
  showRegister?: boolean;
}) {
  const { t } = useI18n();
  return (
    <div className="flex flex-wrap items-center gap-3">
      {onExport && <Button onClick={onExport} variant="outline">
        {t("actions.download_excel", "Download Excel")}
        <Download />
      </Button>}
      {showRegister && onRegister && (
        <Button onClick={onRegister} variant="primary">
          {primaryLabel ?? t("actions.register", "Register")}
          <Plus />
        </Button>
      )}
    </div>
  );
}

export interface ExcelImportResult {
  totalRows: number;
  created: number;
  failed: number;
  errors: { rowNumber: number; sku?: string; message: string }[];
}

export function ExcelImportButton({
  label,
  columnsHint,
  onImport,
  template,
}: {
  label?: string;
  columnsHint: string;
  onImport: (file: File) => Promise<ExcelImportResult>;
  /** Adds a "Download Sample" button that saves the server's import template. */
  template?: { filename: string; download: () => Promise<Blob> };
}) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [result, setResult] = useState<ExcelImportResult | null>(null);

  const handleDownloadTemplate = async () => {
    if (!template) return;
    setIsDownloading(true);
    try {
      downloadBlob(await template.download(), template.filename);
    } catch (error) {
      toast.error(apiErrorMessage(error as never, t("excel.sample_failed", "Could not download the sample file.")));
    } finally {
      setIsDownloading(false);
    }
  };

  const handleFile = async (file: File) => {
    setIsBusy(true);
    try {
      const response = await onImport(file);
      setResult(response);
      if (response.failed === 0) {
        toast.success(t("excel.imported", "Imported {created} of {total} row(s).", { created: response.created, total: response.totalRows }));
      } else {
        toast.error(t("excel.partly_failed", "{created} imported, {failed} failed — see details.", { created: response.created, failed: response.failed }));
      }
    } catch (error) {
      toast.error(apiErrorMessage(error as never, t("excel.import_failed", "Could not import the file.")));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <>
      {template && (
        <Button
         
          onClick={handleDownloadTemplate}
          disabled={isDownloading}
          variant="outline"
          title={t("excel.sample_title", "Excel sample with the expected columns: {columns}", { columns: columnsHint })}
        >
          {isDownloading ? t("states.downloading", "Downloading...") : t("excel.download_sample", "Download Sample")}
          <Download />
        </Button>
      )}
      <Button
       
        onClick={() => inputRef.current?.click()}
        disabled={isBusy}
        variant="outline"
      >
        {isBusy ? t("states.importing", "Importing...") : label ?? t("actions.import_excel", "Import Excel")}
        <Upload />
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void handleFile(file);
        }}
      />

      <Dialog open={result !== null} onOpenChange={(open) => { if (!open) setResult(null); }}>
        <DialogContent className="admin_modal sm:max-w-[560px]">
          <DialogHeader className="admin_modal_header">
            <DialogTitle className="admin_modal_title">{t("excel.results_title", "Import results")}</DialogTitle>
          </DialogHeader>
          <div className="admin_modal_body space-y-3">
            {result && (
              <>
                <p className="text-sm">
                  {result.failed > 0
                    ? t("excel.summary_failed", "{created} of {total} row(s) imported, {failed} failed.", { created: result.created, total: result.totalRows, failed: result.failed })
                    : t("excel.summary", "{created} of {total} row(s) imported.", { created: result.created, total: result.totalRows })}
                </p>
                {result.errors.length > 0 && (
                  <div className="max-h-64 space-y-2 overflow-y-auto">
                    {result.errors.map((issue, index) => (
                      <div key={index} className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-800">
                        {t("excel.row", "Row {row}", { row: issue.rowNumber })}{issue.sku ? ` (${issue.sku})` : ""}: {issue.message}
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">{t("excel.columns", "Columns: {columns}", { columns: columnsHint })}</p>
              </>
            )}
          </div>
          <DialogFooter className="admin_modal_footer">
            <Button onClick={() => setResult(null)} variant="accent">
              {t("actions.close", "Close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function DataCard({
  title,
  meta,
  actions,
  children,
}: {
  title: string;
  meta?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="chart_card_wrapper">
      <div className="section_subheader_group">
        <div className="subheader_text">
          <h2 className="subheader_title">{title}</h2>
          {meta && <p className="subheader_meta">{meta}</p>}
        </div>
        {actions ? <div className="subheader_actions">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function SimpleTable({
  headers,
  children,
}: {
  headers: string[];
  children: ReactNode;
}) {
  const { t } = useI18n();
  // Keep row actions reachable when the table scrolls sideways on phones and tablets.
  const lastHeader = headers[headers.length - 1]?.toLowerCase();
  const actionHeaders = ["action", "actions", t("table.action", "Action").toLowerCase(), t("table.actions", "Actions").toLowerCase()];
  const stickyAction = lastHeader !== undefined && actionHeaders.includes(lastHeader);
  return (
    <div className="data_table_wrap">
      <table className={cn("data_table", stickyAction && "has_sticky_action")}>
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Row({ children, striped = false }: { children: ReactNode; striped?: boolean }) {
  return (
    <tr className={cn(striped && "is_striped")}>{children}</tr>
  );
}

export function Cell({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={className}>{children}</td>;
}

export function CheckBox({
  checked = false,
  onChange,
}: {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
}) {
  const [isChecked, setIsChecked] = useState(checked);

  return (
    <button
      type="button"
      onClick={() => {
        const next = !isChecked;
        setIsChecked(next);
        onChange?.(next);
      }}
      className={cn("custom_checkbox", (checked || isChecked) && "is_checked")}
      role="checkbox"
      aria-checked={checked || isChecked}
    >
      {(checked || isChecked) && <CheckCheck className="checkbox_icon" />}
    </button>
  );
}

/** What an image shows, so a missing one gets a fitting placeholder icon. */
export type ImageKind = "product" | "person" | "picture";

const PLACEHOLDER_ICONS = { product: Coffee, person: UserRound, picture: ImageIcon } as const;

export function Thumbnail({ src, kind }: { src?: string | null; kind: ImageKind }) {
  const Placeholder = PLACEHOLDER_ICONS[kind];
  // A broken image link falls back to the placeholder instead of an empty box.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const image = src && src !== failedSrc ? src : null;
  return (
    <span
      className={cn(
        "relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg",
        image ? "bg-gray-100" : "bg-(--placeholder-bg) text-(--placeholder-ink)"
      )}
    >
      {image ? (
        <Image src={image} alt="" fill sizes="40px" className="object-cover" onError={() => setFailedSrc(image)} />
      ) : (
        <Placeholder className="h-5 w-5" strokeWidth={1.75} aria-hidden />
      )}
    </span>
  );
}

export function StatusBadge({
  label,
  tone = "success",
  variant,
}: {
  label: string;
  tone?: "success" | "danger" | "warning" | "info" | "neutral";
  variant?: "success" | "destructive" | "warning" | "info" | "default" | "secondary";
}) {
  const resolvedTone =
    variant === "success"
      ? "success"
      : variant === "destructive"
      ? "danger"
      : variant === "warning"
      ? "warning"
      : variant === "info"
      ? "info"
      : variant === "secondary" || variant === "default"
      ? "neutral"
      : tone;
  const styles = {
    success: "bg-green-100 text-green-800",
    danger: "bg-red-100 text-red-700",
    warning: "bg-yellow-100 text-yellow-700",
    info: "bg-blue-100 text-blue-700",
    neutral: "bg-gray-100 text-gray-700",
  };

  return (
    <span
      className={cn(
        "inline-flex whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold",
        styles[resolvedTone]
      )}
    >
      {label}
    </span>
  );
}

export function LockedYnCell({
  locked = false,
}: {
  locked?: boolean;
}) {
  const { t } = useI18n();
  return (
    <div className="locked_yn" role="group" aria-label={t("locked.label", "Locked YN")}>
      <span className={cn("locked_yn_opt", !locked && "is_on")}>{t("locked.enabled", "Enabled")}</span>
      <span className={cn("locked_yn_opt", locked && "is_off")}>{t("locked.disabled", "Disabled")}</span>
    </div>
  );
}

export function StaffIdentityCell({
  name,
  email,
  avatarUrl,
}: {
  name: string;
  email: string;
  avatarUrl?: string | null;
}) {
  return (
    <div className="staff_identity">
      <UserAvatar src={avatarUrl} name={name} sizes="28px" className="staff_identity_avatar" />
      <div className="staff_identity_text">
        <p className="staff_identity_name">{titleCase(name)}</p>
        <p className="staff_identity_email">{email}</p>
      </div>
    </div>
  );
}

export function RowActions({
  onView,
  onEdit,
  onDelete,
  onHistory,
  onPrint,
  deleteLabel,
  isLoading = false,
}: {
  onView?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onHistory?: () => void;
  onPrint?: () => void;
  deleteLabel?: string;
  isLoading?: boolean;
}) {
  const { t } = useI18n();
  const actions = [
    [Eye, onView, t("actions.view", "View")],
    [Printer, onPrint, t("actions.print_invoice", "Print invoice")],
    [Pencil, onEdit, t("actions.edit", "Edit")],
    [Clock, onHistory, t("actions.history", "History")],
    [Trash2, onDelete, deleteLabel ?? t("actions.delete", "Delete")],
  ] as const;

  return (
    <div className="flex flex-nowrap items-center gap-2">
      {actions
        .filter(([, onClick]) => Boolean(onClick))
        .map(([Icon, onClick, label]) => (
          <button
            key={label}
            type="button"
            onClick={onClick}
            disabled={isLoading}
            className="grid h-7 w-7 place-items-center rounded-full pointer-coarse:size-11 bg-(--brand-ink) text-(--brand-lime) transition hover:bg-(--brand-ink-hover) disabled:opacity-50"
            aria-label={label}
            title={label}
          >
            <Icon className="h-4 w-4" />
          </button>
        ))}
    </div>
  );
}

const PAGE_SIZE_CHOICES = [5, 10, 20, 50];

function pageWindow(current: number, total: number, span = 3): number[] {
  const start = Math.max(1, Math.min(current - Math.floor(span / 2), total - span + 1));
  const count = Math.min(span, total);
  return Array.from({ length: Math.max(count, 0) }, (_, i) => start + i);
}

export function PaginationFooter({
  page = 1,
  totalPages = 1,
  size = 10,
  totalElements,
  onPageChange,
  onSizeChange,
  sizeOptions = PAGE_SIZE_CHOICES,
}: {
  page?: number;
  totalPages?: number;
  size?: number;
  totalElements?: number;
  onPageChange?: (page: number) => void;
  onSizeChange?: (size: number) => void;
  sizeOptions?: readonly number[];
} = {}) {
  const { t } = useI18n();
  const pages = pageWindow(page, Math.max(totalPages, 1));
  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <div className="table_pagination">
      <div className="pagination_per_page">
        {t("pagination.per_page", "Show Per Page:")}
        <Select
          value={String(size)}
          onValueChange={(next) => onSizeChange?.(Number(next))}
          disabled={!onSizeChange}
        >
          <SelectTrigger className="form_field_select_trigger is_compact">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="form_field_select_content">
            {sizeOptions.map((choice) => (
              <SelectItem key={choice} value={String(choice)} className="form_field_select_item">
                {choice}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {typeof totalElements === "number" ? (
          <span className="ml-3 text-muted-foreground">{t("pagination.total", "{count} total", { count: totalElements })}</span>
        ) : null}
      </div>
      <div className="pagination_controls">
        <button
          type="button"
          className="pagination_btn is_icon"
          aria-label={t("pagination.first_page", "First page")}
          disabled={!canPrev}
          onClick={() => onPageChange?.(1)}
        >
          <ChevronsLeft />
        </button>
        <button
          type="button"
          className="pagination_btn"
          disabled={!canPrev}
          onClick={() => onPageChange?.(page - 1)}
        >
          {t("actions.prev", "Prev")}
        </button>
        {pages.map((pageNumber) => (
          <button
            key={pageNumber}
            type="button"
            className={cn("pagination_btn", pageNumber === page && "is_active")}
            onClick={() => onPageChange?.(pageNumber)}
          >
            {pageNumber}
          </button>
        ))}
        {pages[pages.length - 1] < totalPages ? (
          <span className="pagination_ellipsis">...</span>
        ) : null}
        <button
          type="button"
          className="pagination_btn"
          disabled={!canNext}
          onClick={() => onPageChange?.(page + 1)}
        >
          {t("actions.next", "Next")}
        </button>
        <button
          type="button"
          className="pagination_btn is_icon"
          aria-label={t("pagination.last_page", "Last page")}
          disabled={!canNext}
          onClick={() => onPageChange?.(totalPages)}
        >
          <ChevronsRight />
        </button>
      </div>
    </div>
  );
}

export function SkeletonBlock({ className }: { className?: string }) {
  return <span aria-hidden className={cn("block animate-pulse rounded-md bg-gray-200", className)} />;
}

export function CardSkeleton({ lines = 3, className }: { lines?: number; className?: string }) {
  const { t } = useI18n();
  const widths = ["w-2/3", "w-full", "w-1/2", "w-5/6", "w-3/4"];
  return (
    <div className={cn("space-y-3 p-2 pb-4", className)} role="status" aria-label={t("states.loading_label", "Loading")}>
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonBlock key={i} className={cn("h-4", widths[i % widths.length])} />
      ))}
    </div>
  );
}

export function ErrorState({
  error,
  fallback,
  onRetry,
  isRetrying,
}: {
  error?: unknown;
  fallback?: string;
  onRetry?: () => void;
  isRetrying?: boolean;
}) {
  const { t } = useI18n();
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-xl border border-red-100 bg-red-50/60 px-4 py-8 text-center"
    >
      <TriangleAlert className="h-6 w-6 text-red-500" />
      <p className="text-sm text-red-600">{apiErrorMessage(error as never, fallback ?? t("errors.load_failed", "Could not load this data."))}</p>
      {onRetry ? (
        <Button variant="outline" onClick={onRetry} disabled={isRetrying}>
          {isRetrying ? <Loader2 className="animate-spin" /> : <RotateCcw />}
          {isRetrying ? t("states.retrying", "Retrying...") : t("actions.try_again", "Try again")}
        </Button>
      ) : null}
    </div>
  );
}

export function listLoadState(query: { isFetching: boolean; currentData?: unknown; error?: unknown }) {
  const hasData = query.currentData !== undefined;
  return {
    isLoading: query.isFetching && !hasData,
    error: hasData ? undefined : query.error,
    showRows: hasData,
  };
}

export function TableState({
  colSpan,
  isLoading,
  error,
  isEmpty,
  emptyLabel,
  onRetry,
  skeletonRows = 5,
}: {
  colSpan: number;
  isLoading?: boolean;
  error?: unknown;
  isEmpty?: boolean;
  emptyLabel?: string;
  onRetry?: () => void;
  skeletonRows?: number;
}) {
  const { t } = useI18n();
  if (!isLoading && !error && !isEmpty) return null;

  if (isLoading) {
    return (
      <>
        {Array.from({ length: skeletonRows }).map((_, row) => (
          <tr key={row} aria-hidden={row > 0} role={row === 0 ? "status" : undefined}>
            {Array.from({ length: colSpan }).map((_, col) => (
              <td key={col} className="px-4 py-4">
                <SkeletonBlock className={cn("h-4", col === 0 ? "w-8" : (row + col) % 2 ? "w-3/4" : "w-1/2")} />
              </td>
            ))}
          </tr>
        ))}
      </>
    );
  }

  return (
    <tr>
      <td colSpan={colSpan} className={error ? "py-10 text-center text-sm text-muted-foreground" : "p-0"}>
        {error ? (
          <span role="alert" className="inline-flex flex-col items-center gap-2">
            <span className="text-destructive">{apiErrorMessage(error as never)}</span>
            {onRetry ? (
              <Button variant="outline" onClick={onRetry}>
                {t("actions.retry", "Retry")}
              </Button>
            ) : null}
          </span>
        ) : (
          <EmptyState compact icon={Inbox} title={emptyLabel ?? t("table.no_records", "No records found.")} />
        )}
      </td>
    </tr>
  );
}

export function StatTile({
  title,
  value,
  hint,
  tone = "gray",
  icon: Icon,
}: {
  title: string;
  value: string;
  hint?: string;
  tone?: "green" | "yellow" | "orange" | "red" | "gray";
  icon?: LucideIcon;
}) {
  return (
    <div className={cn("metric_card", tone !== "gray" && `is_${tone}`)}>
      <div className="metric_card_content">
        <div className="metric_head">
          <p className="metric_title">{title}</p>
          {Icon ? (
            <span aria-hidden className="metric_icon">
              <Icon />
            </span>
          ) : null}
        </div>
        <p className="metric_value">{value}</p>
        {hint && <p className="metric_hint">{hint}</p>}
      </div>
    </div>
  );
}

export function AdminStatusAlert({
  open,
  onOpenChange,
  variant = "success",
  title,
  headline,
  description,
  confirmLabel: confirmLabelProp,
  cancelLabel: cancelLabelProp,
  onConfirm,
  isLoading = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variant?: "success" | "confirm";
  title: string;
  headline?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => Promise<void> | void;
  isLoading?: boolean;
}) {
  const { t } = useI18n();
  const confirmLabel = confirmLabelProp ?? t("actions.okay", "Okay");
  const cancelLabel = cancelLabelProp ?? t("actions.cancel", "Cancel");
  const handleConfirm = async () => {
    if (onConfirm) {
      await onConfirm();
    } else {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="admin_status_alert sm:max-w-[440px]">
        <div className="admin_status_alert_body">
          <div
            className={cn(
              "admin_status_alert_icon",
              variant === "success" ? "is_success" : "is_confirm"
            )}
          >
            {variant === "success" ? (
              <Check className="admin_status_alert_icon_glyph" />
            ) : (
              <TriangleAlert className="admin_status_alert_icon_glyph" />
            )}
          </div>
          <p
            className={cn(
              "admin_status_alert_title",
              variant === "success" && "is_success"
            )}
          >
            {title}
          </p>
          {headline && <p className="admin_status_alert_headline">{headline}</p>}
          {description && (
            <p className="admin_status_alert_desc">{description}</p>
          )}
        </div>
        <DialogFooter className="admin_status_alert_footer">
          {variant === "confirm" ? (
            <>
              <Button
               
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                {cancelLabel}
              </Button>
              <Button
               
                variant="primary" className="admin_status_alert_confirm_btn"
                onClick={handleConfirm}
                disabled={isLoading}
              >
                {isLoading ? t("states.processing", "Processing...") : confirmLabel}
              </Button>
            </>
          ) : (
            <Button
              variant="accent" size="lg" className="admin_status_alert_okay_btn"
              onClick={() => onOpenChange(false)}
            >
              {confirmLabel}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function FormModal({
  open,
  onOpenChange,
  title,
  children,
  submitLabel,
  onSubmit,
  isLoading = false,
  submitDisabled = false,
  size = "default",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  submitLabel?: string;
  onSubmit?: () => Promise<void> | void;
  isLoading?: boolean;
  submitDisabled?: boolean;
  /** "compact" suits short forms of two or three fields. */
  size?: "default" | "compact";
}) {
  const { t } = useI18n();
  const handleSubmit = async () => {
    if (onSubmit) {
      await onSubmit();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("admin_modal sm:max-w-[900px]", size === "compact" && "is_compact_form")}>
        <DialogHeader className="admin_modal_header">
          <DialogTitle className="admin_modal_title">{title}</DialogTitle>
        </DialogHeader>
        <div className="admin_modal_body">{children}</div>
        <DialogFooter className="admin_modal_footer">
          <Button
           
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
            variant="outline"
          >
            {t("actions.cancel", "Cancel")}
          </Button>
          <Button
           
            onClick={handleSubmit}
            disabled={isLoading || submitDisabled}
            variant="accent"
          >
            {isLoading ? t("states.processing", "Processing...") : submitLabel ?? t("actions.submit", "Submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DetailModal({
  open,
  onOpenChange,
  title,
  children,
  onEdit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  onEdit?: () => void;
}) {
  const { t } = useI18n();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="admin_modal sm:max-w-[900px]">
        <DialogHeader className="admin_modal_header">
          <DialogTitle className="admin_modal_title">{title}</DialogTitle>
        </DialogHeader>
        <div className="admin_modal_body">{children}</div>
        {onEdit && (
          <DialogFooter className="admin_modal_footer">
            <Button onClick={onEdit} variant="accent">
              {t("actions.edit", "Edit")}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  tone = "default",
  onConfirm,
  onCancel,
  isLoading = false,
}: {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}) {
  const { t } = useI18n();
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && !isLoading) onCancel(); }}>
      <DialogContent className="admin_modal is_confirm_modal sm:max-w-[420px]" showCloseButton={false}>
        <div className="confirm_modal_body">
          {tone === "danger" && (
            <span className="confirm_modal_icon is_danger" aria-hidden>
              <TriangleAlert />
            </span>
          )}
          <DialogHeader className="confirm_modal_header">
            <DialogTitle className="confirm_modal_title">{title}</DialogTitle>
          </DialogHeader>
          {description && <p className="confirm_modal_description">{description}</p>}
        </div>
        <DialogFooter className="confirm_modal_footer">
          <Button onClick={onCancel} disabled={isLoading} variant="outline">
            {cancelLabel ?? t("actions.cancel", "Cancel")}
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isLoading}
            variant={tone === "danger" ? "danger" : "accent"}
          >
            {isLoading ? t("states.working", "Working...") : confirmLabel ?? t("actions.confirm", "Confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ModalGrid({ children }: { children: ReactNode }) {
  return <div className="admin_modal_form_wrap is_form_grid">{children}</div>;
}

export function DetailGrid({ children }: { children: ReactNode }) {
  return <div className="admin_modal_detail_wrap">{children}</div>;
}

export function DetailItem({
  label,
  children,
  wide = false,
}: {
  label: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={cn("detail_item", wide && "is_wide")}>
      <p className="detail_item_label">{label} :</p>
      <div className="detail_item_value">{children}</div>
    </div>
  );
}

export function DetailImage({
  src,
  alt = "",
  kind = "picture",
}: {
  src?: string;
  alt?: string;
  kind?: ImageKind;
}) {
  const { t } = useI18n();
  const Placeholder = PLACEHOLDER_ICONS[kind];
  return (
    <div className={cn("detail_image", !src && "is_empty")}>
      {src ? (
        <Image src={src} alt={alt} fill sizes="220px" className="object-cover" />
      ) : (
        <Placeholder className="detail_image_placeholder" strokeWidth={1.5} aria-label={t("image.none", "No image yet")} />
      )}
    </div>
  );
}

export function FormInput({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required = false,
  active = false,
  readOnly = false,
  disabled = false,
  maxLength,
  min,
  max,
  step,
  inputMode,
  autoComplete,
  error,
}: {
  label: string;
  value?: string | number;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  active?: boolean;
  readOnly?: boolean;
  disabled?: boolean;
  maxLength?: number;
  min?: string | number;
  max?: string | number;
  step?: string | number;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  autoComplete?: string;
  error?: string;
}) {
  const errorId = useId();
  return (
    <label className="form_field">
      <span className={cn("form_field_label", active && "text-green-600")}>
        {label}
        {required && <span className="form_field_required"> *</span>}
      </span>
      {DATE_PICKER_TYPES.has(type) ? (
        <DatePickerInput
          type={type as DatePickerType}
          value={value}
          onChange={(next) => onChange?.(pickerChangeEvent(next))}
          min={min}
          max={max}
          placeholder={placeholder}
          readOnly={readOnly}
          disabled={disabled}
          aria-label={label}
          className={cn(active && "is_active")}
          {...invalidProps(errorId, error)}
        />
      ) : (
        <input
          type={type}
          value={value ?? ""}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          readOnly={readOnly}
          disabled={disabled}
          maxLength={maxLength}
          min={min}
          max={max}
          step={step}
          inputMode={inputMode}
          autoComplete={autoComplete}
          className={cn(
            "form_field_control",
            active && "is_active",
            readOnly && "is_readonly",
            disabled && "is_disabled"
          )}
          {...invalidProps(errorId, error)}
        />
      )}
      <FieldError id={errorId} error={error} />
    </label>
  );
}

export function MoneyField({
  label,
  required = false,
  readOnly = false,
  disabled = false,
  error,
  ...props
}: { label: string; error?: string } & MoneyInputProps) {
  const errorId = useId();
  return (
    <label className="form_field">
      <span className="form_field_label">
        {label}
        {required && <span className="form_field_required"> *</span>}
      </span>
      <MoneyInput
        {...props}
        required={required}
        readOnly={readOnly}
        disabled={disabled}
        className={cn("form_field_control", readOnly && "is_readonly", disabled && "is_disabled")}
        {...invalidProps(errorId, error)}
      />
      <FieldError id={errorId} error={error} />
    </label>
  );
}

export function FormPhoneInput({
  label,
  value,
  onChange,
  required = false,
  readOnly = false,
  disabled = false,
  error,
}: {
  label?: string;
  value?: string | null;
  onChange?: (value: string) => void;
  required?: boolean;
  readOnly?: boolean;
  disabled?: boolean;
  error?: string;
}) {
  const { t } = useI18n();
  return (
    <FormInput
      label={label ?? t("fields.phone_number", "Phone Number")}
      type="tel"
      inputMode="numeric"
      autoComplete="tel-national"
      value={value ?? ""}
      onChange={onChange ? (e) => onChange(formatPhoneInput(e.target.value)) : undefined}
      placeholder={PHONE_PLACEHOLDER}
      maxLength={PHONE_MAX_LENGTH}
      required={required}
      readOnly={readOnly}
      disabled={disabled}
      error={error}
    />
  );
}

export function FormSelect({
  label,
  value,
  onChange,
  children,
  required = false,
  placeholder: placeholderProp,
  disabled = false,
  error,
}: {
  label: string;
  value?: string | number;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  children?: React.ReactNode;
  required?: boolean;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
}) {
  const { t } = useI18n();
  const placeholder = placeholderProp ?? t("form.select_method", "Select Method");
  const id = useId();
  const errorId = useId();
  const options = withUnsetOption(optionsFromChildren(children), placeholder);
  const selected = value ? String(value) : UNSET;
  return (
    <div className="form_field">
      <label htmlFor={id} className="form_field_label">
        {label}
        {required && <span className="form_field_required"> *</span>}
      </label>
      <Select
        value={selected}
        onValueChange={(next) =>
          onChange?.({ target: { value: next === UNSET ? "" : next } } as React.ChangeEvent<HTMLSelectElement>)
        }
        disabled={disabled}
      >
        <SelectTrigger
          id={id}
          className={cn("form_field_select_trigger", disabled && "is_disabled")}
          data-unset={selected === UNSET || undefined}
          {...invalidProps(errorId, error)}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className="form_field_select_content">
          {options.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              disabled={option.disabled}
              className="form_field_select_item"
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FieldError id={errorId} error={error} />
    </div>
  );
}

export type ProductSelectOption = {
  id: string;
  name: string;
  sku: string;
  currentStock: number;
  unit: string;
};

export function FormProductSelect({
  label,
  required = false,
  options,
  value,
  onChange,
  searchPlaceholder,
  error,
}: {
  label: string;
  required?: boolean;
  options: ProductSelectOption[];
  value?: ProductSelectOption | null;
  onChange?: (product: ProductSelectOption | null) => void;
  searchPlaceholder?: string;
  error?: string;
}) {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const listId = useId();
  const errorId = useId();

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return options;
    return options.filter(
      (product) =>
        product.name.toLowerCase().includes(query) ||
        product.sku.toLowerCase().includes(query)
    );
  }, [options, search]);

  const close = () => {
    setOpen(false);
    setSearch("");
  };

  const handleSelect = (product: ProductSelectOption) => {
    onChange?.(product);
    close();
  };

  const inputValue = open ? search : value ? titleCase(value.name) : "";

  // The list renders inline (no portal) so it scrolls inside modals, whose scroll lock blocks portalled popups.
  return (
    <div
      className="form_field form_field_product_select"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) close();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          e.stopPropagation();
          close();
        }
      }}
    >
      <span className="form_field_label">
        {label}
        {required && <span className="form_field_required"> *</span>}
      </span>
      <div className="form_field_control_wrap">
        <Search className="form_field_search_icon" />
        <input
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          {...invalidProps(errorId, error)}
          value={inputValue}
          onChange={(e) => {
            setSearch(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          placeholder={searchPlaceholder ?? t("product_select.search", "Search by product name or SKU...")}
          className={cn(
            "form_field_control form_field_search_input",
            !open && !value && "is_placeholder"
          )}
        />
      </div>
      {open && (
        <div className="form_product_select_popover">
          {filtered.length > 0 ? (
            <ul id={listId} className="form_product_select_list" role="listbox">
              {filtered.map((product) => {
                const isSelected = value?.id === product.id;
                return (
                  <li key={product.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      className={cn(
                        "form_product_select_item",
                        isSelected && "is_selected"
                      )}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleSelect(product)}
                    >
                      <div className="form_product_select_item_main">
                        <span className="form_product_select_name">{titleCase(product.name)}</span>
                        <span className="form_product_select_meta">
                          {t("product_select.sku", "SKU: {sku}", { sku: formatSku(product.sku) })} · {product.currentStock} {product.unit}
                        </span>
                      </div>
                      {isSelected && (
                        <span className="form_product_select_badge">{t("product_select.selected", "Selected")}</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="form_product_select_empty">{t("product_select.empty", "No products found")}</div>
          )}
        </div>
      )}
      <FieldError id={errorId} error={error} />
    </div>
  );
}

export function FormCategoryMultiSelect({
  label,
  options,
  value,
  onChange,
  placeholder: placeholderProp,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string[];
  onChange?: (values: string[]) => void;
  placeholder?: string;
}) {
  const { t } = useI18n();
  const placeholder = placeholderProp ?? t("category_select.placeholder", "Select categories");
  const available = options.filter((option) => !value.includes(option.value));

  const addCategory = (nextValue: string) => {
    if (!nextValue || value.includes(nextValue)) return;
    onChange?.([...value, nextValue]);
  };

  const removeCategory = (nextValue: string) => {
    onChange?.(value.filter((item) => item !== nextValue));
  };

  return (
    <div className="form_field">
      <span className="form_field_label">{label}</span>
      <div className="form_field_control form_field_multi_select">
        <div className="form_multi_select_inner">
          <div className="form_multi_select_tags">
            {value.length === 0 ? (
              <span className="form_multi_select_placeholder">{placeholder}</span>
            ) : (
              value.map((item) => {
                const option = options.find((entry) => entry.value === item);
                return (
                  <span key={item} className="form_multi_select_tag">
                    {option?.label ?? item}
                    <button
                      type="button"
                      className="form_multi_select_tag_remove"
                      onClick={() => removeCategory(item)}
                      aria-label={t("category_select.remove", "Remove {label}", { label: option?.label ?? item })}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                );
              })
            )}
          </div>
          {available.length > 0 && (
            <Select value="" onValueChange={addCategory}>
              <SelectTrigger className="form_multi_select_add" aria-label={t("category_select.add_label", "Add {label}", { label })}>
                <SelectValue placeholder={value.length === 0 ? placeholder : t("category_select.add", "Add category")} />
              </SelectTrigger>
              <SelectContent className="form_field_select_content">
                {available.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                    className="form_field_select_item"
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <ChevronDown className="form_field_icon" />
      </div>
    </div>
  );
}

export function FormTextarea({
  label,
  value,
  onChange,
  placeholder,
  required = false,
  rows = 4,
  maxLength,
  error,
}: {
  label: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  required?: boolean;
  rows?: number;
  maxLength?: number;
  error?: string;
}) {
  const errorId = useId();
  return (
    <label className="form_field">
      <span className="form_field_label">
        {label}
        {required && <span className="form_field_required"> *</span>}
      </span>
      <textarea
        value={value ?? ""}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        rows={rows}
        maxLength={maxLength}
        className="form_field_control form_field_textarea"
        {...invalidProps(errorId, error)}
      />
      <FieldError id={errorId} error={error} />
    </label>
  );
}

export function FormImageUpload({
  label,
  file,
  onChange,
  accept = IMAGE_ACCEPT,
  emptyLabel,
  disabled = false,
}: {
  label: string;
  file?: File | null;
  onChange?: (file: File | null) => void;
  accept?: string;
  emptyLabel?: string;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const errorId = useId();
  // Checked here, against the API's own rules, so every upload field refuses a bad file the same way.
  const [problem, setProblem] = useState<string | null>(null);
  const displayName = file?.name || emptyLabel || t("image.no_file", "No File Chosen");

  return (
    <div className="form_field form_field_image_upload">
      <span className="form_field_label">{label}</span>
      <div className="form_field_upload_row">
        <input
          type="text"
          readOnly
          value={displayName}
          tabIndex={-1}
          className={cn(
            "form_field_control form_field_upload_display",
            !file && "is_placeholder"
          )}
        />
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          disabled={disabled}
          className="sr-only"
          onChange={(e) => {
            const selectedFile = e.target.files?.[0] ?? null;
            e.target.value = "";
            const reason = selectedFile ? imageFileProblem(selectedFile) : null;
            setProblem(reason);
            if (!reason) onChange?.(selectedFile);
          }}
        />
        <Button
         
          disabled={disabled}
          variant="outline" className="form_field_upload_btn"
          onClick={() => inputRef.current?.click()}
        >
          {t("actions.upload_image", "Upload Image")}
        </Button>
      </div>
      <FieldError id={errorId} error={problem ?? undefined} />
    </div>
  );
}

export { LogoMark } from "./LogoMark";

export function FilterIconLabel() {
  const { t } = useI18n();
  return (
    <span className="inline-flex items-center gap-2 text-sm font-medium text-gray-600">
      <Filter className="h-4 w-4" />
      {t("filters.filter", "Filter")}
    </span>
  );
}
