"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  {
    href: "/app",
    label: "Home",
    exact: true,
    icon: (
      <path d="M3 10.5 12 3l9 7.5M5 9.5V21h5v-6h4v6h5V9.5" />
    ),
  },
  {
    href: "/app/gates",
    label: "Gates",
    icon: (
      <path d="M12 21s-7-5.6-7-11a7 7 0 1 1 14 0c0 5.4-7 11-7 11Zm0-8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
    ),
  },
  {
    href: "/app/calendar",
    label: "Calendar",
    icon: (
      <path d="M7 2.5v3M17 2.5v3M3.5 8.5h17M5 4.5h14a1.5 1.5 0 0 1 1.5 1.5v13A1.5 1.5 0 0 1 19 20.5H5A1.5 1.5 0 0 1 3.5 19V6A1.5 1.5 0 0 1 5 4.5Z" />
    ),
  },
  {
    href: "/app/members",
    label: "Members",
    icon: (
      <path d="M16 19.5v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm13 8v-1a4 4 0 0 0-3-3.85M15 4.65a3.5 3.5 0 0 1 0 6.7" />
    ),
  },
  {
    href: "/app/exchange",
    label: "Exchange",
    icon: (
      <path d="M7 10 3 14l4 4M3 14h13M17 14l4-4-4-4M21 10H8" />
    ),
  },
];

export default function TabBar() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-4"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 14px)" }}
    >
      <div className="glass-strong flex w-full max-w-md items-stretch justify-between px-2 py-2">
        {TABS.map((tab) => {
          const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`tap flex flex-1 flex-col items-center gap-1 rounded-full py-1.5 ${
                active ? "text-champagne" : "text-ink/55"
              }`}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={active ? 1.9 : 1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-[22px] w-[22px]"
              >
                {tab.icon}
              </svg>
              <span className={`text-[10px] ${active ? "font-semibold" : "font-medium"}`}>
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
