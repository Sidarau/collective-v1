import { MobileShell, PageTitle } from "@/components/shell/MobileShell";
import { getProvider, parseScenario } from "@/data/provider";
import type { PageArgs } from "@/lib/page-params";
import { ResultBoundary } from "@/components/templates/ResultBoundary";
import { NavRow, StatusText } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

export default async function AgentsPage({ searchParams }: PageArgs) {
  const sp = await searchParams;
  const agents = await getProvider(parseScenario(sp.scenario)).listAgents();

  return (
    <MobileShell>
      <PageTitle title="Agents & MCP" subtitle="What may act on your behalf" backHref="/more" />

      <ResultBoundary
        result={agents}
        emptyTitle="No agents configured"
        emptyBody="Agents and MCP tool access will be listed here."
      >
        {(items) =>
          items.map((a) => (
            <section className="group" key={a.id}>
              <h2 className="group__label">{a.name}</h2>
              <div className="group__panel">
                <ul className="list">
                  <NavRow
                    label={a.detail}
                    trailing={<StatusText label={a.state.label} tone={a.state.tone} />}
                  />
                  {a.scopes.map((scope) => (
                    <li key={scope}>
                      <div className="row" style={{ cursor: "default", paddingInline: 14 }}>
                        <span className="row__body">
                          <span className="row__detail">{scope}</span>
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          ))
        }
      </ResultBoundary>
    </MobileShell>
  );
}
