"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { UiStateProvider } from "./UiStateProvider";
import { AmbientScene } from "./AmbientScene";
import { BrandHeader } from "./BrandHeader";
import { BottomRail } from "./BottomRail";
import { FloatingStack } from "./FloatingStack";

/**
 * Every authenticated mobile route. Composes the three permitted blur layers
 * (top veil, bottom rail, open sheets) over the route-family wallpaper.
 */
export function MobileShell({
  children,
  showAdd = false,
  filter,
  flush = false,
  hero = false,
}: {
  children: React.ReactNode;
  /** AddFab belongs on Today, Experiences and Space detail. */
  showAdd?: boolean;
  filter?: string;
  flush?: boolean;
  /**
   * Today pins its own glass pane from the very top of the screen, so the
   * shell's veil must not paint a second surface over the same pixels.
   */
  hero?: boolean;
}) {
  return (
    <UiStateProvider>
      <AmbientScene />
      <div className="app-shell" data-hero={hero ? "true" : undefined}>
        <BrandHeader />
        <main
          className={`page-body${flush ? " page-body--flush" : ""}${
            hero ? " page-body--hero" : ""
          }`}
          id="main"
        >
          {children}
        </main>
        <FloatingStack showAdd={showAdd} filter={filter} />
        <BottomRail />
      </div>
    </UiStateProvider>
  );
}

/** Every non-Today top-level screen. */
export function PageTitle({
  title,
  subtitle,
  backHref,
  action,
}: {
  title: string;
  subtitle?: string;
  backHref?: string;
  action?: React.ReactNode;
}) {
  return (
    <header style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 4 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        {backHref ? (
          <Link href={backHref} className="back-link" aria-label="Back">
            <ArrowLeft size={20} aria-hidden="true" />
          </Link>
        ) : null}
        <h1 className="page-title">{title}</h1>
        {subtitle ? <p className="page-subtitle">{subtitle}</p> : null}
      </div>
      {action}
    </header>
  );
}
