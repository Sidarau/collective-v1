import Link from "next/link";
import { MobileShell, PageTitle } from "@/components/shell/MobileShell";
import { getProvider, parseScenario } from "@/data/provider";
import type { PageArgs } from "@/lib/page-params";
import { ResultBoundary } from "@/components/templates/ResultBoundary";
import { GateRow } from "@/components/rows/rows";
import { Section } from "@/components/templates/templates";

export const dynamic = "force-dynamic";

export default async function GatesPage({ searchParams }: PageArgs) {
  const sp = await searchParams;
  const provider = getProvider(parseScenario(sp.scenario));
  const [gates, spaces] = await Promise.all([provider.listGates(), provider.listSpaces()]);

  return (
    <MobileShell>
      <PageTitle
        title="Gates"
        subtitle="Curated access pathways"
        backHref="/more"
      />

      <Section title="Access pathways">
        <ResultBoundary
          result={gates}
          emptyTitle="No Gates yet"
          emptyBody="A Gate is a curated access pathway, program or offering."
        >
          {(rows) => (
            <ul className="list">
              {rows.map((g) => (
                <GateRow key={g.id} gate={g} />
              ))}
            </ul>
          )}
        </ResultBoundary>
      </Section>

      <Section
        title="Spaces"
        action={
          <Link href="/spaces" style={{ color: "var(--color-champagne)", fontSize: "var(--text-meta)" }}>
            All Spaces
          </Link>
        }
      >
        <ResultBoundary result={spaces} emptyTitle="No Spaces" emptyBody="Spaces appear here once added.">
          {(rows) => (
            <ul className="list">
              {rows.slice(0, 3).map((s) => (
                <li key={s.id}>
                  <Link href={`/spaces/${s.id}`} className="row">
                    <span className="row__body">
                      <span className="row__title">{s.name}</span>
                      <span className="row__detail">{s.summary}</span>
                    </span>
                    <span className="row__trailing">
                      <span className="status status--neutral tnum">{s.utilizationPct}%</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </ResultBoundary>
      </Section>
    </MobileShell>
  );
}
