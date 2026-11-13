"use client";

import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { CURRENCY_SYMBOLS, currencyDecimals, formatAmount, sanitizeAmount, type MoneyCurrency } from "@/lib/moneyInput";

type NativeProps = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type" | "inputMode">;

export interface MoneyInputProps extends NativeProps {
  value: string;
  onValueChange: (value: string) => void;
  currency?: MoneyCurrency;
  decimals?: number;
  symbol?: string;
  wrapperClassName?: string;
}

export function MoneyInput({
  value,
  onValueChange,
  currency = "USD",
  decimals,
  symbol,
  wrapperClassName,
  className,
  placeholder,
  onBlur,
  onFocus,
  ...rest
}: MoneyInputProps) {
  const places = decimals ?? currencyDecimals(currency);
  const sign = symbol ?? CURRENCY_SYMBOLS[currency];

  return (
    <span className={cn("money_input", wrapperClassName)}>
      <span className="money_input_symbol" aria-hidden="true">
        {sign}
      </span>
      <input
        {...rest}
        type="text"
        inputMode={places > 0 ? "decimal" : "numeric"}
        autoComplete="off"
        value={value}
        placeholder={placeholder ?? (places > 0 ? (0).toFixed(places) : "0")}
        onChange={(event) => onValueChange(sanitizeAmount(event.target.value, places))}
        onFocus={(event) => {
          event.target.select();
          onFocus?.(event);
        }}
        onBlur={(event) => {
          const formatted = formatAmount(value, places);
          if (formatted !== value) onValueChange(formatted);
          onBlur?.(event);
        }}
        className={cn("money_input_control", className)}
      />
    </span>
  );
}
