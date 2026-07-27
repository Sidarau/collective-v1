import { MobileShell, PageTitle } from "@/components/shell/MobileShell";
import { getProvider, parseScenario } from "@/data/provider";
import type { PageArgs } from "@/lib/page-params";
import { formatDayShort } from "@/lib/time";
import { ResultBoundary } from "@/components/templates/ResultBoundary";
import { NavRow } from "@/components/ui/primitives";
import { SearchField } from "@/components/ui/forms";

export const dynamic = "force-dynamic";

export default async function KnowledgePage({ searchParams }: PageArgs) {
  const sp = await searchParams;
  const nodes = await getProvider(parseScenario(sp.scenario)).listKnowledge();

  return (
    <MobileShell>
      <PageTitle title="Knowledge base" subtitle="How the Collective operates" backHref="/more" />

      <div style={{ marginTop: 14 }}>
        <SearchField label="Search the knowledge base…" />
      </div>

      <section className="group">
        <h2 className="group__label">Procedures and standards</h2>
        <div className="group__panel">
          <ResultBoundary
            result={nodes}
            emptyTitle="Nothing written yet"
            emptyBody="Procedures, standards and policies will appear here."
          >
            {(items) => (
              <ul className="list">
                {items.map((n) => (
                  <NavRow
                    key={n.id}
                    label={n.title}
                    detail={`${n.detail} · updated ${formatDayShort(n.updatedAt)}`}
                  />
                ))}
              </ul>
            )}
          </ResultBoundary>
        </div>
      </section>
    </MobileShell>
  );
}
