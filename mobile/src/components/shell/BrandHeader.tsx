"use client";

/* eslint-disable @next/next/no-img-element -- The mark is a fixed-size, already
   display-sized brand asset that must be preloaded at the exact URL named in
   <head>. Routing it through /_next/image would change the URL, invalidate the
   preload and add an optimizer round trip for a 12 KB image. */

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AccountSheet } from "@/components/sheets/AccountSheet";

/**
 * The measured transparent top veil. Timeline content passes visibly beneath
 * it. Height is measured once and published as `--veil-height` so page padding
 * never shifts after hydration.
 */
export function BrandHeader({ operatorInitials = "AS" }: { operatorInitials?: string }) {
  const ref = useRef<HTMLElement>(null);
  const [accountOpen, setAccountOpen] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const publish = () => {
      document.documentElement.style.setProperty(
        "--veil-height",
        `${Math.round(node.getBoundingClientRect().height)}px`,
      );
    };
    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  return (
    <header ref={ref} className="top-veil" data-testid="top-veil">
      <Link href="/" className="brand-lockup" aria-label="Open Collective — Today">
        {/* The exact canonical mark; the wordmark beside it is platform text. */}
        <img
          className="brand-lockup__mark"
          src="/brand/keyhole.png"
          alt=""
          width={27}
          height={30}
          decoding="async"
        />
        <span className="brand-lockup__word">Open Collective</span>
      </Link>

      <button
        type="button"
        className="user-avatar"
        aria-label="Your account"
        aria-haspopup="dialog"
        onClick={() => setAccountOpen(true)}
        data-testid="account-button"
      >
        <span className="user-avatar__disc" aria-hidden="true">
          {operatorInitials}
        </span>
      </button>

      <AccountSheet open={accountOpen} onClose={() => setAccountOpen(false)} />
    </header>
  );
}
