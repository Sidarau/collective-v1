"use client";

/* eslint-disable @next/next/no-img-element -- Collecta's portrait is a fixed
   84px orb, already display-sized, and is preloaded at this exact URL in
   <head>. See BrandHeader for the same reasoning. */

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Send, Trash2 } from "lucide-react";
import type { CollectaContext, CollectaDraft } from "@/data/contracts";
import { getProvider } from "@/data/provider";
import { displayTime } from "@/lib/time";
import { PrimaryButton, SecondaryButton } from "@/components/ui/primitives";
import { useUiState } from "@/components/shell/UiStateProvider";
import { Sheet } from "./Sheet";
import { ConfirmSheet } from "./ConfirmSheet";

/**
 * Contextual assistant sheet.
 *
 * The conversation is kept in the shell, so closing the sheet or moving to
 * another screen does not lose it. The page context carries route, filter,
 * visible date and record ids — never record bodies; Phase 2 must re-fetch
 * every id server-side. Material changes are drafts and always confirmed.
 */
export function CollectaSheet({
  open,
  onClose,
  filter,
}: {
  open: boolean;
  onClose: () => void;
  filter?: string;
}) {
  const pathname = usePathname();
  const {
    visibleDate,
    visibleEventIds,
    collectaThread,
    appendCollecta,
    clearCollecta,
  } = useUiState();

  const [draft, setDraft] = useState<CollectaDraft | null>(null);
  const [prompt, setPrompt] = useState("");
  const [thinking, setThinking] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  const context: CollectaContext = {
    route: pathname,
    filter,
    visibleDate: visibleDate ?? undefined,
    visibleEventIds,
    selectedEventId: visibleEventIds[0],
  };

  /* Keep the newest turn in view as the thread grows. */
  useEffect(() => {
    if (!open) return;
    const el = bodyRef.current ?? document.querySelector(".sheet__body");
    if (el) el.scrollTop = el.scrollHeight;
  }, [open, collectaThread.length, thinking]);

  const ask = async (text: string) => {
    if (!text.trim()) return;
    setPrompt("");
    setThinking(true);
    // Phase 2: replace with a server action that re-reads every referenced id.
    const next = await getProvider().askCollecta(context, text);
    setThinking(false);
    appendCollecta(next.messages);
    setDraft(next.draft ?? null);
  };

  return (
    <>
      <Sheet
        open={open && !confirming}
        onClose={onClose}
        title="Collecta"
        variant="collecta"
        testId="collecta-sheet"
        footer={
          <form
            style={{ display: "flex", gap: 8, width: "100%" }}
            onSubmit={(e) => {
              e.preventDefault();
              void ask(prompt);
            }}
          >
            <label className="sr-only" htmlFor="collecta-input">
              Ask Collecta
            </label>
            <input
              id="collecta-input"
              className="control"
              placeholder="Ask Collecta…"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              data-testid="collecta-input"
            />
            <PrimaryButton type="submit" aria-label="Send" style={{ padding: "0 16px" }}>
              <Send size={18} aria-hidden="true" />
            </PrimaryButton>
          </form>
        }
      >
        <div ref={bodyRef} style={{ display: "grid", gap: 12, paddingTop: 2 }}>
          <div className="collecta-meta">
            <span data-testid="collecta-context">
              Operator context · {pathname}
              {filter && filter !== "all" ? ` · ${filter}` : ""}
              {visibleDate ? ` · ${visibleDate}` : ""}
            </span>
            {collectaThread.length ? (
              <button
                type="button"
                className="collecta-clear"
                onClick={() => {
                  clearCollecta();
                  setDraft(null);
                }}
                data-testid="collecta-clear"
              >
                <Trash2 size={12} aria-hidden="true" />
                New conversation
              </button>
            ) : null}
          </div>

          {!collectaThread.length && !thinking ? (
            <div className="collecta-msg collecta-msg--assistant" data-testid="collecta-open">
              Three decisions need you today: one access request, one supplies list and
              one overdue invoice.
            </div>
          ) : null}

          {/* The whole conversation, oldest first. */}
          <ol className="collecta-thread" data-testid="collecta-thread">
            {collectaThread.map((m) => (
              <li
                key={m.id}
                className={`collecta-msg collecta-msg--${
                  m.role === "operator" ? "operator" : "assistant"
                }`}
                data-testid={`collecta-${m.role}`}
              >
                {m.body}
                <span className="collecta-msg__at">
                  {displayTime(m.at, "minute") ?? ""}
                </span>
              </li>
            ))}
          </ol>

          {thinking ? (
            <div
              className="collecta-msg collecta-msg--assistant"
              data-testid="collecta-thinking"
              aria-live="polite"
            >
              <span className="sr-only">Collecta is thinking</span>
              <span className="collecta-thinking" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
            </div>
          ) : null}

          {draft ? (
            <div className="draft-card" data-testid="collecta-draft">
              <div>
                <p style={{ margin: 0, fontSize: "var(--text-row)" }}>{draft.title}</p>
                <p
                  style={{
                    margin: "2px 0 0",
                    fontSize: "var(--text-meta)",
                    color: "var(--color-ink-dim)",
                  }}
                >
                  {draft.detail}
                </p>
              </div>
              <p className="field__hint" style={{ margin: 0 }}>
                Draft — nothing changes until you confirm.
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <SecondaryButton style={{ flex: 1 }} onClick={() => setDraft(null)}>
                  Discard
                </SecondaryButton>
                <PrimaryButton
                  style={{ flex: 1 }}
                  onClick={() => setConfirming(true)}
                  data-testid="collecta-review"
                >
                  Review
                </PrimaryButton>
              </div>
            </div>
          ) : null}
        </div>
      </Sheet>

      {draft ? (
        <ConfirmSheet
          open={confirming}
          onClose={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false);
            appendCollecta([
              {
                id: `confirm-${draft.id}`,
                role: "collecta",
                body: `${draft.confirmLabel} recorded. An audit entry was created.`,
                at: new Date().toISOString(),
              },
            ]);
            setDraft(null);
          }}
          title={draft.title}
          confirmLabel={draft.confirmLabel}
          facts={draft.facts.map((f) => ({ label: f.label, value: f.value }))}
        />
      ) : null}
    </>
  );
}

/** The portrait orb. Never replaced by the keyhole while the portrait loads. */
export function CollectaOrb({ onOpen }: { onOpen: () => void }) {
  const { collectaThread } = useUiState();
  return (
    <button
      type="button"
      className="collecta-orb"
      onClick={onOpen}
      aria-label={
        collectaThread.length
          ? `Open Collecta — ${collectaThread.length} messages in this conversation`
          : "Open Collecta"
      }
      data-testid="collecta-orb"
      data-thread-length={collectaThread.length}
    >
      <img
        className="collecta-orb__img"
        src="/brand/collecta-avatar.png"
        alt=""
        width={84}
        height={84}
        decoding="async"
      />
      {collectaThread.length ? (
        <span className="collecta-orb__dot" aria-hidden="true" />
      ) : null}
    </button>
  );
}
