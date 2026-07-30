"use client";

/* eslint-disable @next/next/no-img-element -- The tile is the same 192px PNG
   iOS will save to the home screen, rendered at 52px. Routing it through
   /_next/image would change the URL the manifest and <link rel="apple-touch-icon">
   name, so the prompt would stop previewing the exact file it is asking for. */

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Compass, Link2, Share, SquarePlus, X } from "lucide-react";
import { useUiState } from "./UiStateProvider";
import {
  EMPTY_INSTALL_STATE,
  INSTALL_STORAGE_KEY,
  afterDismiss,
  detectPlatform,
  parseInstallIntent,
  parseInstallState,
  shouldPrompt,
  urlWithoutInstallParams,
  type InstallPlatform,
  type InstallState,
} from "@/lib/install";

/**
 * Time on screen before the prompt appears. Long enough that the operator has
 * looked at Today and formed an opinion; short enough to still be part of the
 * same arrival.
 */
const APPEAR_AFTER_MS = 3_500;

/**
 * A link opens the prompt sooner than an unprompted visit does: the member
 * followed it on purpose, so the wait only delays what they came for.
 */
const APPEAR_AFTER_INVITE_MS = 1_200;

function readStandalone(): boolean {
  const nav = window.navigator as Navigator & { standalone?: boolean };
  if (nav.standalone === true) return true;
  return window.matchMedia("(display-mode: standalone)").matches;
}

function readState(): InstallState {
  try {
    return parseInstallState(window.localStorage.getItem(INSTALL_STORAGE_KEY));
  } catch {
    // Private mode or a blocked origin — behave as a first visit, never throw.
    return EMPTY_INSTALL_STATE;
  }
}

function writeState(state: InstallState): void {
  try {
    window.localStorage.setItem(INSTALL_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Nothing to recover: the prompt simply reappears next visit.
  }
}

/**
 * Teaches the iOS home-screen gesture.
 *
 * Safari exposes no install API — `beforeinstallprompt` is Chromium-only — so
 * this cannot be a button that installs the app. It is a coach mark: it names
 * the two controls, points at where the first one lives, and then gets out of
 * the way for a week.
 */
export function AddToHomeScreen() {
  /**
   * One state, not an `open` flag beside a `platform`: the detection result is
   * read once from the DOM and never changes, so holding it separately would
   * mean a setState in the effect body and a cascading render. Non-null means
   * open, and the only write happens inside the timer callback below.
   */
  const [prompt, setPrompt] = useState<InstallPlatform | null>(null);
  /** Who shared the link, when the operator arrived through one. */
  const [inviter, setInviter] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const { pushFocus, popFocus, focusDepth } = useUiState();

  /* Read inside the timer without re-arming it on every sheet open/close. */
  const focusDepthRef = useRef(focusDepth);
  useEffect(() => {
    focusDepthRef.current = focusDepth;
  }, [focusDepth]);

  /* Decide once per mount, then wait out the delay. */
  useEffect(() => {
    const intent = parseInstallIntent(window.location.search);

    if (intent.mode === "reset") {
      try {
        window.localStorage.removeItem(INSTALL_STORAGE_KEY);
      } catch {
        /* nothing to clear */
      }
    }

    // Drop the params before anything else can act on them: the standalone
    // branch below returns early, and an installed app must not keep an
    // invitation in the URL it relaunches from.
    if (intent.mode) {
      window.history.replaceState(
        window.history.state,
        "",
        urlWithoutInstallParams(window.location.href),
      );
    }

    const standalone = readStandalone();
    if (standalone) {
      // Running from the home screen is the end state: record it so the prompt
      // never returns, even when the same phone later opens the site in Safari.
      const state = readState();
      if (!state.installed) writeState({ ...state, installed: true });
      return;
    }

    const detected = detectPlatform({
      userAgent: window.navigator.userAgent,
      platform: window.navigator.platform,
      maxTouchPoints: window.navigator.maxTouchPoints,
      standalone,
    });

    // An invitation was sent to this member deliberately, so it outranks the
    // snooze ladder — but not `installed`, which the standalone branch above
    // has already returned on.
    const invited = intent.mode === "invite";
    const forced = intent.mode === "show";
    const bypass = invited || forced;
    if (!bypass && !shouldPrompt(detected, readState(), Date.now())) return;
    if (invited && readState().installed) return;

    // `?a2hs=show` on a desktop browser still gets the Safari copy, so the
    // prompt can be reviewed and screenshotted away from a phone.
    const target: InstallPlatform =
      forced && detected.kind === "unsupported" ? { kind: "ios-safari" } : detected;
    if (target.kind === "unsupported") return;

    let stopWaiting: (() => void) | undefined;

    const show = () => {
      // A prompt that lands on top of an open sheet interrupts real work. The
      // next route change re-arms this, so skipping costs nothing.
      if (focusDepthRef.current > 0) return;
      setInviter(intent.from);
      setPrompt(target);
    };

    const timer = window.setTimeout(
      () => {
        // `?a2hs=show` is someone asking to see it right now — screenshots and
        // review happen in tabs the platform may already call hidden.
        if (forced || document.visibilityState === "visible") {
          show();
          return;
        }
        // Animating into a background tab spends the whole entrance before
        // anyone is looking, so hold it until the operator is actually here.
        const onVisible = () => {
          if (document.visibilityState !== "visible") return;
          stopWaiting?.();
          show();
        };
        document.addEventListener("visibilitychange", onVisible);
        stopWaiting = () => document.removeEventListener("visibilitychange", onVisible);
      },
      forced ? 400 : invited ? APPEAR_AFTER_INVITE_MS : APPEAR_AFTER_MS,
    );

    return () => {
      window.clearTimeout(timer);
      stopWaiting?.();
    };
  }, []);

  /* Blur the wallpaper behind the glass, as every other overlay does. */
  useEffect(() => {
    if (!prompt) return;
    pushFocus();
    return () => popFocus();
  }, [prompt, pushFocus, popFocus]);

  const dismiss = useCallback(() => {
    setPrompt(null);
    writeState(afterDismiss(readState(), Date.now()));
  }, []);

  /* Escape closes; Tab stays inside the card while it is up. */
  useEffect(() => {
    if (!prompt) return;

    openerRef.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    panel?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        dismiss();
        return;
      }
      if (e.key !== "Tab" || !panel) return;

      const items = Array.from(
        panel.querySelectorAll<HTMLElement>("button:not([disabled])"),
      ).filter((el) => el.offsetParent !== null);
      if (!items.length) return;

      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      openerRef.current?.focus?.();
    };
  }, [prompt, dismiss]);

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2_000);
    } catch {
      // Clipboard is permission-gated in some embedded browsers; the URL is
      // still visible in the address bar, so this is a convenience only.
    }
  }, []);

  if (!prompt) return null;
  if (typeof document === "undefined") return null;

  const webview = prompt.kind === "ios-webview";

  return createPortal(
    <>
      <div className="a2hs-scrim" onClick={dismiss} aria-hidden="true" />
      <div
        ref={panelRef}
        className="a2hs"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        data-testid="add-to-home-screen"
      >
        <div className="a2hs__head">
          <span className="a2hs__mark" aria-hidden="true">
            {/* The same file the home screen will show, so the prompt is a
                preview of its own outcome. */}
            <img src="/icons/icon-192.png" alt="" width={52} height={52} />
          </span>
          <span className="a2hs__heading">
            <span id={titleId} className="a2hs__title display">
              {webview ? "Open in Safari" : "Add to Home Screen"}
            </span>
            <span className="a2hs__sub">
              {/* The inviter's name is the one piece of this card that came
                  from a URL. It is length-capped and shape-checked in
                  `sanitizeInviter`, and only ever fills this slot — it can
                  never become the title or an instruction. */}
              {inviter
                ? `${inviter} shared this with you`
                : webview
                  ? "This browser cannot install apps"
                  : "Full screen, no address bar"}
            </span>
          </span>
          {/* "Close", not "Not now": the footer button already carries that
              name, and two controls announcing the same label is noise. */}
          <button type="button" className="icon-btn a2hs__close" onClick={dismiss} aria-label="Close">
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {webview ? (
          <ol className="a2hs__steps">
            <li className="a2hs__step" style={{ "--i": 0 } as React.CSSProperties}>
              <span className="a2hs__num tnum" aria-hidden="true">
                1
              </span>
              <span className="a2hs__copy">
                Open this page in Safari
                <Compass className="a2hs__glyph" size={19} strokeWidth={1.7} aria-hidden="true" />
              </span>
            </li>
            <li className="a2hs__step" style={{ "--i": 1 } as React.CSSProperties}>
              <span className="a2hs__num tnum" aria-hidden="true">
                2
              </span>
              <span className="a2hs__copy">
                Then use Share → <strong>Add to Home Screen</strong>
              </span>
            </li>
          </ol>
        ) : (
          <ol className="a2hs__steps">
            <li className="a2hs__step" style={{ "--i": 0 } as React.CSSProperties}>
              <span className="a2hs__num tnum" aria-hidden="true">
                1
              </span>
              <span className="a2hs__copy">
                Tap
                <Share
                  className="a2hs__glyph a2hs__glyph--share"
                  size={19}
                  strokeWidth={1.7}
                  aria-hidden="true"
                />
                {prompt.kind === "ios-safari" ? "in the Safari toolbar" : "in the browser toolbar"}
              </span>
            </li>
            <li className="a2hs__step" style={{ "--i": 1 } as React.CSSProperties}>
              <span className="a2hs__num tnum" aria-hidden="true">
                2
              </span>
              <span className="a2hs__copy">
                Choose
                <SquarePlus className="a2hs__glyph" size={19} strokeWidth={1.7} aria-hidden="true" />
                <strong>Add to Home Screen</strong>
              </span>
            </li>
          </ol>
        )}

        <div className="a2hs__foot">
          {webview ? (
            <button type="button" className="btn btn--secondary a2hs__action" onClick={copyLink}>
              {copied ? (
                <Check size={16} strokeWidth={2} aria-hidden="true" />
              ) : (
                <Link2 size={16} strokeWidth={1.8} aria-hidden="true" />
              )}
              {copied ? "Link copied" : "Copy link"}
            </button>
          ) : (
            <button type="button" className="btn btn--quiet a2hs__action" onClick={dismiss}>
              Not now
            </button>
          )}
        </div>

        {webview ? null : (
          <span className="a2hs__pointer" aria-hidden="true">
            <svg viewBox="0 0 28 16" width="28" height="16" fill="none">
              <path
                d="M4 3.5 14 12.5 24 3.5"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        )}
      </div>
    </>,
    document.body,
  );
}
