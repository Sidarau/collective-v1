"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BOTTOM_NAVIGATION, activeNavPath } from "@/lib/routes";
import { iconFor } from "@/lib/icons";
import { RETURN_TO_PRESENT_EVENT } from "@/components/timeline/TimelineStream";

/** Four persistent destinations. Glass is limited to veil, rail and sheets. */
export function BottomRail() {
  const pathname = usePathname();
  const active = activeNavPath(pathname);

  return (
    <nav className="bottom-rail" aria-label="Primary">
      <div className="bottom-rail__inner">
        {BOTTOM_NAVIGATION.map((item) => {
          const Icon = iconFor(item.icon);
          const isActive = item.path === active;
          // Tapping Today while on Today returns to the present, keeping filters.
          const returnsToPresent = item.path === "/" && pathname === "/";

          return (
            <Link
              key={item.path}
              href={item.path}
              className="rail-item"
              aria-current={isActive ? "page" : undefined}
              data-testid={`rail-${item.label.toLowerCase()}`}
              onClick={(e) => {
                if (!returnsToPresent) return;
                e.preventDefault();
                window.dispatchEvent(new CustomEvent(RETURN_TO_PRESENT_EVENT));
              }}
            >
              <Icon size={22} strokeWidth={1.6} aria-hidden="true" />
              <span className="rail-item__label">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
