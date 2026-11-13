export const PHONE_MAX_DIGITS = 10;
export const PHONE_MAX_LENGTH = PHONE_MAX_DIGITS + 2;
export const PHONE_PLACEHOLDER = "012 345 6789";
export const PHONE_PATTERN = /^0\d{2}\s?\d{3}\s?\d{3,4}$/;
export const PHONE_INVALID_MESSAGE =
  "Enter a valid phone number, e.g. 012 345 6789.";

export function phoneDigits(val: string | null | undefined): string {
  let digits = (val ?? "").replace(/\D/g, "");
  if (digits.startsWith("855") && digits.length > 8) {
    const national = digits.slice(3);
    digits = national.startsWith("0") ? national : `0${national}`;
  }
  return digits.slice(0, PHONE_MAX_DIGITS);
}

export function formatPhoneInput(val: string | null | undefined): string {
  const digits = phoneDigits(val);
  return [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6)]
    .filter(Boolean)
    .join(" ");
}

export function formatPhone(val: string | null | undefined): string {
  if (!val) return "";
  const formatted = formatPhoneInput(val);
  return PHONE_PATTERN.test(formatted) ? formatted : val;
}

export function isValidPhone(val: string | null | undefined): boolean {
  const trimmed = (val ?? "").trim();
  return !trimmed || PHONE_PATTERN.test(trimmed);
}

export function samePhone(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  return phoneDigits(a) === phoneDigits(b);
}
