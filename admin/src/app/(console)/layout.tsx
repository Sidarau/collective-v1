import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminUserWithPassword } from "@/lib/auth";

const NAV: [string, [string, string][]][] = [
  ["", [["Dashboard", "/"]]],
  [
    "Funnel",
    [
      ["Applications", "/applications"],
      ["Vendors & Staff", "/vendors"],
      ["Referral Links", "/referrals"],
      ["Schedule", "/schedule"],
    ],
  ],
  [
    "Operate",
    [
      ["Stay Requests", "/requests"],
      ["People", "/people"],
      ["Events", "/events"],
    ],
  ],
  [
    "House",
    [
      ["Gates & Rooms", "/gates"],
      ["Content", "/content"],
      ["Knowledge Base", "/kb"],
    ],
  ],
  [
    "System",
    [
      ["Communications", "/communications"],
      ["Agents & MCP", "/agents"],
      ["Settings", "/settings"],
    ],
  ],
];

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const user = await getAdminUserWithPassword();
  if (!user) redirect("/login");
  if (!user.hasPassword) redirect("/setup-password");

  const navSections = (
    <>
      {NAV.map(([section, items]) => (
        <div key={section || "root"}>
          {section && (
            <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-faint">
              {section}
            </p>
          )}
          <div className="flex flex-wrap gap-1 lg:block lg:space-y-0.5">
            {items.map(([label, href]) => (
              <Link key={href} href={href} className="focus-ring nav-link">
                {label}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </>
  );

  return (
    <div className="grid min-h-dvh grid-cols-1 lg:grid-cols-[248px_1fr]">
      <aside className="border-b border-line bg-white/[0.03] px-4 py-4 backdrop-blur-xl lg:border-b-0 lg:border-r lg:py-5">
        {/* Phone: brand row toggles the menu. Desktop: always open. */}
        <details className="group lg:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between px-2 [&::-webkit-details-marker]:hidden">
            <div>
              <p className="wordmark text-[13px] text-gold">Collective</p>
              <p className="mt-0.5 truncate text-xs text-muted">{user.email}</p>
            </div>
            <span className="rounded-[10px] border border-white/15 bg-white/[0.07] px-3.5 py-1.5 text-[12px] font-semibold text-ink/90 group-open:hidden">
              Menu
            </span>
            <span className="hidden rounded-[10px] border border-white/15 bg-white/[0.07] px-3.5 py-1.5 text-[12px] font-semibold text-ink/90 group-open:inline-block">
              Close
            </span>
          </summary>
          <nav className="mt-5 grid gap-4 pb-2 sm:grid-cols-2">{navSections}</nav>
        </details>

        <div className="hidden lg:block">
          <div className="px-2">
            <p className="wordmark text-[13px] text-gold">Collective</p>
            <h1 className="mt-1.5 text-[15px] font-semibold text-ink">Operator OS</h1>
            <p className="mt-1 truncate text-xs text-muted">{user.email}</p>
          </div>
          <nav className="mt-6 space-y-5">{navSections}</nav>
        </div>
      </aside>
      <main className="min-w-0">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-7">{children}</div>
      </main>
    </div>
  );
}
