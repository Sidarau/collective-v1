import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Figtree } from "next/font/google";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
});

const figtree = Figtree({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-figtree",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://myopencollective.com"),
  title: "Collective",
  description: "A private circle. By invitation.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Collective",
  },
  openGraph: {
    title: "Open Collective",
    description: "A private members network. By invitation.",
    url: "https://myopencollective.com",
    siteName: "Open Collective",
    type: "website",
    images: [
      {
        url: "/villa/roca-llisa-og.jpg",
        width: 1200,
        height: 630,
        alt: "Roca Llisa — a private estate above the Ibiza coast",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Open Collective",
    description: "A private members network. By invitation.",
    images: ["/villa/roca-llisa-og.jpg"],
  },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#07100e",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${cormorant.variable} ${figtree.variable}`}>
      <body>{children}</body>
    </html>
  );
}
