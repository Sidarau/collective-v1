import { describe, expect, it } from "vitest";
import {
  EMPTY_INSTALL_STATE,
  afterDismiss,
  detectPlatform,
  isRetired,
  parseInstallState,
  shouldPrompt,
  type InstallState,
  type PlatformReading,
} from "@/lib/install";

/* Real user-agent strings — the branch table is only worth testing against
 * what phones actually send. */
const UA = {
  safari:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Mobile/15E148 Safari/604.1",
  chrome:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.6778.73 Mobile/15E148 Safari/604.1",
  firefox:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/133.0 Mobile/15E148 Safari/605.1.15",
  instagram:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/22C152 Instagram 361.0.0.25.88",
  facebook:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/22C152 [FBAN/FBIOS;FBAV/492.0.0.42.108]",
  ipadOS:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15",
  macSafari:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15",
  androidChrome:
    "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
};

const reading = (over: Partial<PlatformReading> = {}): PlatformReading => ({
  userAgent: UA.safari,
  platform: "iPhone",
  maxTouchPoints: 5,
  standalone: false,
  ...over,
});

/* ------------------------------------------------------------------ *
 * Platform detection
 * ------------------------------------------------------------------ */

describe("detectPlatform", () => {
  it("names Safari, where the gesture actually works", () => {
    expect(detectPlatform(reading())).toEqual({ kind: "ios-safari" });
  });

  it("separates branded iOS browsers before the webview heuristic", () => {
    // Both carry "Safari/" but no "Version/", so order is what saves them.
    expect(detectPlatform(reading({ userAgent: UA.chrome }))).toEqual({
      kind: "ios-other",
      browser: "Chrome",
    });
    expect(detectPlatform(reading({ userAgent: UA.firefox }))).toEqual({
      kind: "ios-other",
      browser: "Firefox",
    });
  });

  it("catches in-app browsers, which cannot install at all", () => {
    expect(detectPlatform(reading({ userAgent: UA.instagram })).kind).toBe("ios-webview");
    expect(detectPlatform(reading({ userAgent: UA.facebook })).kind).toBe("ios-webview");
  });

  it("sees through iPadOS claiming to be a Mac", () => {
    expect(
      detectPlatform(
        reading({ userAgent: UA.ipadOS, platform: "MacIntel", maxTouchPoints: 5 }),
      ),
    ).toEqual({ kind: "ios-safari" });
  });

  it("leaves a real Mac alone — same UA, no touch points", () => {
    expect(
      detectPlatform(
        reading({ userAgent: UA.macSafari, platform: "MacIntel", maxTouchPoints: 0 }),
      ).kind,
    ).toBe("unsupported");
  });

  it("ignores Android, which has its own install prompt", () => {
    expect(
      detectPlatform(reading({ userAgent: UA.androidChrome, platform: "Linux armv8l" })).kind,
    ).toBe("unsupported");
  });

  it("never prompts inside the installed app", () => {
    expect(detectPlatform(reading({ standalone: true })).kind).toBe("unsupported");
  });
});

/* ------------------------------------------------------------------ *
 * Nagging policy
 * ------------------------------------------------------------------ */

describe("prompt policy", () => {
  const now = 1_700_000_000_000;
  const safari = { kind: "ios-safari" } as const;

  it("shows on a first visit", () => {
    expect(shouldPrompt(safari, EMPTY_INSTALL_STATE, now)).toBe(true);
  });

  it("escalates the quiet period, then retires for good", () => {
    const first = afterDismiss(EMPTY_INSTALL_STATE, now);
    expect(first.snoozedUntil).toBe(now + 7 * 86_400_000);
    expect(shouldPrompt(safari, first, now + 86_400_000)).toBe(false);
    expect(shouldPrompt(safari, first, now + 8 * 86_400_000)).toBe(true);

    const second = afterDismiss(first, now);
    expect(second.snoozedUntil).toBe(now + 30 * 86_400_000);

    const third = afterDismiss(second, now);
    expect(isRetired(third)).toBe(true);
    // A third dismissal is an answer: no later date brings it back.
    expect(shouldPrompt(safari, third, now + 3_650 * 86_400_000)).toBe(false);
  });

  it("stays retired once the app has run standalone", () => {
    const installed: InstallState = { ...EMPTY_INSTALL_STATE, installed: true };
    expect(shouldPrompt(safari, installed, now)).toBe(false);
  });
});

/* ------------------------------------------------------------------ *
 * Stored state
 * ------------------------------------------------------------------ */

describe("parseInstallState", () => {
  it("treats missing and corrupt values as a first visit", () => {
    // A thrown parse here would suppress the prompt permanently.
    expect(parseInstallState(null)).toEqual(EMPTY_INSTALL_STATE);
    expect(parseInstallState("not json")).toEqual(EMPTY_INSTALL_STATE);
    expect(parseInstallState('"a string"')).toEqual(EMPTY_INSTALL_STATE);
    expect(parseInstallState("null")).toEqual(EMPTY_INSTALL_STATE);
  });

  it("round-trips a written state", () => {
    const state = afterDismiss(EMPTY_INSTALL_STATE, 1_700_000_000_000);
    expect(parseInstallState(JSON.stringify(state))).toEqual(state);
  });

  it("drops fields of the wrong type rather than trusting them", () => {
    expect(parseInstallState('{"dismissals":"9","snoozedUntil":"soon","installed":"yes"}')).toEqual(
      EMPTY_INSTALL_STATE,
    );
  });
});
