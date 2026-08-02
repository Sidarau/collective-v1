import { notFound } from "next/navigation";
import { requireOperator } from "@/lib/guard";
import Link from "next/link";
import { MobileShell } from "@/components/shell/MobileShell";
import { getProvider, parseScenario } from "@/data/provider";
import type { DetailPageArgs } from "@/lib/page-params";
import {
  ActivityTimeline,
  RecordDetailScreen,
  Section,
} from "@/components/templates/templates";
import { StatusText } from "@/components/ui/primitives";
import { PersonActions } from "./PersonActions";

export const dynamic = "force-dynamic";

export default async function PersonDetailPage({ params, searchParams }: DetailPageArgs) {
  await requireOperator();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const result = await getProvider(parseScenario(sp.scenario)).getPerson(id);

  if (result.status === "empty") notFound();
  if (result.status !== "ok") {
    return (
      <MobileShell>
        <p className="empty-state__body">This person could not be loaded.</p>
      </MobileShell>
    );
  }

  const person = result.data;

  return (
    <MobileShell>
      <RecordDetailScreen
        title={person.name}
        subtitle={person.summary}
        backHref="/people"
        state={person.state}
        facts={[
          { icon: "person", label: "Relationship", value: person.relationshipLabel },
          { icon: "euro", label: "Dues", value: person.duesLabel ?? "None due" },
          { icon: "key-round", label: "Upcoming access", value: String(person.upcomingAccess) },
          {
            icon: "experience",
            label: "Experiences",
            value: String(person.confirmedExperiences),
          },
        ]}
        primaryAction={undefined}
        secondaryActions={<PersonActions person={person} />}
      >
        <Section title="Standing">
          <ul className="facts">
            <li className="facts__item">
              <span className="facts__label">Dues status</span>
              <span className="facts__value">
                <StatusText
                  label={person.duesLabel ?? "Nothing outstanding"}
                  tone={person.duesTone ?? "healthy"}
                />
              </span>
            </li>
            {person.notes ? (
              <li className="facts__item">
                <span className="facts__label">Notes</span>
                <span className="facts__value">{person.notes}</span>
              </li>
            ) : null}
            <li className="facts__item">
              <span className="facts__label">Related access</span>
              <span className="facts__value">
                <Link href="/requests" style={{ color: "var(--color-champagne)" }}>
                  {person.upcomingAccess} upcoming
                </Link>
              </span>
            </li>
            <li className="facts__item">
              <span className="facts__label">Related experiences</span>
              <span className="facts__value">
                <Link href="/experiences" style={{ color: "var(--color-champagne)" }}>
                  {person.confirmedExperiences} confirmed
                </Link>
              </span>
            </li>
          </ul>
        </Section>

        <Section title="Relationship timeline">
          <ActivityTimeline entries={person.timeline} />
        </Section>
      </RecordDetailScreen>
    </MobileShell>
  );
}
