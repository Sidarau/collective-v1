"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { AccessRequest, Result } from "@/data/contracts";
import { formatMoney } from "@/lib/money";
import { QueueScreen } from "@/components/templates/templates";
import { ResultBoundary } from "@/components/templates/ResultBoundary";
import { StatusText, PrimaryButton, SecondaryButton, Banner } from "@/components/ui/primitives";
import { DetailSheet } from "@/components/sheets/DetailSheet";
import { ConfirmSheet } from "@/components/sheets/ConfirmSheet";

type FilterKey = "all" | "applications" | "access" | "follow";

const FILTERS = [
  { key: "all" as const, label: "All" },
  { key: "applications" as const, label: "Applications" },
  { key: "access" as const, label: "Access requests" },
  { key: "follow" as const, label: "Follow-ups" },
];

const KIND_LABEL: Record<AccessRequest["kind"], string> = {
  application: "Application",
  access_request: "Access request",
  follow_up: "Follow-up",
};

export function RequestsClient({ requests }: { requests: Result<AccessRequest[]> }) {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [preview, setPreview] = useState<AccessRequest | null>(null);
  const [decision, setDecision] = useState<{ req: AccessRequest; approve: boolean } | null>(null);
  const [resolved, setResolved] = useState<string | null>(null);

  const rows =
    requests.status === "ok"
      ? requests.data.filter((r) =>
          filter === "all"
            ? true
            : filter === "applications"
              ? r.kind === "application"
              : filter === "access"
                ? r.kind === "access_request"
                : r.kind === "follow_up",
        )
      : [];

  const actionable = rows.filter((r) => r.state.tone !== "neutral").length;
  // Exactly one luminous selection per viewport.
  const focusedId = rows.find((r) => r.state.tone === "critical")?.id;

  return (
    <>
      {resolved ? (
        <div style={{ marginBottom: 12 }}>
          <Banner tone="success">{resolved}</Banner>
        </div>
      ) : null}

      <QueueScreen
        title="Requests"
        actionableCount={actionable}
        filters={FILTERS}
        filter={filter}
        onFilter={setFilter}
        searchLabel="Search people, gates, periods…"
        resultCount={rows.length}
      >
        <ResultBoundary
          result={requests}
          emptyTitle="No open requests"
          emptyBody="Applications and access requests will arrive here."
        >
          {() =>
            rows.length ? (
              <ul className="list">
                {rows.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      className={`row${r.id === focusedId ? " row--selected" : ""}`}
                      onClick={() => setPreview(r)}
                      data-testid="request-row"
                    >
                      <span className="row__icon" aria-hidden="true">
                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-ink-dim)" }}>
                          {r.avatarInitials}
                        </span>
                      </span>
                      <span className="row__body">
                        <span className="row__title">{r.personName}</span>
                        <span className="row__detail">
                          {KIND_LABEL[r.kind]}
                          {r.periodLabel ? ` · ${r.periodLabel}` : ""}
                        </span>
                      </span>
                      <span className="row__trailing">
                        <span className="row__trailing-stack">
                          {r.expectedContributionMinor ? (
                            <span className="status status--neutral tnum">
                              {formatMoney(r.expectedContributionMinor, r.currency)}
                            </span>
                          ) : null}
                          <StatusText label={r.state.label} tone={r.state.tone} />
                        </span>
                        <ChevronRight size={18} className="row__chev" aria-hidden="true" />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty-state__body" style={{ padding: "28px 0" }}>
                No requests in this filter.
              </p>
            )
          }
        </ResultBoundary>
      </QueueScreen>

      {/* Queue row preview; may promote to the full record. */}
      <DetailSheet
        open={Boolean(preview)}
        onClose={() => setPreview(null)}
        title={`Review ${KIND_LABEL[preview?.kind ?? "access_request"].toLowerCase()}`}
        state={preview?.state}
        facts={
          preview
            ? [
                { icon: "calendar-range", label: "Period", value: preview.periodLabel },
                { icon: "landmark", label: "Gate", value: preview.gateName },
                { icon: "person", label: "People", value: `${preview.personName} · ${preview.people}` },
                ...(preview.spaceName !== "—"
                  ? [{ icon: "residence", label: "Space", value: preview.spaceName }]
                  : []),
                ...(preview.expectedContributionMinor
                  ? [
                      {
                        icon: "euro",
                        label: "Expected contribution",
                        value: formatMoney(preview.expectedContributionMinor, preview.currency),
                      },
                    ]
                  : []),
              ]
            : []
        }
        actions={
          preview ? (
            <>
              <SecondaryButton
                onClick={() => setDecision({ req: preview, approve: false })}
                data-testid="decline-request"
              >
                Decline
              </SecondaryButton>
              <PrimaryButton
                onClick={() => setDecision({ req: preview, approve: true })}
                data-testid="approve-request"
              >
                Approve
              </PrimaryButton>
            </>
          ) : undefined
        }
      />

      {/* Admissions and money always pass through a review sheet. */}
      <ConfirmSheet
        open={Boolean(decision)}
        onClose={() => setDecision(null)}
        onConfirm={() => {
          if (!decision) return;
          setResolved(
            `${decision.approve ? "Approved" : "Declined"} ${decision.req.personName}. This is a local fixture change only.`,
          );
          setDecision(null);
          setPreview(null);
        }}
        title={
          decision
            ? `${decision.approve ? "Approve" : "Decline"} access request?`
            : ""
        }
        confirmLabel={decision?.approve ? "Approve" : "Decline"}
        destructive={decision ? !decision.approve : false}
        facts={
          decision
            ? [
                { icon: "person", label: "Person", value: decision.req.personName },
                { icon: "calendar-range", label: "Period", value: decision.req.periodLabel },
                { icon: "landmark", label: "Gate", value: decision.req.gateName },
                ...(decision.req.expectedContributionMinor
                  ? [
                      {
                        icon: "euro",
                        label: "Contribution",
                        value: formatMoney(
                          decision.req.expectedContributionMinor,
                          decision.req.currency,
                        ),
                      },
                    ]
                  : []),
              ]
            : []
        }
      />

      <p style={{ marginTop: 18 }}>
        <Link href="/more" style={{ color: "var(--color-ink-dim)", fontSize: "var(--text-meta)" }}>
          All operator modules
        </Link>
      </p>
    </>
  );
}
