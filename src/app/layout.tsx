import type { Metadata } from "next";
import { Geist, Geist_Mono, Cormorant_Garamond } from "next/font/google";
import { Nav } from "@/components/nav";
import { JsonLd } from "@/components/json-ld";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const title = "DANED Studio — Reservas de Pilates y Nutrición";
const description =
  "Reserva sesiones de Pilates y Asistencia Nutricional en línea con DANED Studio. Crea tu cuenta, completa tu perfil y agenda tu clase en minutos.";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const displayFont = Cormorant_Garamond({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: title,
    template: "%s | DANED Studio",
  },
  description,
  keywords: [
    "pilates",
    "estudio de pilates",
    "nutrición",
    "asistencia nutricional",
    "reservas de clases",
    "DANED Studio",
  ],
  authors: [{ name: "DANED Studio" }],
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "es_EC",
    url: siteUrl,
    siteName: "DANED Studio",
    title,
    description,
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
  icons: {
    icon: "/danedlogo.ico",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} ${displayFont.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-white text-charcoal">
        <JsonLd />
        <Nav />
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
