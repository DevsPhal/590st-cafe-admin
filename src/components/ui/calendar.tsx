"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils";

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "relative flex flex-col gap-4 sm:flex-row",
        month: "flex flex-col gap-3",
        month_caption: "flex h-8 items-center justify-center relative px-9",
        caption_label: "text-sm font-semibold text-[var(--ink)]",
        nav: "absolute inset-x-0 top-0 flex items-center justify-between px-0.5 z-10",
        button_previous:
          "inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--ink)] hover:bg-[var(--surface-muted)] disabled:opacity-40",
        button_next:
          "inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--ink)] hover:bg-[var(--surface-muted)] disabled:opacity-40",
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday:
          "w-9 pb-1 text-[0.75rem] font-medium text-[var(--ink-muted)] text-center",
        week: "mt-1 flex w-full",
        day: "relative h-9 w-9 p-0 text-center text-sm",
        day_button:
          "h-9 w-9 rounded-full p-0 font-normal text-[var(--ink)] transition-colors hover:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-lime)]",
        selected:
          "[&>button]:bg-[var(--brand-ink)] [&>button]:font-semibold [&>button]:text-white [&>button]:hover:bg-[var(--brand-ink)]",
        range_start:
          "rounded-l-full bg-[var(--surface-muted)] [&>button]:bg-[var(--brand-ink)] [&>button]:text-white",
        range_end:
          "rounded-r-full bg-[var(--surface-muted)] [&>button]:bg-[var(--brand-ink)] [&>button]:text-white",
        range_middle:
          "bg-[var(--surface-muted)] [&>button]:bg-transparent [&>button]:text-[var(--ink)] [&>button]:rounded-none",
        today: "[&>button]:ring-2 [&>button]:ring-inset [&>button]:ring-[var(--brand-lime)]",
        outside: "[&>button]:text-[var(--ink-subtle)] [&>button]:opacity-60",
        disabled: "[&>button]:text-[var(--ink-subtle)] [&>button]:opacity-40 [&>button]:cursor-not-allowed [&>button]:hover:bg-transparent",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className: chevronClassName, ...chevronProps }) => {
          const Icon = orientation === "left" ? ChevronLeft : ChevronRight;
          return (
            <Icon className={cn("h-4 w-4", chevronClassName)} {...chevronProps} />
          );
        },
      }}
      {...props}
    />
  );
}

export { Calendar };
