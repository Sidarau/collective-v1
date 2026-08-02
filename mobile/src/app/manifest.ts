import type { MetadataRoute } from "next";

/**
 * Served at /manifest.webmanifest, which `middleware.ts` leaves public — a
 * manifest fetch that redirects to /login installs an app whose icon and name
 * are the login page's.
 *
 * iOS 16.4+ reads this; earlier iOS reads only the `appleWebApp` meta tags in
 * layout.tsx. Both must agree, so the name and colours here are the same values
 * the layout declares.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Open Collective — Operator",
    short_name: "Collective",
    description: "Phone-first operator surface for the Collective.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#060D0B",
    theme_color: "#060D0B",
    // No `orientation` lock: the operator surface must stay usable however the
    // phone is held, and at 200% zoom.
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
