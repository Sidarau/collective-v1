"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Experience } from "@/data/contracts";
import { formatMoney } from "@/lib/money";
import { displayTime, formatDayShort } from "@/lib/time";
import { RecordDetailScreen, Section } from "@/components/templates/templates";
import { Banner, PrimaryButton } from "@/components/ui/primitives";
import { ConfirmSheet } from "@/components/sheets/ConfirmSheet";
import { AddNoteButton } from "@/components/sheets/RecordActionButtons";
import { publishExperienceAction } from "@/app/actions";

export function ExperienceDetailClient({ experience }: { experience: Experience }) {
  const router = useRouter();
  const [publishing, setPublishing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const time = displayTime(experience.startAt, experience.displayPrecision);
  const when = `${formatDayShort(experience.startAt)}${time ? ` · ${time}` : " · All day"}`;
  const budgetPct = experience.budgetTotalMinor
    ? Math.round((experience.budgetSpentMinor / experience.budgetTotalMinor) * 100)
    : 0;
  const capacityPct = experience.rsvpCapacity
    ? Math.round((experience.rsvpConfirmed / experience.rsvpCapacity) * 100)
    : 0;

  /** Publishing is a material change and always requires confirmation. */
  const publish = async () => {
    if (busy) return;
    setBusy(true);
    const result = await publishExperienceAction({
      eventId: experience.id.replace(/^exp-/, ""),
    });
    setBusy(false);
    setDone(result.message);
    setPublishing(false);
    if (result.ok) router.refresh();
  };

  return (
    <>
      {done ? (
        <div style={{ marginBottom: 12 }}>
          <Banner tone="success">{done}</Banner>
        </div>
      ) : null}

      <RecordDetailScreen
        title={experience.title}
        subtitle={`${when} · ${experience.spaceName}`}
        backHref="/experiences"
        state={experience.state}
        facts={[
          {
            icon: "person",
            label: "Capacity",
            value: `${experience.rsvpConfirmed}/${experience.rsvpCapacity}`,
          },
          { icon: "calendar-range", label: "When", value: when.split(" · ")[0] },
          { icon: "residence", label: "Space", value: experience.spaceName },
          {
            icon: "euro",
            label: "Budget",
            value: `${budgetPct}%`,
          },
        ]}
        primaryAction={
          experience.published ? undefined : (
            <PrimaryButton block onClick={() => setPublishing(true)} data-testid="primary-action">
              Publish
            </PrimaryButton>
          )
        }
        secondaryActions={<AddNoteButton refId={experience.id} flex />}
      >
        <Section title="About">
          <p style={{ fontSize: "var(--text-body)", color: "var(--color-ink-dim)", margin: 0 }}>
            {experience.summary}
          </p>
        </Section>

        <Section title="Capacity">
          <ul className="facts">
            <li className="facts__item">
              <span className="facts__label">Confirmed</span>
              <span className="facts__value">
                <span aria-hidden="true">
                  {experience.rsvpConfirmed} of {experience.rsvpCapacity}
                </span>
                <span className="sr-only">
                  {`${experience.rsvpConfirmed} of ${experience.rsvpCapacity} places confirmed, ${capacityPct} percent`}
                </span>
              </span>
            </li>
            <li className="facts__item">
              <span className="facts__label">Remaining</span>
              <span className="facts__value">
                {Math.max(0, experience.rsvpCapacity - experience.rsvpConfirmed)}
              </span>
            </li>
          </ul>
        </Section>

        <Section title="Budget">
          <ul className="facts">
            <li className="facts__item">
              <span className="facts__label">Spent</span>
              <span className="facts__value">
                {formatMoney(experience.budgetSpentMinor, experience.currency)} /{" "}
                {formatMoney(experience.budgetTotalMinor, experience.currency)}
              </span>
            </li>
            {experience.partner ? (
              <li className="facts__item">
                <span className="facts__label">Partner</span>
                <span className="facts__value">{experience.partner}</span>
              </li>
            ) : null}
            {experience.notes ? (
              <li className="facts__item">
                <span className="facts__label">Notes</span>
                <span className="facts__value">{experience.notes}</span>
              </li>
            ) : null}
          </ul>
        </Section>
      </RecordDetailScreen>

      {/* Publishing is a material change and always requires confirmation. */}
      <ConfirmSheet
        open={publishing}
        onClose={() => setPublishing(false)}
        onConfirm={() => void publish()}
        title={`Publish ${experience.title}?`}
        confirmLabel="Publish"
        facts={[
          { icon: "calendar-range", label: "When", value: when },
          { icon: "residence", label: "Space", value: experience.spaceName },
          { icon: "person", label: "Capacity", value: `${experience.rsvpCapacity} people` },
          { icon: "info", label: "Visible to", value: "All members" },
        ]}
      />
    </>
  );
}
