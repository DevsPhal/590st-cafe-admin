import { DEFAULT_LOCALE, type Locale } from "./locales";

export type TranslationMessages = {
  [key: string]: string | TranslationMessages;
};

export type TranslationParams = Record<string, string | number>;

export function lookup(messages: TranslationMessages, key: string): string | undefined {
  let result: string | TranslationMessages | undefined = messages;
  for (const k of key.split(".")) {
    if (typeof result === "object" && result !== null && k in result) {
      result = result[k];
    } else {
      return undefined;
    }
  }
  return typeof result === "string" ? result : undefined;
}

// Fills "{name}" placeholders; unknown placeholders are left as written.
export function interpolate(text: string, params?: TranslationParams): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match
  );
}

// The active messages and language, for code that runs outside React (form validation, API errors,
// live notices, date formatting). I18nProvider keeps them in sync with the selected language.
let activeMessages: TranslationMessages = {};
let activeLocale: Locale = DEFAULT_LOCALE;

export function setActiveMessages(messages: TranslationMessages, locale: Locale = DEFAULT_LOCALE) {
  activeMessages = messages;
  activeLocale = locale;
}

export function currentLocale(): Locale {
  return activeLocale;
}

export function translate(key: string, fallback?: string, params?: TranslationParams): string {
  return interpolate(lookup(activeMessages, key) ?? fallback ?? key, params);
}
