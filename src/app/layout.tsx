// src/app/layout.tsx
import type { Metadata } from "next";
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
  // Khmer fonts
  Koh_Santepheap,
  Kantumruy_Pro,
  Battambang,
  Siemreap,
  Dangrek,
  Noto_Sans_Khmer,
} from "next/font/google";
import ClientProvider from "@/contexts/client-provider";

// English fonts
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
  variable: "--font-roboto",
  display: "swap",
});

// Same pairing as the customer UI (Coffee-Shop-UI): self-hosted by Next.js at build time, no
// runtime request to Google's servers. Google Sans Flex only ships a latin/latin-ext charset,
// so Khmer text still needs Noto Sans Khmer layered in behind it — see --current-khmer-font.
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
});

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
  display: "swap",
});

const lato = Lato({
  subsets: ["latin"],
  weight: ["300", "400", "700", "900"],
  variable: "--font-lato",
  display: "swap",
});

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-source-sans",
  display: "swap",
});

const nunito = Nunito({
  subsets: ["latin"],
  variable: "--font-nunito",
  display: "swap",
});

const workSans = Work_Sans({
  subsets: ["latin"],
  variable: "--font-work-sans",
  display: "swap",
});

const kohSantepheap = Koh_Santepheap({
  subsets: ["khmer", "latin"],
  weight: ["100", "300", "400", "700", "900"],
  variable: "--font-koh-santepheap",
  display: "swap",
});

const kantumruyPro = Kantumruy_Pro({
  subsets: ["khmer", "latin"],
  variable: "--font-kantumruy-pro",
  display: "swap",
});

const battambang = Battambang({
  subsets: ["khmer", "latin"],
  weight: ["100", "300", "400", "700", "900"],
  variable: "--font-battambang",
  display: "swap",
});

const siemreap = Siemreap({
  subsets: ["khmer"],
  weight: ["400"],
  variable: "--font-siemreap",
  display: "swap",
});

const dangrek = Dangrek({
  subsets: ["khmer"],
  weight: ["400"],
  variable: "--font-dangrek",
  display: "swap",
});

// Matches the customer UI's Khmer pairing exactly.
const notoSansKhmer = Noto_Sans_Khmer({
  subsets: ["khmer"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-noto-sans-khmer",
  display: "swap",
});

// favicon project of 590st CAFE
export const metadata: Metadata = {
  title: "590st Cafe Admin Dashboard",
  description: "590st Cafe Admin Dashboard",

  // White 590st mark on a black tile, so the tab icon reads on light and dark browser chrome.
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
        <Analytics />
      </body>
    </html>
  );
}
