"use client";

import React, { createContext, useContext, useEffect } from "react";
import { useLocalStorageState } from "@/hooks/useLocalStorageState";

export const enFontOptions = [
  {
    value: "google-sans",
    label: "Google Sans Flex",
    fontFamily: "var(--font-google-sans)",
  },
  {
    value: "sfdisplaypro",
    label: "SF Pro Display",
    fontFamily: "var(--font-sfdisplaypro)",
  },
  { value: "poppins", label: "Poppins", fontFamily: "var(--font-poppins)" },
  { value: "inter", label: "Inter", fontFamily: "var(--font-inter)" },
  { value: "roboto", label: "Roboto", fontFamily: "var(--font-roboto)" },
  {
    value: "open-sans",
    label: "Open Sans",
    fontFamily: "var(--font-open-sans)",
  },
  {
    value: "montserrat",
    label: "Montserrat",
    fontFamily: "var(--font-montserrat)",
  },
  { value: "lato", label: "Lato", fontFamily: "var(--font-lato)" },
  {
    value: "source-sans",
    label: "Source Sans Pro",
    fontFamily: "var(--font-source-sans)",
  },
  { value: "nunito", label: "Nunito", fontFamily: "var(--font-nunito)" },
  {
    value: "work-sans",
    label: "Work Sans",
    fontFamily: "var(--font-work-sans)",
  },
];

export const khmerFontOptions = [
  {
    value: "noto-sans-khmer",
    label: "Noto Sans Khmer",
    fontFamily: "var(--font-noto-sans-khmer)",
  },
  {
    value: "koh-santepheap",
    label: "Koh Santepheap",
    fontFamily: "var(--font-koh-santepheap)",
  },
  {
    value: "kantumruy-pro",
    label: "Kantumruy Pro",
    fontFamily: "var(--font-kantumruy-pro)",
  },
  {
    value: "battambang",
    label: "Battambang",
    fontFamily: "var(--font-battambang)",
  },
  { value: "siemreap", label: "Siemreap", fontFamily: "var(--font-siemreap)" },
  { value: "dangrek", label: "Dangrek", fontFamily: "var(--font-dangrek)" },
];

interface FontContextType {
  englishFont: string;
  khmerFont: string;
  setEnglishFont: (font: string) => void;
  setKhmerFont: (font: string) => void;
  getCurrentEnglishFontFamily: () => string;
  getCurrentKhmerFontFamily: () => string;
}

const FontContext = createContext<FontContextType | undefined>(undefined);

const parseEnglishFont = (raw: string | null) =>
  raw && enFontOptions.some((f) => f.value === raw) ? raw : "google-sans";
const parseKhmerFont = (raw: string | null) =>
  raw && khmerFontOptions.some((f) => f.value === raw) ? raw : "noto-sans-khmer";

export function FontProvider({ children }: { children: React.ReactNode }) {
  const [englishFont, setEnglishFont] = useLocalStorageState("english-font", parseEnglishFont);
  const [khmerFont, setKhmerFont] = useLocalStorageState("khmer-font", parseKhmerFont);

  useEffect(() => {
    const selectedFont = enFontOptions.find((f) => f.value === englishFont);
    if (selectedFont) {
      document.documentElement.style.setProperty(
        "--current-english-font",
        selectedFont.fontFamily
      );
    }
  }, [englishFont]);

  useEffect(() => {
    const selectedFont = khmerFontOptions.find((f) => f.value === khmerFont);
    if (selectedFont) {
      document.documentElement.style.setProperty(
        "--current-khmer-font",
        selectedFont.fontFamily
      );
    }
  }, [khmerFont]);

  const getCurrentEnglishFontFamily = () => {
    const selectedFont = enFontOptions.find((f) => f.value === englishFont);
    return selectedFont?.fontFamily || "var(--font-google-sans)";
  };

  const getCurrentKhmerFontFamily = () => {
    const selectedFont = khmerFontOptions.find((f) => f.value === khmerFont);
    return selectedFont?.fontFamily || "var(--font-noto-sans-khmer)";
  };

  return (
    <FontContext.Provider
      value={{
        englishFont,
        khmerFont,
        setEnglishFont,
        setKhmerFont,
        getCurrentEnglishFontFamily,
        getCurrentKhmerFontFamily,
      }}
    >
      {children}
    </FontContext.Provider>
  );
}

export function useFont() {
  const context = useContext(FontContext);
  if (context === undefined) {
    throw new Error("useFont must be used within a FontProvider");
  }
  return context;
}
