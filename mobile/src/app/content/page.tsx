import { MobileShell, PageTitle } from "@/components/shell/MobileShell";
import { getProvider, parseScenario } from "@/data/provider";
import type { PageArgs } from "@/lib/page-params";
import { ResultBoundary } from "@/components/templates/ResultBoundary";
import { NavRow, StatusText } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

export default async function ContentPage({ searchParams }: PageArgs) {
  const sp = await searchParams;
  const content = await getProvider(parseScenario(sp.scenario)).listContent();

  return (
    <MobileShell>
      <PageTitle title="Content" subtitle="Public pages and media" backHref="/more" />

      <section className="group">
        <h2 className="group__label">Published surfaces</h2>
        <div className="group__panel">
          <ResultBoundary
            result={content}
            emptyTitle="No content yet"
            emptyBody="Gate pages, Space profiles and listings appear here."
          >
            {(items) => (
              <ul className="list">
                {items.map((c) => (
                  <NavRow
                    key={c.id}
                    label={c.title}
                    detail={c.detail}
                    trailing={<StatusText label={c.state.label} tone={c.state.tone} />}
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
