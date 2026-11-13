"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  return (
    <nav
      aria-label="Breadcrumb"
      className={cn("breadcrumbs flex min-w-0 items-center gap-2 text-xs text-gray-500", className)}
    >
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        // On a phone only the current page stays (truncated to one line); the trail above it
        // is still one tap away in the menu, and it was wrapping the header onto three lines.
        return (
          <div
            key={`${item.label}-${index}`}
            className={cn("flex min-w-0 items-center gap-2", isLast ? "breadcrumb_current" : "breadcrumb_parent")}
          >
            {item.href && !isLast ? (
              <Link href={item.href} className="hover:text-gray-800">
                {item.label}
              </Link>
            ) : (
              <span className={cn("truncate", isLast ? "text-gray-900" : "")}>{item.label}</span>
            )}
            {!isLast && <ChevronRight className="h-3.5 w-3.5 text-gray-400" />}
          </div>
        );
      })}
    </nav>
  );
}
