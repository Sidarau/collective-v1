"use client";

import { useState } from "react";
import { FileText, Phone } from "lucide-react";
import type { AccessRequest } from "@/data/contracts";
import { formatMoney } from "@/lib/money";
import {
  ActivityTimeline,
  ChecklistTimeline,
  RecordDetailScreen,
  Section,
} from "@/components/templates/templates";
import {
  Banner,
  DestructiveButton,
  PrimaryButton,
  SecondaryButton,
} from "@/components/ui/primitives";
import { ConfirmSheet } from "@/components/sheets/ConfirmSheet";

export function RequestDetailClient({ request }: { request: AccessRequest }) {
  const [pending, setPending] = useState<null | "approve" | "handoff" | "decline">(null);
  const [done, setDone] = useState<string | null>(null);

  const facts = [
    { icon: "landmark", label: "Gate", value: request.gateName },
    { icon: "calendar-range", label: "Period", value: request.periodLabel },
    { icon: "person", label: "People", value: String(request.people) },
    ...(request.expectedContributionMinor
      ? [
          {
            icon: "euro",
            label: "Contribution",
            value: formatMoney(request.expectedContributionMinor, request.currency),
          },
        ]
      : [{ icon: "residence", label: "Space", value: request.spaceName }]),
  ];

  const label =
    pending === "decline"
      ? "Decline access request?"
      : pending === "handoff"
        ? "Begin access handoff?"
        : "Approve access request?";

  return (
    <>
      {done ? (
        <div style={{ marginBottom: 12 }}>
          <Banner tone="success">{done}</Banner>
        </div>
      ) : null}

      <RecordDetailScreen
        title={request.personName}
        subtitle={request.introducedBy ? `Introduced by ${request.introducedBy}` : request.spaceName}
        backHref="/requests"
        state={request.state}
        facts={facts}
        primaryAction={
          <PrimaryButton block onClick={() => setPending("handoff")} data-testid="primary-action">
            Begin access handoff
          </PrimaryButton>
        }
        secondaryActions={
          <>
            <SecondaryButton style={{ flex: 1 }}>
              <Phone size={17} aria-hidden="true" /> Contact person
            </SecondaryButton>
            <SecondaryButton style={{ flex: 1 }}>
              <FileText size={17} aria-hidden="true" /> View notes
            </SecondaryButton>
          </>
        }
        destructiveAction={
          <DestructiveButton block onClick={() => setPending("decline")}>
            Decline request
          </DestructiveButton>
        }
      >
        <Section title="Access handoff">
          <ChecklistTimeline items={request.checklist} />
        </Section>

        {request.notes ? (
          <Section title="Notes">
            <p style={{ fontSize: "var(--text-body)", color: "var(--color-ink-dim)" }}>
              {request.notes}
            </p>
          </Section>
        ) : null}

        <Section title="Activity">
          <ActivityTimeline entries={request.activity} />
        </Section>
      </RecordDetailScreen>

      <ConfirmSheet
        open={Boolean(pending)}
        onClose={() => setPending(null)}
        onConfirm={() => {
          setDone(
            pending === "decline"
              ? "Request declined. Fixture change only — nothing was written."
              : pending === "handoff"
                ? "Access handoff started. Fixture change only."
                : "Access approved. Fixture change only.",
          );
          setPending(null);
        }}
        title={label}
        confirmLabel={pending === "decline" ? "Decline" : pending === "handoff" ? "Begin" : "Approve"}
        destructive={pending === "decline"}
        facts={[
          { icon: "person", label: "Person", value: request.personName },
          { icon: "calendar-range", label: "Period", value: request.periodLabel },
          { icon: "landmark", label: "Gate", value: request.gateName },
        ]}
      />
    </>
  );
}
