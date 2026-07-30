/**
 * Home-screen install — detection and the nagging policy.
 *
 * Pure functions with no DOM access, so the branch table is tested rather than
 * discovered on someone's phone. `AddToHomeScreen.tsx` supplies the readings.
 *
 * The whole feature exists because iOS has no `beforeinstallprompt`: Safari
 * will not let a page ask to be installed, so the only route to a standalone
 * app is teaching the gesture. That means the copy has to name the real
 * control the user is looking at, which is why the browser families below are
 * separated instead of collapsed into "iOS".
 */

export type InstallPlatform =
  /** Safari proper — Share lives in the toolbar and Add to Home Screen works. */
  | { kind: "ios-safari" }
  /** Chrome/Firefox/Edge/Opera on iOS — same engine, different share menu. */
  | { kind: "ios-other"; browser: string }
  /** An app's embedded browser. Cannot install at all; must escape to Safari. */
  | { kind: "ios-webview" }
  /** Not iOS, or already running from the home screen. */
  | { kind: "unsupported" };

export type InstallState = {
  /** How many times the prompt has been shown and dismissed. */
  dismissals: number;
  /** Epoch ms before which the prompt stays quiet. */
  snoozedUntil: number | null;
  /** Set once the app has been seen running standalone — then never prompt. */
  installed: boolean;
};

export const INSTALL_STORAGE_KEY = "oc.a2hs.v1";

export const EMPTY_INSTALL_STATE: InstallState = {
  dismissals: 0,
  snoozedUntil: null,
  installed: false,
};

const DAY = 86_400_000;

/**
 * Escalating quiet periods. A third dismissal is an answer, not a coincidence,
 * so the prompt retires permanently rather than asking a fourth time.
 */
const SNOOZE_LADDER = [7 * DAY, 30 * DAY];

export function snoozeFor(dismissals: number): number | null {
  const step = SNOOZE_LADDER[dismissals - 1];
  return step ?? null;
}

export function isRetired(state: InstallState): boolean {
  return state.installed || state.dismissals > SNOOZE_LADDER.length;
}

/** Branded iOS browsers, in the order their tokens appear in a UA string. */
const IOS_BROWSERS: ReadonlyArray<readonly [token: string, label: string]> = [
  ["CriOS", "Chrome"],
  ["FxiOS", "Firefox"],
  ["EdgiOS", "Edge"],
  ["OPiOS", "Opera"],
  ["OPT/", "Opera"],
  ["DuckDuckGo", "DuckDuckGo"],
  ["Brave", "Brave"],
];

/**
 * Embedded browsers that ship no Add to Home Screen entry. Detected by name
 * because the generic heuristic below cannot separate them from Safari alone.
 */
const WEBVIEW_MARKERS = [
  "FBAN",
  "FBAV",
  "FB_IAB",
  "Instagram",
  "LinkedInApp",
  "Twitter",
  "MicroMessenger",
  "Snapchat",
  "TikTok",
  "musical_ly",
  "Line/",
  "GSA/",
  "Pinterest",
];

export type PlatformReading = {
  userAgent: string;
  /** navigator.platform — iPadOS 13+ reports "MacIntel" and hides the iPad. */
  platform: string;
  maxTouchPoints: number;
  /** navigator.standalone || matchMedia("(display-mode: standalone)"). */
  standalone: boolean;
};

export function isIOS(reading: PlatformReading): boolean {
  if (/iPad|iPhone|iPod/.test(reading.userAgent)) return true;
  // iPadOS 13+ requests desktop sites by default and claims to be a Mac. A Mac
  // with touch points is, so far, always an iPad.
  return reading.platform === "MacIntel" && reading.maxTouchPoints > 1;
}

export function detectPlatform(reading: PlatformReading): InstallPlatform {
  if (reading.standalone) return { kind: "unsupported" };
  if (!isIOS(reading)) return { kind: "unsupported" };

  const ua = reading.userAgent;

  // Branded browsers first: Chrome on iOS carries "Safari/" in its UA but no
  // "Version/", so the webview heuristic would otherwise claim it.
  const branded = IOS_BROWSERS.find(([token]) => ua.includes(token));
  if (branded) return { kind: "ios-other", browser: branded[1] };

  if (WEBVIEW_MARKERS.some((marker) => ua.includes(marker))) return { kind: "ios-webview" };

  // Safari stamps its marketing version; WKWebView embedders do not.
  if (!ua.includes("Version/")) return { kind: "ios-webview" };

  return { kind: "ios-safari" };
}

/** True when the prompt is allowed to appear at all on this platform. */
export function canPrompt(platform: InstallPlatform): boolean {
  return platform.kind !== "unsupported";
}

export function shouldPrompt(
  platform: InstallPlatform,
  state: InstallState,
  now: number,
): boolean {
  if (!canPrompt(platform)) return false;
  if (isRetired(state)) return false;
  if (state.snoozedUntil !== null && now < state.snoozedUntil) return false;
  return true;
}

/** The state to persist after the user dismisses the prompt. */
export function afterDismiss(state: InstallState, now: number): InstallState {
  const dismissals = state.dismissals + 1;
  const step = snoozeFor(dismissals);
  return {
    ...state,
    dismissals,
    snoozedUntil: step === null ? null : now + step,
  };
}

export function parseInstallState(raw: string | null): InstallState {
  if (!raw) return EMPTY_INSTALL_STATE;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return EMPTY_INSTALL_STATE;
    const record = parsed as Record<string, unknown>;
    return {
      dismissals: typeof record.dismissals === "number" ? record.dismissals : 0,
      snoozedUntil: typeof record.snoozedUntil === "number" ? record.snoozedUntil : null,
      installed: record.installed === true,
    };
  } catch {
    // A corrupt value must not suppress the prompt forever.
    return EMPTY_INSTALL_STATE;
  }
}
