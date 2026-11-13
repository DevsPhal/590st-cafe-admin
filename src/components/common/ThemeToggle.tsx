"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useMounted } from "@/hooks/useMounted";
import { useI18n } from "@/contexts/I18nContext";

// Shows the theme in use (sun = light, moon = dark); one click switches, and next-themes saves the choice.
export function ThemeToggle() {
  const { t } = useI18n();
  const { resolvedTheme, setTheme } = useTheme();
  // The saved theme is only known in the browser. The icon is picked by CSS from the class next-themes
  // sets before the first paint, so it is right straight away; only the label waits for the browser.
  const mounted = useMounted();
  const isDark = mounted && resolvedTheme === "dark";
  const label = isDark
    ? t("theme.switch_to_light", "Switch to light mode")
    : t("theme.switch_to_dark", "Switch to dark mode");

  return (
    <button
      type="button"
      className="header_action_btn header_theme_btn"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={label}
      title={label}
    >
      <Sun aria-hidden className="dark:hidden" />
      <Moon aria-hidden className="hidden dark:block" />
    </button>
  );
}
