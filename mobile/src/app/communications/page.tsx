import { MobileShell, PageTitle } from "@/components/shell/MobileShell";
import { getProvider, parseScenario } from "@/data/provider";
import type { PageArgs } from "@/lib/page-params";
import { ResultBoundary } from "@/components/templates/ResultBoundary";
import { CommunicationRow } from "@/components/rows/rows";

export const dynamic = "force-dynamic";

export default async function CommunicationsPage({ searchParams }: PageArgs) {
  const sp = await searchParams;
  const communications = await getProvider(parseScenario(sp.scenario)).listCommunications();

  const rows = communications.status === "ok" ? communications.data : [];
  const needsReview = rows.filter((c) => c.state.tone === "attention").length;

  return (
    <MobileShell>
      <PageTitle
        title="Communications"
        subtitle={rows.length ? `${needsReview} need review` : undefined}
        backHref="/more"
      />

      <div style={{ marginTop: 12 }}>
        <ResultBoundary
          result={communications}
          emptyTitle="Nothing to send"
          emptyBody="Announcements and direct messages appear here as drafts and sends."
        >
          {(items) => (
            <ul className="list">
              {items.map((c) => (
                <CommunicationRow key={c.id} item={c} />
              ))}
            </ul>
          )}
        </ResultBoundary>
      </div>
    </MobileShell>
  );
}
