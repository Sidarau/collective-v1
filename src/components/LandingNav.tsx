"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const NAV_ITEMS = [
  { href: "#about", label: "About" },
  { href: "#membership", label: "Membership" },
  { href: "#network", label: "The network" },
  { href: "#environments", label: "Environments" },
];

export function LandingNav() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  return (
    <header className="landing-nav" aria-label="Landing page navigation">
      <div className="landing-nav-shell">
        <a href="#top" className="landing-nav-wordmark" onClick={() => setOpen(false)}>
          Collective
        </a>

        <nav className="landing-nav-desktop" aria-label="Landing sections">
          {NAV_ITEMS.map((item) => (
            <a key={item.href} href={item.href}>
              {item.label}
            </a>
          ))}
          <Link href="/login" className="landing-nav-enter">
            Enter
          </Link>
        </nav>

        <button
          type="button"
          className={`landing-menu-button${open ? " is-open" : ""}`}
          aria-label={open ? "Close navigation" : "Open navigation"}
          aria-expanded={open}
          aria-controls="landing-mobile-menu"
          onClick={() => setOpen((value) => !value)}
        >
          <span />
          <span />
        </button>
      </div>

      <nav
        id="landing-mobile-menu"
        className={`landing-mobile-menu${open ? " is-open" : ""}`}
        aria-label="Landing sections"
        aria-hidden={!open}
      >
        {NAV_ITEMS.map((item, index) => (
          <a key={item.href} href={item.href} onClick={() => setOpen(false)}>
            <span>0{index + 1}</span>
            {item.label}
          </a>
        ))}
        <Link href="/login" className="landing-mobile-enter" onClick={() => setOpen(false)}>
          Enter the Collective
        </Link>
      </nav>
    </header>
  );
}
