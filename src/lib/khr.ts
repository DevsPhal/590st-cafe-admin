// USD to riel for anything shown or collected in KHR, the same rule as the API (KhrConversion): convert, make a
// whole number of riel (half up), then round to the nearest 100 — last two digits 00–50 round down, 51–99 up
// (1,250 → 1,200, 1,251 → 1,300). Only the final riel figure is rounded; USD and the rate never are.
//
// Everything is worked out in whole cents, whole riel and rate ten-thousandths, so floating point never moves a
// boundary (1.19 × 4100 is exactly 4,879, not 4,878.999…).

export type CashCurrency = "USD" | "KHR";

const RATE_SCALE = 10_000; // the API keeps the rate to four decimals

/** A riel amount rounded to the nearest 100: 00–50 down, 51–99 up. */
export function roundKhrToNearest100(khr: number): number {
  const whole = Math.round(Math.abs(khr));
  const remainder = whole % 100;
  const rounded = remainder <= 50 ? whole - remainder : whole - remainder + 100;
  return khr < 0 ? -rounded : rounded;
}

/** The riel amount for a USD amount at `khrPerUsd`, rounded to the nearest 100 riel. */
export function usdToKhr(usd: number, khrPerUsd: number): number {
  const cents = Math.round(Math.abs(usd) * 100);
  const rate = Math.round(khrPerUsd * RATE_SCALE);
  // riel = cents / 100 × rate / 10,000; half up to a whole riel before the 100 rule.
  const scale = 100 * RATE_SCALE;
  const wholeRiel = Math.floor((cents * rate + scale / 2) / scale);
  const rounded = roundKhrToNearest100(wholeRiel);
  return usd < 0 ? -rounded : rounded;
}

/** What the customer owes in the currency they pay with: dollars as they are, riel converted and rounded. */
export function amountDue(usdTotal: number, currency: CashCurrency, khrPerUsd: number | null): number {
  if (currency === "KHR" && khrPerUsd) return usdToKhr(usdTotal, khrPerUsd);
  return usdTotal;
}

/**
 * "41,000 ៛ · 1 USD = 4,100 ៛" for a cash order paid or changed in riel (it carries the rate used), or null.
 * The riel total is the order total rounded to the nearest 100, as on the receipt.
 */
export function rielTotalLabel(order: {
  totalAmount: number | string;
  paymentMethod: string | null;
  exchangeRate?: number | string | null;
}): string | null {
  if (order.paymentMethod !== "CASH" || order.exchangeRate == null) return null;
  const rate = Number(order.exchangeRate);
  if (!(rate > 0)) return null;
  const riel = usdToKhr(Number(order.totalAmount), rate);
  return `${riel.toLocaleString("en-US")} ៛ · 1 USD = ${rate.toLocaleString("en-US", { maximumFractionDigits: 4 })} ៛`;
}

/** Change for cash handed over in the same currency: riel rounded like the API, dollars to the cent. */
export function changeDue(tendered: number, due: number, currency: CashCurrency): number {
  return currency === "KHR"
    ? roundKhrToNearest100(tendered - due)
    : Math.round((tendered - due) * 100) / 100;
}
