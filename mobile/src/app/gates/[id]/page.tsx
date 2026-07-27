import Link from "next/link";
import { notFound } from "next/navigation";
import { Check } from "lucide-react";
import { MobileShell } from "@/components/shell/MobileShell";
import { getProvider, parseScenario } from "@/data/provider";
import type { DetailPageArgs } from "@/lib/page-params";
import { RecordDetailScreen, Section } from "@/components/templates/templates";

export const dynamic = "force-dynamic";

export default async function GateDetailPage({ params, searchParams }: DetailPageArgs) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const provider = getProvider(parseScenario(sp.scenario));
  const [result, spacesResult] = await Promise.all([
    provider.getGate(id),
    provider.listSpaces(),
  ]);

  if (result.status === "empty") notFound();
  if (result.status !== "ok") {
    return (
      <MobileShell>
        <p className="empty-state__body">This Gate could not be loaded.</p>
      </MobileShell>
    );
  }

  const gate = result.data;
  const spaces =
    spacesResult.status === "ok"
      ? spacesResult.data.filter((s) => gate.spaceIds.includes(s.id))
      : [];

  return (
    <MobileShell>
      <RecordDetailScreen
        title={gate.name}
        subtitle={gate.summary}
        backHref="/gates"
        state={gate.state}
        facts={[
          { icon: "inbox", label: "Open requests", value: String(gate.openRequests) },
          { icon: "landmark", label: "Spaces", value: String(gate.spaceIds.length) },
          { icon: "key-round", label: "Rules", value: String(gate.accessRules.length) },
          { icon: "layout-grid", label: "Allocation", value: gate.allocationLabel.split(" ")[0] },
        ]}
        primaryAction={
          <Link href="/requests" className="btn btn--primary btn--block">
            Review access requests
          </Link>
        }
      >
        <Section title="Access rules">
          <ul className="list">
            {gate.accessRules.map((rule) => (
              <li key={rule}>
                <div className="row" style={{ cursor: "default" }}>
                  <span className="row__icon" aria-hidden="true">
                    <Check size={16} strokeWidth={2} />
                  </span>
                  <span className="row__body">
                    <span className="row__title">{rule}</span>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Allocation">
          <p style={{ fontSize: "var(--text-body)", color: "var(--color-ink-dim)", margin: 0 }}>
            {gate.allocationLabel}
          </p>
        </Section>

        {spaces.length ? (
          <Section title="Spaces reached through this Gate">
            <ul className="list">
              {spaces.map((s) => (
                <li key={s.id}>
                  <Link href={`/spaces/${s.id}`} className="row">
                    <span className="row__body">
                      <span className="row__title">{s.name}</span>
                      <span className="row__detail">{s.summary}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
        ) : null}
      </RecordDetailScreen>
    </MobileShell>
  );
}
