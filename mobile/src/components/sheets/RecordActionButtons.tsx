"use client";

/**
 * The small action sheets behind record-detail buttons: add a note, add a
 * follow-up, view the audit trail. Each writes through the server actions in
 * app/actions.ts — the server re-checks the operator session, verifies the
 * record exists, writes, and audits. In preview mode the action answers
 * "nothing is written here" and the sheet shows that message verbatim.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  addEntityNoteAction,
  createEntityFollowUpAction,
  getAuditTrailAction,
} from "@/app/actions";
import type { AuditTrailEntry } from "@/data/record-actions";
import { displayTime } from "@/lib/time";
import { PrimaryButton, SecondaryButton } from "@/components/ui/primitives";
import { Sheet } from "./Sheet";

type Busy = "idle" | "busy";

export function AddNoteButton({
  refId,
  label = "Add note",
  flex,
}: {
  refId: string;
  label?: string;
  flex?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState<Busy>("idle");
  const [message, setMessage] = useState<string | null>(null);

  const save = async () => {
    setBusy("busy");
    const result = await addEntityNoteAction({ ref: refId, body });
    setBusy("idle");
    setMessage(result.message);
    if (result.ok) {
      setBody("");
      router.refresh();
    }
  };

  return (
    <>
      <SecondaryButton style={flex ? { flex: 1 } : undefined} onClick={() => setOpen(true)}>
        {label}
      </SecondaryButton>
      <Sheet
        open={open}
        onClose={() => {
          setOpen(false);
          setMessage(null);
        }}
        title="Add note"
        footer={
          <PrimaryButton block disabled={busy === "busy" || !body.trim()} onClick={() => void save()}>
            Save note
          </PrimaryButton>
        }
      >
        {message ? <p className="field__hint">{message}</p> : null}
        <textarea
          className="control"
          rows={4}
          placeholder="Short, factual — who, what, when."
          value={body}
          onChange={(e) => setBody(e.target.value)}
          data-testid="note-input"
        />
      </Sheet>
    </>
  );
}

export function AddFollowUpButton({
  refId,
  defaultTitle = "",
  label = "Follow up",
}: {
  refId: string;
  defaultTitle?: string;
  label?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(defaultTitle);
  const [dueAt, setDueAt] = useState("");
  const [busy, setBusy] = useState<Busy>("idle");
  const [message, setMessage] = useState<string | null>(null);

  const save = async () => {
    setBusy("busy");
    const result = await createEntityFollowUpAction({ ref: refId, title, dueAt: dueAt || undefined });
    setBusy("idle");
    setMessage(result.message);
    if (result.ok) router.refresh();
  };

  return (
    <>
      <PrimaryButton block onClick={() => setOpen(true)} data-testid="primary-action">
        {label}
      </PrimaryButton>
      <Sheet
        open={open}
        onClose={() => {
          setOpen(false);
          setMessage(null);
        }}
        title="New follow-up"
        footer={
          <PrimaryButton block disabled={busy === "busy" || !title.trim()} onClick={() => void save()}>
            Save follow-up
          </PrimaryButton>
        }
      >
        {message ? <p className="field__hint">{message}</p> : null}
        <label className="field__label" htmlFor="followup-title">
          What needs doing
        </label>
        <input
          id="followup-title"
          className="control"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          data-testid="followup-input"
        />
        <label className="field__label" htmlFor="followup-date" style={{ marginTop: 10 }}>
          Due (optional)
        </label>
        <input
          id="followup-date"
          className="control"
          type="date"
          value={dueAt}
          onChange={(e) => setDueAt(e.target.value)}
        />
      </Sheet>
    </>
  );
}

export function AuditTrailButton({ refId, flex }: { refId: string; flex?: boolean }) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<AuditTrailEntry[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    setOpen(true);
    const result = await getAuditTrailAction({ ref: refId });
    if (result.ok) setEntries(result.entries);
    else setMessage(result.message ?? "The audit trail could not be loaded.");
  };

  return (
    <>
      <SecondaryButton style={flex ? { flex: 1 } : undefined} onClick={() => void load()}>
        View audit trail
      </SecondaryButton>
      <Sheet
        open={open}
        onClose={() => {
          setOpen(false);
          setEntries(null);
          setMessage(null);
        }}
        title="Audit trail"
      >
        {message ? <p className="field__hint">{message}</p> : null}
        {entries === null && !message ? <p className="field__hint">Loading…</p> : null}
        {entries?.length === 0 ? (
          <p className="field__hint">No activity yet — actions on this record will appear here.</p>
        ) : null}
        {entries?.length ? (
          <ul className="list">
            {entries.map((e, i) => (
              <li key={`${e.at}-${i}`} style={{ padding: "10px 0", borderBottom: "1px solid var(--color-line, #22301F)" }}>
                <p style={{ margin: 0, fontSize: "var(--text-row)" }}>{e.summary || e.action}</p>
                <p className="field__hint" style={{ margin: "2px 0 0" }}>
                  {e.action} · {e.actor} · {displayTime(e.at, "minute") ?? e.at}
                </p>
              </li>
            ))}
          </ul>
        ) : null}
      </Sheet>
    </>
  );
}
