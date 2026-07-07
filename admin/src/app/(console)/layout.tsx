import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/auth";

const NAV = [
  ["Dashboard", "/"],
  ["Applications", "/applications"],
  ["Stay Requests", "/requests"],
  ["People", "/people"],
  ["Gates", "/gates"],
  ["Events", "/events"],
  ["Communications", "/communications"],
  ["Settings", "/settings"],
] as const;

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const user = await getAdminUser();
  if (!user) redirect("/login");

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
        <nav className="mt-8 space-y-1">
          {NAV.map(([label, href]) => (
            <Link
              key={href}
              href={href}
              className="focus-ring block rounded-md px-3 py-2 text-sm text-muted hover:bg-white/5 hover:text-ink"
            >
              {label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="min-w-0 bg-base">
        <div className="mx-auto max-w-7xl px-8 py-7">{children}</div>
      </main>
    </div>
  );
}
