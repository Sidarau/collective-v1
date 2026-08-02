"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Transaction } from "@/data/contracts";
import { directionLabel, formatMoney } from "@/lib/money";
import { formatDayShort } from "@/lib/time";
import {
  ActivityTimeline,
  RecordDetailScreen,
  Section,
} from "@/components/templates/templates";
import { Banner, PrimaryButton, SecondaryButton } from "@/components/ui/primitives";
import { ConfirmSheet } from "@/components/sheets/ConfirmSheet";
import { AddNoteButton, AuditTrailButton } from "@/components/sheets/RecordActionButtons";
import { settleContributionAction } from "@/app/actions";

type Pending = "received" | "comp";

export function TransactionDetailClient({ transaction }: { transaction: Transaction }) {
  const router = useRouter();
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const outstanding = transaction.settlement === "outstanding";
  // Outstanding rows carry the booking id; recorded payments carry a payment id.
  const bookingId = transaction.id.startsWith("tx-due-") ? transaction.id.slice("tx-due-".length) : null;

  const run = async () => {
    if (!pending || !bookingId || busy) return;
    setBusy(true);
    const result = await settleContributionAction({ bookingId, mode: pending });
    setBusy(false);
    setDone(result.message);
    setPending(null);
    if (result.ok) router.refresh();
  };

  const facts = [
    {
      icon: "euro",
      label: "Amount",
      value: formatMoney(transaction.amountMinor, transaction.currency),
    },
    { icon: "arrow-left", label: "Direction", value: directionLabel(transaction.direction) },
    { icon: "calendar-range", label: "Date", value: formatDayShort(transaction.at) },
    { icon: "info", label: "Settlement", value: transaction.state.label },
  ];

  return (
    <>
      {done ? (
        <div style={{ marginBottom: 12 }}>
          <Banner tone="success">{done}</Banner>
        </div>
      ) : null}

      <RecordDetailScreen
        title={transaction.title}
        subtitle={transaction.personName}
        backHref="/dues"
        state={transaction.state}
        facts={facts}
        primaryAction={
          outstanding && bookingId ? (
            <PrimaryButton block onClick={() => setPending("received")} data-testid="primary-action">
              Record as received
            </PrimaryButton>
          ) : undefined
        }
        secondaryActions={
          <>
            {outstanding && bookingId ? (
              <SecondaryButton style={{ flex: 1 }} onClick={() => setPending("comp")} data-testid="comp-action">
                Comp
              </SecondaryButton>
            ) : null}
            <AddNoteButton refId={transaction.id} flex />
            <AuditTrailButton refId={transaction.id} flex />
          </>
        }
      >
        <Section title="What this is">
          <p style={{ fontSize: "var(--text-body)", color: "var(--color-ink-dim)", margin: 0 }}>
            {transaction.detail}
            {transaction.settlement === "forecast"
              ? " — this is a projection and has not been received."
              : ""}
          </p>
        </Section>

        <Section title="History">
          <ActivityTimeline entries={transaction.activity} />
        </Section>
      </RecordDetailScreen>

      <ConfirmSheet
        open={Boolean(pending)}
        onClose={() => setPending(null)}
        onConfirm={() => void run()}
        title={
          pending === "comp"
            ? `Comp ${formatMoney(transaction.amountMinor, transaction.currency)}?`
            : "Record this contribution as received?"
        }
        confirmLabel={pending === "comp" ? "Comp it" : "Record"}
        facts={[
          {
            icon: "euro",
            label: "Amount",
            value: formatMoney(transaction.amountMinor, transaction.currency),
          },
          { icon: "person", label: "Party", value: transaction.personName ?? "—" },
          { icon: "calendar-range", label: "Date", value: formatDayShort(transaction.at) },
          {
            icon: "info",
            label: "Effect",
            value: pending === "comp" ? "Outstanding → comped, no money moves" : "Marked received",
          },
        ]}
      />
    </>
  );
}
