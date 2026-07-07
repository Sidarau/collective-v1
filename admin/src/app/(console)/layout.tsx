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
      ["Settings", "/settings"],
    ],
  ],
];

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const user = await getAdminUserWithPassword();
  if (!user) redirect("/login");
  if (!user.hasPassword) redirect("/setup-password");

  return (
    <div className="grid min-h-dvh grid-cols-[240px_1fr]">
      <aside className="border-r border-line bg-panel px-4 py-5">
        <div className="px-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gold">
            Collective
          </p>
          <h1 className="mt-1 text-lg font-semibold text-ink">Operator OS</h1>
          <p className="mt-1 truncate text-xs text-muted">{user.email}</p>
        </div>
        <nav className="mt-6 space-y-4">
          {NAV.map(([section, items]) => (
            <div key={section || "root"}>
              {section && (
                <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-faint">
                  {section}
                </p>
              )}
              <div className="space-y-0.5">
                {items.map(([label, href]) => (
                  <Link
                    key={href}
                    href={href}
                    className="focus-ring block rounded-md px-3 py-1.5 text-sm text-muted hover:bg-white/5 hover:text-ink"
                  >
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>
      <main className="min-w-0 bg-base">
        <div className="mx-auto max-w-7xl px-8 py-7">{children}</div>
      </main>
    </div>
  );
}
