"use client";

import { useState } from "react";
import type { Metric, Result, Space } from "@/data/contracts";
import { DirectoryScreen } from "@/components/templates/templates";
import { ResultBoundary } from "@/components/templates/ResultBoundary";
import { SpaceRow } from "@/components/rows/rows";

type FilterKey = "all" | "in_use" | "ready" | "attention";

const FILTERS = [
  { key: "all" as const, label: "All" },
  { key: "in_use" as const, label: "In use" },
  { key: "ready" as const, label: "Ready" },
  { key: "attention" as const, label: "Needs attention" },
];

export function SpacesClient({ spaces }: { spaces: Result<Space[]> }) {
  const [filter, setFilter] = useState<FilterKey>("all");

  const all = spaces.status === "ok" ? spaces.data : [];
  const avgUtilization = all.length
    ? Math.round(all.reduce((sum, s) => sum + s.utilizationPct, 0) / all.length)
    : 0;

  const summary: Metric[] = [
    { key: "count", label: "Spaces", value: String(all.length), raw: all.length, kind: "count" },
    {
      key: "util",
      label: "Utilization",
      value: `${avgUtilization}%`,
      raw: avgUtilization,
      kind: "ratio",
    },
    {
      key: "areas",
      label: "Areas",
      value: String(all.reduce((s, sp) => s + sp.areas.length, 0)),
      raw: all.reduce((s, sp) => s + sp.areas.length, 0),
      kind: "count",
    },
    {
      key: "attention",
      label: "Attention",
      value: String(all.filter((s) => s.state.tone === "attention").length),
      raw: all.filter((s) => s.state.tone === "attention").length,
      kind: "count",
    },
  ];

  const matches = (s: Space, q: string) =>
    !q ||
    s.name.toLowerCase().includes(q.toLowerCase()) ||
    s.spaceType.toLowerCase().includes(q.toLowerCase());

  const byFilter = (s: Space) => {
    if (filter === "all") return true;
    if (filter === "in_use") return s.state.label === "In use";
    if (filter === "ready") return s.state.label === "Ready";
    return s.state.tone === "attention" || s.state.tone === "critical";
  };

  return (
    <DirectoryScreen
      title="Spaces"
      subtitle="Residences, studios, land, venues and berths"
      summary={spaces.status === "ok" ? summary : undefined}
      filters={FILTERS}
      filter={filter}
      onFilter={setFilter}
      searchLabel="Search spaces, areas…"
      resultCount={all.filter(byFilter).length}
    >
      {(query) => (
        <ResultBoundary
          result={spaces}
          emptyTitle="No Spaces yet"
          emptyBody="Residences, studios, land, venues and berths appear here once added."
        >
          {(rows) => {
            const visible = rows.filter((s) => byFilter(s) && matches(s, query));
            if (!visible.length) {
              return (
                <p className="empty-state__body" style={{ padding: "28px 0" }}>
                  No Spaces match this search.
                </p>
              );
            }
            return (
              <ul className="list">
                {visible.map((s) => (
                  <SpaceRow key={s.id} space={s} />
                ))}
              </ul>
            );
          }}
        </ResultBoundary>
      )}
    </DirectoryScreen>
  );
}
