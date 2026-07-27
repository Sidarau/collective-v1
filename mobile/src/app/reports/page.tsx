import { MobileShell } from "@/components/shell/MobileShell";
import { getProvider, parseScenario } from "@/data/provider";
import type { PageArgs } from "@/lib/page-params";
import { MetricStrip } from "@/components/intel/Metrics";
import { IntelligenceScreen, Section } from "@/components/templates/templates";
import { ResultBoundary } from "@/components/templates/ResultBoundary";

export const dynamic = "force-dynamic";

export default async function ReportsPage({ searchParams }: PageArgs) {
  const sp = await searchParams;
  const reports = await getProvider(parseScenario(sp.scenario)).listReports();

  return (
    <MobileShell>
      <IntelligenceScreen title="Reports" subtitle="Where the Collective stands" backHref="/more">
        <ResultBoundary
          result={reports}
          emptyTitle="No reports yet"
          emptyBody="Reports appear once there is enough operating history."
          skeletonRows={4}
        >
          {(items) =>
            items.map((r) => (
              <Section key={r.id} title={`${r.title} · ${r.detail}`}>
                <MetricStrip metrics={r.metrics} columns={r.metrics.length >= 4 ? 4 : 2} />
              </Section>
            ))
          }
        </ResultBoundary>
      </IntelligenceScreen>
    </MobileShell>
  );
}
