"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserRound } from "lucide-react";
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
import { AddNoteButton } from "@/components/sheets/RecordActionButtons";
import {
  completeFollowUpAction,
  decideAccessRequestAction,
  decideApplicationAction,
} from "@/app/actions";

type Pending = "approve" | "decline" | "handoff" | "done";

/** Prefixed detail ids → the real row id the server re-verifies. */
const rawId = (request: AccessRequest) => request.id.replace(/^req-(bk|app|fu)-/, "");

/** Healthy booking labels that mean "arrival is next" — the handoff state. */
const HANDOFF_LABELS = new Set(["Approved", "Deposit received", "Paid"]);

export function RequestDetailClient({ request }: { request: AccessRequest }) {
  const router = useRouter();
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const isApplication = request.kind === "application";
  const isFollowUp = request.kind === "follow_up";
  const needsDecision = request.state.tone === "attention"; // Needs review / New
  const handoffReady = request.kind === "access_request" && HANDOFF_LABELS.has(request.state.label);

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
      ? isApplication
        ? "Deny this application?"
        : "Decline access request?"
      : pending === "handoff"
        ? "Begin access handoff?"
        : pending === "done"
          ? "Mark this follow-up done?"
          : isApplication
            ? "Approve this application?"
            : "Approve access request?";

  const run = async () => {
    if (!pending || busy) return;
    setBusy(true);
    const id = rawId(request);
    const result =
      pending === "done"
        ? await completeFollowUpAction({ followUpId: id })
        : isApplication
          ? await decideApplicationAction({
              applicationId: id,
              decision: pending === "approve" ? "approve" : "deny",
            })
          : await decideAccessRequestAction({
              bookingId: id,
              decision:
                pending === "approve" ? "approve" : pending === "decline" ? "decline" : "confirm",
            });
    setBusy(false);
    setDone(result.message);
    setPending(null);
    if (result.ok) router.refresh();
  };

  const primaryAction = isFollowUp ? (
    <PrimaryButton block onClick={() => setPending("done")} data-testid="primary-action">
      Mark done
    </PrimaryButton>
  ) : needsDecision ? (
    <PrimaryButton block onClick={() => setPending("approve")} data-testid="primary-action">
      {isApplication ? "Approve application" : "Approve request"}
    </PrimaryButton>
  ) : handoffReady ? (
    <PrimaryButton block onClick={() => setPending("handoff")} data-testid="primary-action">
      Begin access handoff
    </PrimaryButton>
  ) : undefined;

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
        primaryAction={primaryAction}
        secondaryActions={
          <>
            <Link
              href={`/people/${request.personId}`}
              style={{ flex: 1, display: "flex" }}
              data-testid="contact-person"
            >
              <SecondaryButton style={{ flex: 1 }}>
                <UserRound size={17} aria-hidden="true" /> View person
              </SecondaryButton>
            </Link>
            <AddNoteButton refId={request.id} flex />
          </>
        }
        destructiveAction={
          needsDecision && !isFollowUp ? (
            <DestructiveButton block onClick={() => setPending("decline")}>
              {isApplication ? "Deny application" : "Decline request"}
            </DestructiveButton>
          ) : undefined
        }
      >
        {request.checklist.length ? (
          <Section title="Access handoff">
            <ChecklistTimeline items={request.checklist} />
          </Section>
        ) : null}

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
        onConfirm={() => void run()}
        title={label}
        confirmLabel={
          pending === "decline"
            ? isApplication
              ? "Deny"
              : "Decline"
            : pending === "handoff"
              ? "Begin"
              : pending === "done"
                ? "Mark done"
                : "Approve"
        }
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
