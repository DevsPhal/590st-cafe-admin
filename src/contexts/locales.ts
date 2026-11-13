// The one list of languages the dashboard supports. The header selector, the settings page and
// the translation provider all read it, so the label, flag and highlight can never disagree with
// the language actually rendered.
export const LOCALES = [
  {
    code: "kh",
    // BCP 47 tag for Khmer, used for <html lang> (and the stylesheet's :lang(km) font rule).
    htmlLang: "km",
    shortLabel: "KH",
    label: "ខ្មែរ",
    flag: "/images/cambodia.svg",
    flagAltKey: "language.flag_cambodia",
    flagAlt: "Cambodia",
  },
  {
    code: "en",
    htmlLang: "en",
    shortLabel: "ENG",
    label: "English",
    flag: "/images/english.svg",
    flagAltKey: "language.flag_english",
    flagAlt: "English",
  },
] as const;

export type Locale = (typeof LOCALES)[number]["code"];
export type LocaleInfo = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_STORAGE_KEY = "selectedLocale";

const ALIASES: Record<string, Locale> = {
  en: "en",
  eng: "en",
  english: "en",
  kh: "kh",
  km: "kh",
  khm: "kh",
  khmer: "kh",
  "ខ្មែរ": "kh",
};

/**
 * Turns any stored or requested value into a supported locale: "km" (the ISO code for Khmer),
 * regional tags like "en-US", different casing and JSON-quoted values from older builds all map
 * to their language, and anything unrecognised falls back to English.
 */
export function normalizeLocale(raw: string | null | undefined): Locale {
  const primary = (raw ?? "").trim().replace(/^"+|"+$/g, "").toLowerCase().split(/[-_]/)[0];
  return ALIASES[primary] ?? DEFAULT_LOCALE;
}

export function localeInfo(code: Locale): LocaleInfo {
  return LOCALES.find((entry) => entry.code === code) ?? LOCALES[1];
}
