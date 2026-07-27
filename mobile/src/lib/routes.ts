/**
 * Canonical route + navigation contract, transcribed from
 * admin/public/brand/mobile-ui/mobile-routes.json.
 *
 * `versionedPathAllowed: false` — there is no /v2 route in this application,
 * and `scripts/assert-no-v2.mjs` fails the build if one appears.
 */

export const HOST = "mobile.opencollective.app";

export type NavItem = { label: string; path: string; icon: string };

/** Only four persistent destinations are allowed. */
export const BOTTOM_NAVIGATION: NavItem[] = [
  { label: "Today", path: "/", icon: "calendar-days" },
  { label: "People", path: "/people", icon: "users-round" },
  { label: "Spaces", path: "/spaces", icon: "landmark" },
  { label: "More", path: "/more", icon: "ellipsis" },
];

export type ScreenTemplate =
  | "stream"
  | "queue"
  | "directory"
  | "record-detail"
  | "intelligence"
  | "settings-list";

export type RouteEntry = { path: string; screen: string; template: ScreenTemplate };

export const ROUTES: RouteEntry[] = [
  { path: "/", screen: "today", template: "stream" },
  { path: "/briefing", screen: "daily-numbers", template: "intelligence" },
  { path: "/requests", screen: "requests", template: "queue" },
  { path: "/requests/[id]", screen: "request-detail", template: "record-detail" },
  { path: "/spaces", screen: "spaces", template: "directory" },
  { path: "/spaces/[id]", screen: "space-operations", template: "record-detail" },
  { path: "/gates", screen: "gates", template: "directory" },
  { path: "/gates/[id]", screen: "gate-detail", template: "record-detail" },
  { path: "/dues", screen: "dues-and-forecast", template: "stream" },
  { path: "/dues/[id]", screen: "transaction-detail", template: "record-detail" },
  { path: "/experiences", screen: "experiences", template: "queue" },
  { path: "/experiences/[id]", screen: "experience-detail", template: "record-detail" },
  { path: "/people", screen: "people", template: "directory" },
  { path: "/people/[id]", screen: "person-360", template: "record-detail" },
  { path: "/vendors", screen: "vendors", template: "directory" },
  { path: "/vendors/[id]", screen: "vendor-detail", template: "record-detail" },
  { path: "/communications", screen: "communications", template: "queue" },
  { path: "/content", screen: "content", template: "settings-list" },
  { path: "/knowledge", screen: "knowledge", template: "directory" },
  { path: "/reports", screen: "reports", template: "intelligence" },
  { path: "/agents", screen: "agents-and-mcp", template: "settings-list" },
  { path: "/settings", screen: "settings", template: "settings-list" },
  { path: "/more", screen: "more", template: "settings-list" },
];

/** Top-level routes with no dynamic segment — used by the e2e nav sweep. */
export const TOP_LEVEL_ROUTES = ROUTES.filter((r) => !r.path.includes("[")).map(
  (r) => r.path,
);

export type TodayFilterKey = "all" | "requests" | "access" | "dues" | "experiences";

export const TODAY_FILTERS: { key: TodayFilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "requests", label: "Requests" },
  { key: "access", label: "Access" },
  { key: "dues", label: "Dues" },
  { key: "experiences", label: "Experiences" },
];

export function parseTodayFilter(value: string | string[] | undefined): TodayFilterKey {
  const raw = Array.isArray(value) ? value[0] : value;
  return TODAY_FILTERS.some((f) => f.key === raw) ? (raw as TodayFilterKey) : "all";
}

/** Which bottom-rail destination owns a given path. */
export function activeNavPath(pathname: string): string {
  if (pathname === "/") return "/";
  if (pathname.startsWith("/people")) return "/people";
  if (pathname.startsWith("/spaces")) return "/spaces";
  return "/more";
}
