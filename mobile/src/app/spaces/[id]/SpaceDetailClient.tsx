"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import type { Space } from "@/data/contracts";
import { Icon } from "@/lib/icons";
import { trailingFor } from "@/lib/presentation";
import { RecordDetailScreen, Section } from "@/components/templates/templates";
import { AreaRow } from "@/components/rows/rows";
import { Banner, EmptyState, PrimaryButton, StatusText } from "@/components/ui/primitives";
import { ConfirmSheet } from "@/components/sheets/ConfirmSheet";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

export function SpaceDetailClient({ space }: { space: Space }) {
  const [closing, setClosing] = useState(false);
  const [done, setDone] = useState<string | null>(null);

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
        facts={space.areas.slice(0, 4).map((a) => ({
          label: a.label,
          value: a.stateLabel,
        }))}
        primaryAction={
          <PrimaryButton block data-testid="primary-action">
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

        <Section title="Areas">
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

      <ConfirmSheet
        open={closing}
        onClose={() => setClosing(false)}
        onConfirm={() => {
          setDone(`${space.name} closed. Fixture change only — nothing was written.`);
          setClosing(false);
        }}
        title={`Close ${space.name}?`}
        confirmLabel="Close Space"
        destructive
        facts={[
          { icon: "residence", label: "Space", value: space.name },
          { icon: "layout-grid", label: "Areas affected", value: String(space.areas.length) },
          { icon: "person", label: "People on site", value: String(space.peopleOnSite) },
        ]}
      />
    </>
  );
}
