"use client";

import { useEffect } from "react";

const PICKER_TYPES = new Set([
  "date",
  "datetime-local",
  "month",
  "week",
  "time",
]);

export function useOpenNativePickers() {
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const input = event.target;
      if (!(input instanceof HTMLInputElement) || !PICKER_TYPES.has(input.type))
        return;
      if (input.disabled || input.readOnly) return;
      try {
        input.showPicker();
      } catch {
      }
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);
}
