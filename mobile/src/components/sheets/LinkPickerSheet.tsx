"use client";

import { useEffect, useMemo, useState } from "react";
import { Check } from "lucide-react";
import {
  LINK_TARGET_LABELS,
  type LinkTarget,
  type LinkTargetKind,
} from "@/data/contracts";
import { getProvider } from "@/data/provider";
import { Icon } from "@/lib/icons";
import { SearchField } from "@/components/ui/forms";
import { EmptyState, SkeletonList } from "@/components/ui/primitives";
import { Sheet } from "./Sheet";

const ICON_BY_KIND: Record<LinkTargetKind, string> = {
  space: "residence",
  person: "person",
  vendor: "users-round",
  experience: "experience",
  gate: "landmark",
};

/**
 * Attaches a new item to an existing record — a Space, a Person, a partner, an
 * experience or a Gate. Suggested kinds lead, but the search spans everything
 * so an operator never has to remember which bucket a record lives in.
 */
export function LinkPickerSheet({
  open,
  onClose,
  onSelect,
  selectedId,
  preferredKinds,
  title = "Link to",
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (target: LinkTarget) => void;
  selectedId?: string;
  preferredKinds?: LinkTargetKind[];
  title?: string;
}) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  /* Results are stored with the query they answer, so "still loading" is
     derived rather than set — no synchronous setState inside the effect. */
  const [result, setResult] = useState<{ key: string; rows: LinkTarget[] } | null>(null);
  const targets = result && result.key === debounced ? result.rows : null;

  // Debounce 150–250ms per COMPONENT_USAGE.md.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 200);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void getProvider()
      .searchLinkTargets(debounced)
      .then((res) => {
        if (cancelled) return;
        setResult({ key: debounced, rows: res.status === "ok" ? res.data : [] });
      });
    return () => {
      cancelled = true;
    };
  }, [open, debounced]);

  /* Suggested kinds first, then everything else — one flat, grouped list. */
  const groups = useMemo(() => {
    if (!targets) return null;
    const order: LinkTargetKind[] = [
      ...(preferredKinds ?? []),
      ...(["space", "person", "vendor", "experience", "gate"] as LinkTargetKind[]).filter(
        (k) => !preferredKinds?.includes(k),
      ),
    ];
    return order
      .map((kind) => ({ kind, rows: targets.filter((t) => t.kind === kind) }))
      .filter((g) => g.rows.length);
  }, [targets, preferredKinds]);

  return (
    <Sheet open={open} onClose={onClose} title={title} testId="link-picker-sheet">
      <div style={{ paddingTop: 2, paddingBottom: 10 }}>
        <SearchField
          label="Search Spaces, people, partners, experiences…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          data-testid="link-picker-search"
        />
      </div>

      {!groups ? (
        <SkeletonList rows={5} />
      ) : !groups.length ? (
        <EmptyState
          title="Nothing matches"
          body="Try a Space, a person, a partner, an experience or a Gate."
        />
      ) : (
        groups.map((group) => (
          <section className="group" key={group.kind} style={{ marginTop: 14 }}>
            <h3 className="group__label">{LINK_TARGET_LABELS[group.kind]}</h3>
            <ul className="list" role="listbox" aria-label={LINK_TARGET_LABELS[group.kind]}>
              {group.rows.map((target) => (
                <li key={`${target.kind}-${target.id}`}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selectedId === target.id}
                    className={`row${selectedId === target.id ? " row--selected" : ""}`}
                    onClick={() => {
                      onSelect(target);
                      onClose();
                    }}
                    data-testid={`link-target-${target.id}`}
                  >
                    <span className="row__icon" aria-hidden="true">
                      <Icon name={ICON_BY_KIND[target.kind]} size={17} />
                    </span>
                    <span className="row__body">
                      <span className="row__title">{target.label}</span>
                      {target.detail ? (
                        <span className="row__detail">{target.detail}</span>
                      ) : null}
                    </span>
                    {selectedId === target.id ? (
                      <span className="row__trailing">
                        <Check size={17} aria-hidden="true" />
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </Sheet>
  );
}
