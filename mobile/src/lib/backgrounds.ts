/**
 * Ambient background route mapping, transcribed from
 * admin/public/brand/mobile-ui/backgrounds/background-manifest.json.
 *
 * Detail screens inherit their parent family — the wallpaper must feel stable
 * as the operator moves through the app, so it is never per-record.
 */

export type BackgroundId = "today" | "access" | "dues" | "spaces";

export type BackgroundAsset = {
  id: BackgroundId;
  label: string;
  webp: string;
  png: string;
  objectPosition: string;
};

const BASE = "/brand/backgrounds";

export const BACKGROUNDS: Record<BackgroundId, BackgroundAsset> = {
  today: {
    id: "today",
    label: "Forest Light",
    webp: `${BASE}/bg-today-forest-light.webp`,
    png: `${BASE}/bg-today-forest-light.png`,
    objectPosition: "50% 50%",
  },
  access: {
    id: "access",
    label: "Glass Halo",
    webp: `${BASE}/bg-access-glass-halo.webp`,
    png: `${BASE}/bg-access-glass-halo.png`,
    objectPosition: "50% 50%",
  },
  dues: {
    id: "dues",
    label: "Champagne Satin",
    webp: `${BASE}/bg-dues-champagne-satin.webp`,
    png: `${BASE}/bg-dues-champagne-satin.png`,
    objectPosition: "50% 50%",
  },
  spaces: {
    id: "spaces",
    label: "Marine Refraction",
    webp: `${BASE}/bg-spaces-marine-refraction.webp`,
    png: `${BASE}/bg-spaces-marine-refraction.png`,
    objectPosition: "50% 50%",
  },
};

/** Runtime constants from the manifest's `runtime` block. */
export const BACKGROUND_RUNTIME = {
  baseScale: 1.08,
  scrollTravelPx: 24,
  pointerTravelPx: 6,
  scrollBlurMaxPx: 4,
  focusBlurPx: 12,
  routeTransitionMs: 700,
  focusTransitionMs: 420,
} as const;

/** Resolves the route family. Unknown routes fall back to Today. */
export function backgroundForPath(pathname: string): BackgroundAsset {
  if (
    pathname.startsWith("/dues") ||
    pathname.startsWith("/expenses") ||
    pathname.startsWith("/contributions") ||
    pathname.startsWith("/budget") ||
    pathname.startsWith("/transactions") ||
    pathname.startsWith("/reports")
  ) {
    return BACKGROUNDS.dues;
  }
  if (
    pathname.startsWith("/spaces") ||
    pathname.startsWith("/experiences")
  ) {
    return BACKGROUNDS.spaces;
  }
  if (
    pathname.startsWith("/requests") ||
    pathname.startsWith("/gates") ||
    pathname.startsWith("/people") ||
    pathname.startsWith("/vendors")
  ) {
    return BACKGROUNDS.access;
  }
  return BACKGROUNDS.today;
}
