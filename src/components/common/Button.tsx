"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "accent" | "outline" | "danger" | "ghost";

// The look lives in globals.scss (btn_*), so a plain <button className="btn_*"> and <Button> match.
const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: "btn_primary_black",
  accent: "btn_primary_yellow",
  outline: "btn_outline_black",
  danger: "btn_danger",
  ghost: "btn_ghost",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  /** "icon" is a square button for a single icon (give it an aria-label); "lg" is 48px, for a lone main action. */
  size?: "md" | "lg" | "icon";
  /** Disables the button and shows a spinner, so a second click can't send it twice. */
  loading?: boolean;
  /** Shown instead of the children while loading, e.g. "Saving...". */
  loadingLabel?: ReactNode;
};

/** The one button. 36px on desktop, at least 44px on touch screens (see globals.scss). */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "outline", size = "md", loading = false, loadingLabel, className, children, type = "button", disabled, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(VARIANT_CLASS[variant], size === "icon" && "btn_icon", size === "lg" && "btn_lg", className)}
      {...rest}
    >
      {loading ? <Loader2 className="animate-spin" aria-hidden /> : null}
      {loading && loadingLabel ? loadingLabel : children}
    </button>
  );
});
