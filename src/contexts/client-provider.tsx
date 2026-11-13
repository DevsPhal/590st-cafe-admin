"use client";

import React, { ReactNode, Suspense } from "react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "react-hot-toast";
import { I18nProvider } from "@/contexts/I18nContext";
import { StoreProvider } from "@/store/StoreProvider";
import { FontProvider } from "./font-provider";
import { useOpenNativePickers } from "@/hooks/useOpenNativePickers";

interface ClientProvidersProps {
  children: ReactNode;
}

//sets up the client-side context providers for the app, including theme, i18n, font, and store. Also sets up react-hot-toast with custom styling.
export default function ClientProvider({ children }: ClientProvidersProps) {
  useOpenNativePickers();
  return (
    <StoreProvider>
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        enableSystem={false}
      >
        <I18nProvider>
          <FontProvider>
            <Suspense fallback={<div>Loading...</div>}>{children}</Suspense>
            {/* Every mutation reports success/failure through react-hot-toast, styled with the
                same tokens and radius as the rest of the admin UI (StatusBadge's status-color
                pairs, --radius-control) instead of the library's plain default look. */}
            <Toaster
              position="top-right"
              containerClassName="admin_toaster"
              toastOptions={{
                duration: 4000,
                style: {
                  background: "var(--surface)",
                  color: "var(--ink)",
                  border: "1px solid var(--line)",
                  borderRadius: "var(--radius-control)",
                  boxShadow: "0px 8px 24px rgba(32, 33, 36, 0.12)",
                  padding: "12px 16px",
                  fontSize: "0.875rem",
                  fontFamily:
                    "var(--current-english-font), var(--current-khmer-font), sans-serif",
                },
                success: {
                  iconTheme: {
                    primary: "var(--success-text)",
                    secondary: "var(--success-bg)",
                  },
                  style: {
                    background: "var(--success-bg)",
                    color: "var(--success-text)",
                    border: "1px solid var(--success-text)",
                  },
                },
                error: {
                  iconTheme: {
                    primary: "var(--danger-text)",
                    secondary: "var(--danger-bg)",
                  },
                  style: {
                    background: "var(--danger-bg)",
                    color: "var(--danger-text)",
                    border: "1px solid var(--danger-text)",
                  },
                },
              }}
            />
          </FontProvider>
        </I18nProvider>
      </ThemeProvider>
    </StoreProvider>
  );
}
