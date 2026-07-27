import type { Metadata, Viewport } from "next";
import { Playfair_Display } from "next/font/google";
import "./globals.css";

/**
 * The UI face is the platform stack (SF Pro on iOS) and is never downloaded.
 * Only the display serif ships as a webfont, and it is reserved for Today,
 * major numbers, sheet titles and Collecta's name.
 */
const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-playfair",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://mobile.opencollective.app"),
  title: "Open Collective — Operator",
  description: "Phone-first operator surface for the Collective.",
  applicationName: "Open Collective",
  appleWebApp: {
    capable: true,
    title: "Open Collective",
    statusBarStyle: "black-translucent",
  },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#060D0B",
  width: "device-width",
  initialScale: 1,
  // Content must stay usable at 200% zoom, so scaling is never capped.
  maximumScale: 5,
  viewportFit: "cover",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={playfair.variable}>
      <head>
        {/* Preload the exact mark and Collecta portrait — MOBILE_UI_SPEC §11.
            Both are served as-is so these URLs match what the markup requests. */}
        <link rel="preload" as="image" href="/brand/keyhole.png" />
        <link rel="preload" as="image" href="/brand/collecta-avatar.png" />
        <link
          rel="preload"
          as="image"
          href="/brand/backgrounds/bg-today-forest-light.webp"
          type="image/webp"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
