import "server-only";

/**
 * The single seam between the UI and its data.
 *
 * `getProvider()` is the one line Phase 2 replaces: an explicit `?scenario=`
 * (preview deploys only — see `page-params.ts`) returns the fixture provider;
 * anything else returns the live Supabase provider scoped to the caller's
 * session. Preview deploys keep serving fixtures to everyone, guarded deploys
 * never see a fixture unless Alex forces it locally.
 *
 * Client components (AccountSheet, CollectaSheet, LinkPickerSheet) must never
 * import this module — their reads go through server actions in
 * `src/app/actions.ts`. The design gallery uses `getFixtureProvider()`.
 */

import type { MobileDataProvider, Scenario } from "./contracts";
import { createFixtureProvider } from "./fixture-provider";
import { createLiveProvider } from "./live-provider";
import { scenarioAllowed } from "@/lib/page-params";

export { createFixtureProvider } from "./fixture-provider";
export { orderTimeline, presentIndex } from "./timeline";

/** The fixture provider — gallery and edge-state rendering. */
export function getFixtureProvider(scenario: Scenario = "healthy"): MobileDataProvider {
  return createFixtureProvider(scenario);
}

/** True when getProvider(scenario) would serve fixtures. Pages must anchor
 *  their "now" to FIXTURE_NOW in that case — anchoring fixture data to the
 *  real clock is the date-slide bug: a few weeks after the anchor the whole
 *  fixture stream lies in the past and the Today tests/e2e rot. */
export function usingFixtures(scenario: Scenario = "healthy"): boolean {
  if (!scenarioAllowed()) return false;
  if (scenario !== "healthy") return true;
  return !(process.env.MOBILE_DOGFOOD === "1" && process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);
}

/** Resolves the active provider. This is the seam.
 *
 * Two deploy shapes:
 *  - Guarded (MOBILE_AUTH_GUARD=enforced): always the live Supabase provider —
 *    the guard has already established the operator session, and no scenario
 *    flag can substitute fixtures for real data.
 *  - Preview (the public investor-demo deploy): fixtures by default so the
 *    demo is hermetic; an explicit ?scenario= switches edge states; real data
 *    only with an explicit MOBILE_DOGFOOD=1 plus Supabase credentials. */
export function getProvider(scenario: Scenario = "healthy"): MobileDataProvider {
  if (!usingFixtures(scenario)) {
    return createLiveProvider();
  }
  return createFixtureProvider(scenario);
}

/** Narrows an unknown search param to a Scenario. */
export function parseScenario(value: string | string[] | undefined): Scenario {
  const raw = Array.isArray(value) ? value[0] : value;
  const allowed: Scenario[] = ["healthy", "empty", "loading", "error", "offline", "busy"];
  return allowed.includes(raw as Scenario) ? (raw as Scenario) : "healthy";
}
