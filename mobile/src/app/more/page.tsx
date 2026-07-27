import { MobileShell, PageTitle } from "@/components/shell/MobileShell";
import { getProvider, parseScenario } from "@/data/provider";
import type { PageArgs } from "@/lib/page-params";
import { ResultBoundary } from "@/components/templates/ResultBoundary";
import { NavRow } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

/** Every remaining operator module. No module is reachable only from desktop. */
export default async function MorePage({ searchParams }: PageArgs) {
  const sp = await searchParams;
  const groups = await getProvider(parseScenario(sp.scenario)).getMoreGroups();

  return (
    <MobileShell>
      <PageTitle title="More" subtitle="Every operator module" />

      <ResultBoundary
        result={groups}
        emptyTitle="Nothing to show"
        emptyBody="Operator modules will be listed here."
      >
        {(items) =>
          items.map((group) => (
            <section className="group" key={group.id}>
              <h2 className="group__label">{group.label}</h2>
              <div className="group__panel">
                <ul className="list">
                  {group.items.map((item) => (
                    <NavRow
                      key={item.id}
                      href={item.href}
                      icon={item.icon}
                      label={item.label}
                      badge={item.badge}
                    />
                  ))}
                </ul>
              </div>
            </section>
          ))
        }
      </ResultBoundary>

      <section className="group">
        <h2 className="group__label">Design</h2>
        <div className="group__panel">
          <ul className="list">
            <NavRow
              href="/design-system"
              icon="sparkles"
              label="Design system"
              detail="Living component gallery — not a production surface"
            />
          </ul>
        </div>
      </section>
    </MobileShell>
  );
}
