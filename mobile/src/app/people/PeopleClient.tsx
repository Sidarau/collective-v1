"use client";

import { useState } from "react";
import type { Person, Result } from "@/data/contracts";
import { DirectoryScreen } from "@/components/templates/templates";
import { ResultBoundary } from "@/components/templates/ResultBoundary";
import { PersonRow } from "@/components/rows/rows";

type FilterKey = "all" | "member" | "visitor" | "applicant" | "partner";

const FILTERS = [
  { key: "all" as const, label: "All" },
  { key: "member" as const, label: "Members" },
  { key: "visitor" as const, label: "Visitors" },
  { key: "applicant" as const, label: "Applicants" },
  { key: "partner" as const, label: "Partners" },
];

export function PeopleClient({ people }: { people: Result<Person[]> }) {
  const [filter, setFilter] = useState<FilterKey>("all");

  const all = people.status === "ok" ? people.data : [];
  const byFilter = (p: Person) =>
    filter === "all" ||
    p.relationship === filter ||
    (filter === "partner" && (p.relationship === "partner" || p.relationship === "host"));

  const matches = (p: Person, q: string) =>
    !q ||
    p.name.toLowerCase().includes(q.toLowerCase()) ||
    p.relationshipLabel.toLowerCase().includes(q.toLowerCase());

  // Exactly one luminous selection: whoever needs attention first.
  const focusedId = all.find((p) => p.state.tone === "healthy" || p.state.tone === "attention")?.id;

  return (
    <DirectoryScreen
      title="People"
      subtitle="Members, visitors, applicants, hosts and partners"
      filters={FILTERS}
      filter={filter}
      onFilter={setFilter}
      searchLabel="Search people…"
      resultCount={all.filter(byFilter).length}
    >
      {(query) => (
        <ResultBoundary
          result={people}
          emptyTitle="No people yet"
          emptyBody="Members, visitors and applicants appear here as they join."
        >
          {(rows) => {
            const visible = rows.filter((p) => byFilter(p) && matches(p, query));
            if (!visible.length) {
              return (
                <p className="empty-state__body" style={{ padding: "28px 0" }}>
                  Nobody matches this search.
                </p>
              );
            }
            return (
              <ul className="list">
                {visible.map((p) => (
                  <PersonRow key={p.id} person={p} selected={p.id === focusedId} />
                ))}
              </ul>
            );
          }}
        </ResultBoundary>
      )}
    </DirectoryScreen>
  );
}
