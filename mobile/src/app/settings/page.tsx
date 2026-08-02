import { MobileShell, PageTitle } from "@/components/shell/MobileShell";
import { requireOperator } from "@/lib/guard";
import { getProvider, parseScenario } from "@/data/provider";
import type { PageArgs } from "@/lib/page-params";
import { ResultBoundary } from "@/components/templates/ResultBoundary";
import { SettingsRows } from "@/components/templates/templates";

export const dynamic = "force-dynamic";

export default async function SettingsPage({ searchParams }: PageArgs) {
  await requireOperator();
  const sp = await searchParams;
  const settings = await getProvider(parseScenario(sp.scenario)).getSettings();

  return (
    <MobileShell>
      <PageTitle title="Settings" backHref="/more" />

      <ResultBoundary
        result={settings}
        emptyTitle="No settings available"
        emptyBody="Operator preferences will appear here."
      >
        {(groups) =>
          groups.map((g) => (
            <section className="group" key={g.id}>
              <h2 className="group__label">{g.label}</h2>
              <div className="group__panel">
                <ul className="list">
                  <SettingsRows group={g} />
                </ul>
              </div>
            </section>
          ))
        }
      </ResultBoundary>
    </MobileShell>
  );
}
