"use client";

import { useState } from "react";
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

export function TransactionDetailClient({ transaction }: { transaction: Transaction }) {
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const settled = transaction.settlement === "confirmed";

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
        facts={[
          {
            icon: "euro",
            label: "Amount",
            value: formatMoney(transaction.amountMinor, transaction.currency),
          },
          { icon: "arrow-left", label: "Direction", value: directionLabel(transaction.direction) },
          { icon: "calendar-range", label: "Date", value: formatDayShort(transaction.at) },
          { icon: "info", label: "Settlement", value: transaction.state.label },
        ]}
        primaryAction={
          settled ? undefined : (
            <PrimaryButton block onClick={() => setConfirming(true)} data-testid="primary-action">
              {transaction.direction === "incoming" ? "Record as received" : "Approve payment"}
            </PrimaryButton>
          )
        }
        secondaryActions={
          <>
            <SecondaryButton style={{ flex: 1 }}>Add note</SecondaryButton>
            <SecondaryButton style={{ flex: 1 }}>View audit trail</SecondaryButton>
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
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={() => {
          setDone("Recorded. Fixture change only — nothing was written.");
          setConfirming(false);
        }}
        title={
          transaction.direction === "incoming"
            ? "Record this contribution as received?"
            : "Approve this payment?"
        }
        confirmLabel={transaction.direction === "incoming" ? "Record" : "Approve"}
        facts={[
          {
            icon: "euro",
            label: "Amount",
            value: formatMoney(transaction.amountMinor, transaction.currency),
          },
          { icon: "person", label: "Party", value: transaction.personName ?? "—" },
          { icon: "calendar-range", label: "Date", value: formatDayShort(transaction.at) },
          { icon: "arrow-left", label: "Direction", value: directionLabel(transaction.direction) },
        ]}
      />
    </>
  );
}
