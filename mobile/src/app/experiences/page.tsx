import { MobileShell, PageTitle } from "@/components/shell/MobileShell";
import { getProvider, parseScenario } from "@/data/provider";
import type { PageArgs } from "@/lib/page-params";
import { ResultBoundary } from "@/components/templates/ResultBoundary";
import { EventRow } from "@/components/rows/rows";

export const dynamic = "force-dynamic";

export default async function ExperiencesPage({ searchParams }: PageArgs) {
  const sp = await searchParams;
  const experiences = await getProvider(parseScenario(sp.scenario)).listExperiences();

  const rows = experiences.status === "ok" ? experiences.data : [];
  const needsPublishing = rows.filter((e) => !e.published).length;
  const subtitle = rows.length
    ? `${rows.length} upcoming${needsPublishing ? ` · ${needsPublishing} needs publishing` : ""}`
    : undefined;

  return (
    <MobileShell showAdd filter="experiences">
      <PageTitle title="Experiences" subtitle={subtitle} backHref="/more" />

      <div style={{ marginTop: 12 }}>
        <ResultBoundary
          result={experiences}
          emptyTitle="No experiences planned"
          emptyBody="Dinners, sessions and programming will appear here. Use + to add one."
        >
          {(items) => (
            <ul className="list">
              {items.map((e) => (
                <EventRow key={e.id} experience={e} />
              ))}
            </ul>
          )}
        </ResultBoundary>
      </div>
    </MobileShell>
  );
}
