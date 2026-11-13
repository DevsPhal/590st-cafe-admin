"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";
import { useI18n } from "@/contexts/I18nContext";
import { QUEUE_TABS, TAB_TONE, TONE_CLASSES, type QueueTab } from "../queue";

type Translate = ReturnType<typeof useI18n>["t"];

export function tabLabel(t: Translate, tab: QueueTab): string {
  switch (tab) {
    case "ALL":
      return t("barista.queue.all", "All Orders");
    case "AWAITING_PAYMENT":
      return t("barista.queue.awaiting_payment", "Awaiting Payment");
    case "NEW_PAID":
      return t("barista.queue.new_paid", "New — Paid");
    case "PREPARING":
      return t("barista.queue.preparing", "Preparing");
    case "OUT_FOR_DELIVERY":
      return t("barista.queue.out_for_delivery", "Out for Delivery");
    case "COMPLETED":
      return t("barista.queue.completed", "Completed");
    case "CANCELLED":
      return t("barista.queue.cancelled", "Cancelled");
  }
}

const FADE = "24px";

// Fades whichever edge still has tabs scrolled out of view, so phones show there is more to swipe to.
function edgeMask(start: boolean, end: boolean): CSSProperties | undefined {
  if (!start && !end) return undefined;
  const image = `linear-gradient(to right, ${start ? "transparent" : "#000"}, #000 ${FADE}, #000 calc(100% - ${FADE}), ${end ? "transparent" : "#000"})`;
  return { maskImage: image, WebkitMaskImage: image };
}

/** The status tabs; render inside a Radix Tabs root that owns the selected value. */
export function QueueStatusTabs({
  value,
  counts,
}: {
  value: QueueTab;
  counts?: Record<QueueTab, number>;
}) {
  const { t } = useI18n();
  const listRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: false, end: false });

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const update = () => {
      const overflow = list.scrollWidth - list.clientWidth;
      setEdges({ start: list.scrollLeft > 1, end: list.scrollLeft < overflow - 1 });
    };
    // The observer reports the starting size too, so this also sets the first state.
    const observer = new ResizeObserver(update);
    observer.observe(list);
    list.addEventListener("scroll", update, { passive: true });
    return () => {
      observer.disconnect();
      list.removeEventListener("scroll", update);
    };
  }, []);

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>('[role="tab"][data-state="active"]')
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [value]);

  return (
    <TabsPrimitive.List
      ref={listRef}
      aria-label={t("barista.tabs.label", "Order status")}
      // Phones swipe through the tabs; wider screens wrap them so every status stays in view.
      // The padding keeps focus rings clear of the scroll area's clipping.
      className="-m-1 flex min-w-0 gap-1.5 overflow-x-auto p-1 scrollbar-none md:flex-wrap md:overflow-visible [&::-webkit-scrollbar]:hidden"
      style={edgeMask(edges.start, edges.end)}
    >
      {QUEUE_TABS.map((tab) => {
        const tone = TONE_CLASSES[TAB_TONE[tab]];
        const count = counts?.[tab];
        return (
          <TabsPrimitive.Trigger
            key={tab}
            value={tab}
            className={cn(
              // A little taller on touch screens, where tabs are tapped with a thumb.
              "group inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-(--line) bg-(--surface) pr-1 text-[13px] font-medium whitespace-nowrap text-(--ink) transition-colors pointer-coarse:h-10",
              "hover:border-(--ink-subtle) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ink-strong)",
              "data-[state=active]:border-(--brand-ink) data-[state=active]:bg-(--brand-ink) data-[state=active]:font-semibold data-[state=active]:text-white",
              // On the dark theme the selected option turns light, like the other selected controls there.
              "dark:data-[state=active]:border-(--ink-strong) dark:data-[state=active]:bg-(--ink-strong) dark:data-[state=active]:text-(--brand-ink)",
              tab === "ALL" ? "pl-3.5" : "pl-3"
            )}
          >
            {tab !== "ALL" ? <span aria-hidden className={cn("h-2 w-2 shrink-0 rounded-full", tone.dot)} /> : null}
            {tabLabel(t, tab)}
            <span
              className={cn(
                "inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums",
                // Only stages with orders in them are colored, so busy ones stand out at a glance.
                count && tab !== "ALL" ? tone.badge : "bg-gray-100 text-gray-600",
                "group-data-[state=active]:bg-(--brand-lime) group-data-[state=active]:text-(--brand-ink)"
              )}
            >
              {count ?? "–"}
            </span>
          </TabsPrimitive.Trigger>
        );
      })}
    </TabsPrimitive.List>
  );
}
