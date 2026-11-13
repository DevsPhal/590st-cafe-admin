"use client";

import { useEffect } from "react";

const PICKER_TYPES = new Set([
  "date",
  "datetime-local",
  "month",
  "week",
  "time",
]);

// A hook that listens for clicks on native input pickers (date, time, etc.) and calls showPicker() on them. This is a workaround for browsers that don't automatically open the picker when the input is clicked, or when the input is focused programmatically. It also prevents the picker from being opened when the input is disabled or read-only.
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
        // Already open, or a browser without showPicker — its own click handling still applies.
      }
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);
}
