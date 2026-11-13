"use client";

import {
  createContext,
  useContext,
  useEffect,
  ReactNode,
  useCallback,
  useMemo,
} from "react";
import { formatWithCommas } from "@/utils/format-currency";
import { useLocalStorageState } from "@/hooks/useLocalStorageState";
import { interpolate, lookup, setActiveMessages, type TranslationParams } from "./translate";
import { LOCALE_STORAGE_KEY, localeInfo, normalizeLocale, type Locale } from "./locales";
import { MESSAGES } from "./messages";

export { translate, type TranslationParams } from "./translate";
export { LOCALES, type Locale } from "./locales";

const timeUnitTranslations: Record<string, string> = {
  hour: "ម៉ោង",
  hours: "ម៉ោង",
  day: "ថ្ងៃ",
  days: "ថ្ងៃ",
  week: "សប្តាហ៍",
  weeks: "សប្តាហ៍",
  month: "ខែ",
  months: "ខែ",
};

type I18nContextType = {
  locale: Locale;
  setLocale: (locale: string) => void;
  t: (key: string, fallback?: string, params?: TranslationParams) => string;
  loadPage: (pageName: string) => Promise<void>;
  formatNumber: (num: number) => string;
  parseTimeAgo: (timeAgo: string) => string;
};

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function I18nProvider({ children }: { children: ReactNode }) {
  // The saved choice is the single source of truth. Reading it through the shared localStorage
  // store keeps hydration clean (the server render uses the default) and keeps open tabs in step.
  const [locale, storeLocale] = useLocalStorageState<Locale>(LOCALE_STORAGE_KEY, normalizeLocale);
  const messages = MESSAGES[locale];
  // Code outside React (form validation, API errors, live notices) reads the language this render shows.
  setActiveMessages(messages, locale);

  const setLocale = useCallback((next: string) => storeLocale(normalizeLocale(next)), [storeLocale]);

  useEffect(() => {
    document.documentElement.lang = localeInfo(locale).htmlLang;
  }, [locale]);

  // Every dictionary ships with the app now; kept so existing callers still work.
  const loadPage = useCallback(async () => {}, []);

  const t = useCallback(
    (key: string, fallback?: string, params?: TranslationParams): string =>
      interpolate(lookup(messages, key) ?? fallback ?? key, params),
    [messages]
  );

  const formatNumber = useCallback(
    (num: Parameters<typeof formatWithCommas>[0]): string => {
      const formatted = formatWithCommas(num, "en-US");

      if (locale === "kh") {
        const khmerDigits = ["០", "១", "២", "៣", "៤", "៥", "៦", "៧", "៨", "៩"];
        return formatted.replace(
          /\d/g,
          (digit) => khmerDigits[parseInt(digit)]
        );
      }

      return formatted;
    },
    [locale]
  );
  const parseTimeAgo = useCallback(
    (timeAgo: string) => {
      const match = timeAgo.match(/(\d+)\s*(\w+)/);
      if (!match) return timeAgo;

      const [, numStr, unit] = match;
      const formattedNum = formatNumber(Number(numStr));
      const translatedUnit = timeUnitTranslations[unit.toLowerCase()] || unit;

      return `${formattedNum} ${translatedUnit}`;
    },
    [formatNumber]
  );

  const value = useMemo(
    () => ({ locale, setLocale, t, loadPage, formatNumber, parseTimeAgo }),
    [locale, setLocale, t, loadPage, formatNumber, parseTimeAgo]
  );

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used inside I18nProvider");
  }
  return context;
}

export function usePageTranslations(pageName?: string) {
  const { t, loadPage } = useI18n();

  useEffect(() => {
    if (pageName) {
      loadPage(pageName);
    }
  }, [pageName, loadPage]);

  return { t };
}
