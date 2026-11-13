// Phone number formatting and validation for Cambodia. The API only accepts national numbers, so this module converts any international "+855…" into the leading zero, and caps at 10 digits. It also provides a regex pattern for validating a national number, and a function to format it with spaces for display.

export const PHONE_MAX_DIGITS = 10;
/** 10 digits plus the two grouping spaces. */
export const PHONE_MAX_LENGTH = PHONE_MAX_DIGITS + 2;
export const PHONE_PLACEHOLDER = "012 345 6789";
export const PHONE_PATTERN = /^0\d{2}\s?\d{3}\s?\d{3,4}$/;
export const PHONE_INVALID_MESSAGE =
  "Enter a valid phone number, e.g. 012 345 6789.";

/** Digits only, "+855…" turned into the national leading zero, capped at 10 digits. */
export function phoneDigits(val: string | null | undefined): string {
  let digits = (val ?? "").replace(/\D/g, "");
  if (digits.startsWith("855") && digits.length > 8) {
    const national = digits.slice(3);
    digits = national.startsWith("0") ? national : `0${national}`;
  }
  return digits.slice(0, PHONE_MAX_DIGITS);
}

/** Groups digits as "012 345 6789" — used on every keystroke of a phone input. */
export function formatPhoneInput(val: string | null | undefined): string {
  const digits = phoneDigits(val);
  return [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6)]
    .filter(Boolean)
    .join(" ");
}

/** For displaying a stored number; leaves anything that isn't a national number untouched. */
export function formatPhone(val: string | null | undefined): string {
  if (!val) return "";
  const formatted = formatPhoneInput(val);
  return PHONE_PATTERN.test(formatted) ? formatted : val;
}

/** Empty is allowed (the field is optional unless the caller checks otherwise). */
export function isValidPhone(val: string | null | undefined): boolean {
  const trimmed = (val ?? "").trim();
  return !trimmed || PHONE_PATTERN.test(trimmed);
}

/** True when both values are the same number, however they are spaced. */
export function samePhone(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  return phoneDigits(a) === phoneDigits(b);
}
