import type { Metadata } from "next";
import { Cormorant_Garamond, Figtree } from "next/font/google";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-cormorant",
});

const figtree = Figtree({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-figtree",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://opencollective.app"),
  title: "Collective — Operator OS",
  description: "Collective operator console",
  openGraph: {
    title: "Open Collective — Operator OS",
    description: "Collective operator console",
    url: "https://opencollective.app",
    siteName: "Open Collective",
    type: "website",
    images: [
      { url: "/brand/og-brand.png", width: 1200, height: 630, alt: "Open Collective" },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Open Collective — Operator OS",
    description: "Collective operator console",
    images: ["/brand/og-brand.png"],
  },
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${cormorant.variable} ${figtree.variable}`}>
      <body>{children}</body>
    </html>
  );
}
