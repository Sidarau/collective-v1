"use client";

/**
 * Person-detail actions: follow up, message, note — and, when the person has
 * an application waiting, approve / deny. Every write runs through the server
 * actions (session re-checked, row re-verified, audit written).
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail } from "lucide-react";
import type { Person } from "@/data/contracts";
import {
  DestructiveButton,
  PrimaryButton,
  SecondaryButton,
} from "@/components/ui/primitives";
import { ConfirmSheet } from "@/components/sheets/ConfirmSheet";
import { AddFollowUpButton, AddNoteButton } from "@/components/sheets/RecordActionButtons";
import { decideApplicationAction } from "@/app/actions";

export function PersonActions({ person }: { person: Person }) {
  const router = useRouter();
  const [pending, setPending] = useState<"approve" | "deny" | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const run = async () => {
    if (!pending || !person.pendingApplicationId || busy) return;
    setBusy(true);
    const result = await decideApplicationAction({
      applicationId: person.pendingApplicationId,
      decision: pending,
    });
    setBusy(false);
    setDone(result.message);
    setPending(null);
    if (result.ok) router.refresh();
  };

  return (
    <>
      {done ? (
        <p className="field__hint" style={{ margin: "0 0 12px" }}>
          {done}
        </p>
      ) : null}

      {person.pendingApplicationId ? (
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <DestructiveButton style={{ flex: 1 }} onClick={() => setPending("deny")} data-testid="deny-application">
            Deny
          </DestructiveButton>
          <PrimaryButton style={{ flex: 1 }} onClick={() => setPending("approve")} data-testid="approve-application">
            Approve
          </PrimaryButton>
        </div>
      ) : null}

      <div style={{ display: "grid", gap: 8 }}>
        <AddFollowUpButton refId={person.id} defaultTitle={`Follow up with ${person.name}`} />
        <div style={{ display: "flex", gap: 8 }}>
          {person.email ? (
            <a href={`mailto:${person.email}`} style={{ flex: 1, display: "flex" }} data-testid="message-person">
              <SecondaryButton style={{ flex: 1 }}>
                <Mail size={17} aria-hidden="true" /> Message
              </SecondaryButton>
            </a>
          ) : null}
          <AddNoteButton refId={person.id} flex />
        </div>
      </div>

      <ConfirmSheet
        open={Boolean(pending)}
        onClose={() => setPending(null)}
        onConfirm={() => void run()}
        title={`${pending === "approve" ? "Approve" : "Deny"} ${person.name}?`}
        confirmLabel={pending === "approve" ? "Approve" : "Deny"}
        destructive={pending === "deny"}
        facts={[
          { icon: "person", label: "Person", value: person.name },
          { icon: "info", label: "Relationship", value: person.relationshipLabel },
          {
            icon: "info",
            label: "Effect",
            value:
              pending === "approve"
                ? "Member access + their entrance link"
                : "The application is declined",
          },
        ]}
      />
    </>
  );
}
