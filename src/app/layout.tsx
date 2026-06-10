import type { Metadata, Viewport } from "next";
import { Anton, Montserrat, Caveat, Inter } from "next/font/google";
import { Geist_Mono } from "next/font/google";
import { Providers }    from "@/components/providers";
import { PwaRegister }  from "@/components/shared/pwa-register";
import { EasterEggLua } from "@/components/shared/easter-egg-lua";
import { ImpersonationBanner } from "@/components/shared/impersonation-banner";
import { Toaster }      from "sonner";
import "./globals.css";

/* ─── Fontes da Marca ─────────────────────────────────────────────────────
   Anton      → títulos principais (bold, uppercase)
   Inter      → títulos secundários (fallback do Agrandir)
   Montserrat → corpo de texto
   Caveat     → frases motivacionais (fallback do Mango AC)
   ─────────────────────────────────────────────────────────────────────── */

const anton = Anton({
  weight: "400",
  variable: "--font-anton",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  display: "swap",
});

const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Lição de Casa — CRM",
    template: "%s | Lição de Casa",
  },
  description:
    "Sistema de gestão de aulas particulares — reforço escolar e preparação para vestibulares.",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192x192.png",       sizes: "192x192", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#FB8500",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body
        className={`
          ${anton.variable}
          ${inter.variable}
          ${montserrat.variable}
          ${caveat.variable}
          ${geistMono.variable}
          font-body antialiased
        `}
      >
        <Providers>
          <PwaRegister />
          <ImpersonationBanner />
          {children}
          <EasterEggLua />
          <Toaster richColors position="top-right" />
        </Providers>
      </body>
    </html>
  );
}
