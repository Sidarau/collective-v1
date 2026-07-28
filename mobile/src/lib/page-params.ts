/** Shared Next 16 route prop shapes — params and searchParams are Promises. */

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;
export type RouteParams<K extends string = "id"> = Promise<Record<K, string>>;

export type PageArgs = { searchParams: SearchParams };
export type DetailPageArgs = { params: RouteParams; searchParams: SearchParams };

export function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/* ------------------------------------------------------------------ *
 * Route guard — Phase 2
 *
 * The app is deployed in two shapes:
 *   • guarded  (mobile.opencollective.app) — MOBILE_AUTH_GUARD=enforced,
 *     every private route requires an admin/operator session.
 *   • preview  (fixture review deploys)    — guard unset, routes serve
 *     fixtures to anyone. `?scenario=` only ever works here; on a guarded
 *     deploy it is ignored so the edge states can never mask real data.
 *
 * The guard itself lives in `src/lib/guard.ts` (import "server-only") and in
 * `src/middleware.ts`; this module only holds the env logic so the fixture
 * unit tests can import it without pulling next-auth into vitest.
 * ------------------------------------------------------------------ */

export type GuardMode = "enforced" | "preview";

/** Reads the deployment shape from env. Anything but "enforced" is a preview. */
export function guardModeFromEnv(env: NodeJS.ProcessEnv = process.env): GuardMode {
  return env.MOBILE_AUTH_GUARD === "enforced" ? "enforced" : "preview";
}

export function isGuarded(): boolean {
  return guardModeFromEnv() === "enforced";
}

/**
 * Whether the `?scenario=` switch may influence the provider. Preview deploys
 * always allow it (design gallery + edge-state suite); guarded deploys never
 * do. The escape hatch is only for Alex running the gallery locally.
 */
export function scenarioAllowed(): boolean {
  return !isGuarded() || process.env.MOBILE_ALLOW_SCENARIOS === "1";
}
