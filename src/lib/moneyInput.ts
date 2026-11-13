export type MoneyCurrency = "USD" | "KHR";

export const CURRENCY_SYMBOLS: Record<MoneyCurrency, string> = { USD: "$", KHR: "៛" };

export const currencyDecimals = (currency: MoneyCurrency) => (currency === "KHR" ? 0 : 2);

export function sanitizeAmount(raw: string, decimals: number): string {
  const cleaned = raw.replace(/[^\d.]/g, "");
  if (decimals === 0) return cleaned.split(".")[0].replace(/^0+(?=\d)/, "");
  const dot = cleaned.indexOf(".");
  const limited =
    dot === -1 ? cleaned : `${cleaned.slice(0, dot + 1)}${cleaned.slice(dot + 1).replace(/\./g, "").slice(0, decimals)}`;
  const withLeadingZero = limited.startsWith(".") ? `0${limited}` : limited;
  return withLeadingZero.replace(/^0+(?=\d)/, "");
}

export function formatAmount(raw: string, decimals: number): string {
  if (raw.trim() === "" || raw === ".") return "";
  const value = Number(raw);
  return Number.isFinite(value) ? value.toFixed(decimals) : "";
}
