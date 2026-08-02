"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import type { Space } from "@/data/contracts";
import { Icon } from "@/lib/icons";
import { trailingFor } from "@/lib/presentation";
import { RecordDetailScreen, Section } from "@/components/templates/templates";
import { AreaRow } from "@/components/rows/rows";
import { Banner, EmptyState, PrimaryButton, StatusText } from "@/components/ui/primitives";
import { Sheet } from "@/components/sheets/Sheet";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { closeSpaceAction, createFromComposerAction } from "@/app/actions";

const FACT_LIMIT = 3;

export function SpaceDetailClient({ space }: { space: Space }) {
  const router = useRouter();
  const [closing, setClosing] = useState(false);
  const [upkeepOpen, setUpkeepOpen] = useState(false);
  const [upkeepTitle, setUpkeepTitle] = useState("");
  const [upkeepDate, setUpkeepDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [closeDate, setCloseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [closeReason, setCloseReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  // The summary facts table shows the first few areas and says how many more
  // exist — never silently truncates (the "9 rooms, 4 shown" bug).
  const areaFacts = space.areas.slice(0, FACT_LIMIT).map((a) => ({
    label: a.label,
    value: a.stateLabel,
  }));
  if (space.areas.length > FACT_LIMIT) {
    areaFacts.push({
      label: `+${space.areas.length - FACT_LIMIT} more`,
      value: `${space.areas.length} areas — full list below`,
    });
  }

  const saveUpkeep = async () => {
    if (busy || !upkeepTitle.trim()) return;
    setBusy(true);
    const result = await createFromComposerAction({
      kind: "space_reset",
      title: upkeepTitle,
      date: upkeepDate,
      link: { id: space.id, kind: "space" },
    });
    setBusy(false);
    setDone(result.message);
    setUpkeepOpen(false);
    if (result.ok) {
      setUpkeepTitle("");
      router.refresh();
    }
  };

  const closeSpace = async () => {
    if (busy) return;
    setBusy(true);
    const result = await closeSpaceAction({
      villaId: space.id.replace(/^space-/, ""),
      date: closeDate,
      reason: closeReason || `Closed by operator`,
    });
    setBusy(false);
    setDone(result.message);
    setClosing(false);
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
        title={space.name}
        subtitle={`${space.state.label} · ${space.peopleOnSite} ${
          space.peopleOnSite === 1 ? "person" : "people"
        }`}
        backHref="/spaces"
        state={space.state}
        facts={areaFacts}
        primaryAction={
          <PrimaryButton block onClick={() => setUpkeepOpen(true)} data-testid="primary-action">
            <Plus size={18} aria-hidden="true" /> Add upkeep
          </PrimaryButton>
        }
        destructiveAction={
          <button
            type="button"
            className="btn btn--destructive btn--block"
            onClick={() => setClosing(true)}
          >
            Close Space
          </button>
        }
      >
        <Section title="Operations">
          {space.upkeep.length ? (
            <ul className="list">
              {space.upkeep.map((e) => {
                const trailing = trailingFor(e);
                return (
                  <li key={e.id}>
                    <Link href={e.href} className="row">
                      <span className="row__icon" aria-hidden="true">
                        <Icon name={e.kind} size={18} />
                      </span>
                      <span className="row__body">
                        <span className="row__title">{e.title}</span>
                        {e.detail ? <span className="row__detail">{e.detail}</span> : null}
                      </span>
                      <span className="row__trailing">
                        <StatusText label={trailing.label} tone={trailing.tone} />
                        <ChevronRight size={18} className="row__chev" aria-hidden="true" />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState
              title="No open operations"
              body="Resets, upkeep and supplies for this Space will appear here."
            />
          )}
        </Section>

        <Section title={`Areas · ${space.areas.length}`}>
          <ul className="list">
            {space.areas.map((a) => (
              <AreaRow key={a.id} area={a} />
            ))}
          </ul>
        </Section>

        <Section title="Utilization">
          <p className="tnum" style={{ fontSize: "var(--text-sheet)", margin: 0 }}>
            {space.utilizationPct}%
          </p>
          <p className="field__hint">
            Share of the last 30 days this Space was in an approved access period.
          </p>
        </Section>
      </RecordDetailScreen>

      {/* Upkeep: a maintenance closure + note via the composer write path. */}
      <Sheet
        open={upkeepOpen}
        onClose={() => setUpkeepOpen(false)}
        title="Add upkeep"
        footer={
          <PrimaryButton block disabled={busy || !upkeepTitle.trim()} onClick={() => void saveUpkeep()}>
            Schedule upkeep
          </PrimaryButton>
        }
      >
        <label className="field__label" htmlFor="upkeep-title">
          What needs doing
        </label>
        <input
          id="upkeep-title"
          className="control"
          placeholder="Deep clean, pool service…"
          value={upkeepTitle}
          onChange={(e) => setUpkeepTitle(e.target.value)}
          data-testid="upkeep-input"
        />
        <label className="field__label" htmlFor="upkeep-date" style={{ marginTop: 10 }}>
          On
        </label>
        <input
          id="upkeep-date"
          className="control"
          type="date"
          value={upkeepDate}
          onChange={(e) => setUpkeepDate(e.target.value)}
        />
      </Sheet>

      <Sheet
        open={closing}
        onClose={() => setClosing(false)}
        title={`Close ${space.name}?`}
        footer={
          <PrimaryButton
            block
            disabled={busy}
            onClick={() => void closeSpace()}
            style={{ background: "var(--color-critical)" }}
            data-testid="confirm-action"
          >
            {busy ? "Working…" : "Close Space"}
          </PrimaryButton>
        }
      >
        <p className="field__hint">
          Blocks the whole Space — {space.areas.length} areas — for the chosen day. No access
          periods can be approved over it.
        </p>
        <label className="field__label" htmlFor="close-date">
          On
        </label>
        <input
          id="close-date"
          className="control"
          type="date"
          value={closeDate}
          onChange={(e) => setCloseDate(e.target.value)}
        />
        <label className="field__label" htmlFor="close-reason" style={{ marginTop: 10 }}>
          Reason (optional)
        </label>
        <input
          id="close-reason"
          className="control"
          placeholder="Repairs, private hold…"
          value={closeReason}
          onChange={(e) => setCloseReason(e.target.value)}
        />
      </Sheet>
    </>
  );
}
