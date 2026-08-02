"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Share } from "lucide-react";
import { getOperatorAction } from "@/app/actions";
import { buildInstallLink, sanitizeInviter } from "@/lib/install";

/**
 * Generates a link that opens the app and raises the Add to Home Screen
 * prompt, then hands it to the OS share sheet.
 *
 * The point is the last part: an operator sending this to a member is already
 * in WhatsApp or Messages in their head, so the row ends in the native sheet
 * rather than in a text field they have to copy out of. Clipboard is the
 * fallback for browsers without `navigator.share` — desktop, mostly.
 */
export function InstallLinkRow() {
  const [name, setName] = useState<string | null>(null);
  const [done, setDone] = useState<"shared" | "copied" | null>(null);

  /* The signed-in operator's name rides along so the prompt can say who sent
     it. Failure is fine — the link works unattributed. */
  useEffect(() => {
    let cancelled = false;
    void getOperatorAction()
      .then((r) => {
        if (!cancelled && r.status === "ok") setName(sanitizeInviter(r.data.name));
      })
      .catch(() => {
        // Attribution is decoration: a failure here still produces a working
        // link, just an unsigned one. Nothing to surface to the operator.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const share = useCallback(async () => {
    const url = buildInstallLink({ origin: window.location.origin, from: name });
    const payload = {
      title: "Open Collective",
      text: "Add the Collective to your home screen",
      url,
    };

    if (typeof navigator.share === "function") {
      try {
        await navigator.share(payload);
        setDone("shared");
        window.setTimeout(() => setDone(null), 2_000);
        return;
      } catch {
        // Cancelling the share sheet rejects too, so fall through to the
        // clipboard rather than treating it as a failure worth reporting.
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setDone("copied");
      window.setTimeout(() => setDone(null), 2_000);
    } catch {
      /* nothing safe to fall back to */
    }
  }, [name]);

  return (
    <li>
      <button type="button" className="row" onClick={share} data-testid="share-install-link">
        <span className="row__icon" aria-hidden="true">
          {done ? <Check size={18} strokeWidth={2} /> : <Share size={18} strokeWidth={1.6} />}
        </span>
        <span className="row__body">
          <span className="row__title">Share install link</span>
          <span className="row__detail">
            {done === "shared"
              ? "Sent"
              : done === "copied"
                ? "Link copied"
                : "For a member on iPhone"}
          </span>
        </span>
      </button>
    </li>
  );
}
