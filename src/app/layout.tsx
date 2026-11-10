import type { Metadata, Viewport } from "next";
import "./globals.scss";
import { Analytics } from "@vercel/analytics/next";
import "./fonts";
import ClientProvider from "@/contexts/client-provider";

// Zoom stays allowed (no maximum-scale / user-scalable=no); fields are 16px so iOS never zooms on focus.
// resizes-visual: the on-screen keyboard overlays the page instead of shrinking it, so nothing jumps.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  interactiveWidget: "resizes-visual",
};

export const metadata: Metadata = {
  title: "590st Cafe Admin Dashboard",
  description: "590st Cafe Admin Dashboard",

  icons: {
    icon: [
      { url: "/logos/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/logos/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/logos/icon-32.png",
    apple: { url: "/logos/apple-icon.png", sizes: "180x180" },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
    >
      <body className="font-sans" suppressHydrationWarning>
        <ClientProvider>{children}</ClientProvider>
        {/* Vercel serves the analytics script only on its own hosting; elsewhere (Docker) it would 404 on every page. */}
        {process.env.VERCEL ? <Analytics /> : null}
      </body>
    </html>
  );
}
