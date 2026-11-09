import type { Metadata, Viewport } from "next";
import "./globals.scss";
import { Analytics } from "@vercel/analytics/next";
import {
  Inter,
  Poppins,
  Roboto,
  Google_Sans_Flex,
  Open_Sans,
  Montserrat,
  Lato,
  Source_Sans_3,
  Nunito,
  Work_Sans,
  Koh_Santepheap,
  Kantumruy_Pro,
  Battambang,
  Siemreap,
  Dangrek,
  Noto_Sans_Khmer,
} from "next/font/google";
import ClientProvider from "@/contexts/client-provider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  preload: false,
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
  preload: false,
});

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
  variable: "--font-roboto",
  display: "swap",
  preload: false,
});

const googleSansFlex = Google_Sans_Flex({
  subsets: ["latin"],
  weight: "variable",
  variable: "--font-google-sans",
  display: "swap",
});

const openSans = Open_Sans({
  subsets: ["latin"],
  variable: "--font-open-sans",
  display: "swap",
  preload: false,
});

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
  display: "swap",
  preload: false,
});

const lato = Lato({
  subsets: ["latin"],
  weight: ["300", "400", "700", "900"],
  variable: "--font-lato",
  display: "swap",
  preload: false,
});

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-source-sans",
  display: "swap",
  preload: false,
});

const nunito = Nunito({
  subsets: ["latin"],
  variable: "--font-nunito",
  display: "swap",
  preload: false,
});

const workSans = Work_Sans({
  subsets: ["latin"],
  variable: "--font-work-sans",
  display: "swap",
  preload: false,
});

const kohSantepheap = Koh_Santepheap({
  subsets: ["khmer", "latin"],
  weight: ["100", "300", "400", "700", "900"],
  variable: "--font-koh-santepheap",
  display: "swap",
  preload: false,
});

const kantumruyPro = Kantumruy_Pro({
  subsets: ["khmer", "latin"],
  variable: "--font-kantumruy-pro",
  display: "swap",
  preload: false,
});

const battambang = Battambang({
  subsets: ["khmer", "latin"],
  weight: ["100", "300", "400", "700", "900"],
  variable: "--font-battambang",
  display: "swap",
  preload: false,
});

const siemreap = Siemreap({
  subsets: ["khmer"],
  weight: ["400"],
  variable: "--font-siemreap",
  display: "swap",
  preload: false,
});

const dangrek = Dangrek({
  subsets: ["khmer"],
  weight: ["400"],
  variable: "--font-dangrek",
  display: "swap",
  preload: false,
});

const notoSansKhmer = Noto_Sans_Khmer({
  subsets: ["khmer"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-noto-sans-khmer",
  display: "swap",
});

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
      className={`
        ${inter.variable}
        ${poppins.variable}
        ${roboto.variable}
        ${googleSansFlex.variable}
        ${openSans.variable}
        ${montserrat.variable}
        ${lato.variable}
        ${sourceSans.variable}
        ${nunito.variable}
        ${workSans.variable}
        ${kohSantepheap.variable}
        ${kantumruyPro.variable}
        ${battambang.variable}
        ${siemreap.variable}
        ${dangrek.variable}
        ${notoSansKhmer.variable}
      `}
    >
      <body className="font-sans" suppressHydrationWarning>
        <ClientProvider>{children}</ClientProvider>
        {/* Vercel serves the analytics script only on its own hosting; elsewhere (Docker) it would 404 on every page. */}
        {process.env.VERCEL ? <Analytics /> : null}
      </body>
    </html>
  );
}
