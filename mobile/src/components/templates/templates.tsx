"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type {
  ActivityEntry,
  ChecklistItem,
  Metric,
  RecordState,
  SettingsGroup,
} from "@/data/contracts";
import { iconFor } from "@/lib/icons";
import { displayTime, formatDayShort } from "@/lib/time";
import { PageTitle } from "@/components/shell/MobileShell";
import { SearchField, Toggle } from "@/components/ui/forms";
import {
  CountBadge,
  DestructiveButton,
  EmptyState,
  NavRow,
  PrimaryButton,
  SecondaryButton,
  StatusPill,
  StatusText,
} from "@/components/ui/primitives";
import { FilterTabs, type TabOption } from "@/components/intel/FilterTabs";
import { MetricStrip } from "@/components/intel/Metrics";

/* ================================================================== *
 * Queue — Requests, Applications, Vendors, Communications
 * ================================================================== */

export function QueueScreen<T extends string>({
  title,
  actionableCount,
  actionableNoun = "need a decision",
  filters,
  filter,
  onFilter,
  searchLabel,
  onSearch,
  resultCount,
  children,
}: {
  title: string;
  actionableCount?: number;
  actionableNoun?: string;
  filters?: TabOption<T>[];
  filter?: T;
  onFilter?: (k: T) => void;
  searchLabel?: string;
  onSearch?: (q: string) => void;
  resultCount?: number;
  children: React.ReactNode;
}) {
  return (
    <>
      <PageTitle
        title={title}
        subtitle={
          typeof actionableCount === "number"
            ? `${actionableCount} ${actionableNoun}`
            : undefined
        }
      />

      {searchLabel ? (
        <div style={{ marginTop: 14 }}>
          <SearchField label={searchLabel} onChange={(e) => onSearch?.(e.target.value)} />
        </div>
      ) : null}

      {filters && filter && onFilter ? (
        <FilterTabs
          label={`${title} filters`}
          options={filters}
          value={filter}
          onChange={onFilter}
          resultCount={resultCount}
        />
      ) : null}

      <div style={{ marginTop: 6 }}>{children}</div>
    </>
  );
}

/* ================================================================== *
 * Directory — People, Spaces, Gates, Partners
 * ================================================================== */

export function DirectoryScreen<T extends string>({
  title,
  subtitle,
  summary,
  filters,
  filter,
  onFilter,
  searchLabel = "Search",
  resultCount,
  children,
}: {
  title: string;
  subtitle?: string;
  summary?: Metric[];
  filters?: TabOption<T>[];
  filter?: T;
  onFilter?: (k: T) => void;
  searchLabel?: string;
  resultCount?: number;
  children: (query: string) => React.ReactNode;
}) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");

  // Debounce 150–250ms per COMPONENT_USAGE.md.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 200);
    return () => clearTimeout(t);
  }, [query]);

  return (
    <>
      <PageTitle title={title} subtitle={subtitle} />

      <div style={{ marginTop: 14 }}>
        <SearchField
          label={searchLabel}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {summary?.length ? <MetricStrip metrics={summary} columns={summary.length >= 4 ? 4 : 2} /> : null}

      {filters && filter && onFilter ? (
        <FilterTabs
          label={`${title} filters`}
          options={filters}
          value={filter}
          onChange={onFilter}
          resultCount={resultCount}
        />
      ) : null}

      <div style={{ marginTop: 6 }}>{children(debounced || query)}</div>
    </>
  );
}

/* ================================================================== *
 * Record detail — one persistent primary action
 * ================================================================== */

export function RecordDetailScreen({
  title,
  subtitle,
  backHref,
  state,
  facts,
  children,
  primaryAction,
  secondaryActions,
  destructiveAction,
}: {
  title: string;
  subtitle?: string;
  backHref: string;
  state?: RecordState;
  facts?: { icon?: string; label: string; value: string }[];
  children?: React.ReactNode;
  primaryAction?: React.ReactNode;
  secondaryActions?: React.ReactNode;
  destructiveAction?: React.ReactNode;
}) {
  return (
    <>
      <PageTitle title={title} subtitle={subtitle} backHref={backHref} />

      {state ? (
        <p style={{ margin: "10px 0 0" }}>
          <StatusPill label={state.label} tone={state.tone} />
        </p>
      ) : null}

      {facts?.length ? (
        <div className="metric-strip metric-strip--four" style={{ marginTop: 14 }}>
          {facts.map((f) => {
            const Icon = f.icon ? iconFor(f.icon) : null;
            return (
              <div className="metric-tile" key={f.label} style={{ padding: "10px 8px" }}>
                <span
                  className="metric-tile__label"
                  style={{ display: "flex", alignItems: "center", gap: 4 }}
                >
                  {Icon ? <Icon size={13} aria-hidden="true" /> : null}
                  {f.label}
                </span>
                <span
                  style={{
                    fontSize: "var(--text-meta)",
                    lineHeight: "var(--text-meta--line-height)",
                    color: "var(--color-ink)",
                  }}
                >
                  {f.value}
                </span>
              </div>
            );
          })}
        </div>
      ) : null}

      {children}

      {primaryAction || secondaryActions || destructiveAction ? (
        <div style={{ marginTop: 26, display: "grid", gap: 10 }}>
          {primaryAction}
          {secondaryActions ? (
            <div style={{ display: "flex", gap: 10 }}>{secondaryActions}</div>
          ) : null}
          {/* Destructive actions are separated and always confirmed. */}
          {destructiveAction ? (
            <div style={{ marginTop: 10, paddingTop: 14, borderTop: "1px solid var(--color-line)" }}>
              {destructiveAction}
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

/** Section heading used inside record detail. */
export function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="group">
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <h2 className="group__label">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Chronological activity. Time only where it is meaningful. */
export function ActivityTimeline({ entries }: { entries: ActivityEntry[] }) {
  if (!entries.length) {
    return (
      <EmptyState title="No activity yet" body="Actions on this record will appear here." />
    );
  }
  return (
    <ol className="list">
      {entries.map((e) => {
        const time = displayTime(e.at, e.displayPrecision);
        return (
          <li key={e.id}>
            <div className="row" style={{ cursor: "default" }}>
              <span className="row__body">
                <span className="row__title">{e.title}</span>
                {e.detail ? <span className="row__detail">{e.detail}</span> : null}
              </span>
              <span className="row__trailing">
                <span className="status status--neutral tnum">
                  {formatDayShort(e.at)}
                  {time ? ` · ${time}` : ""}
                </span>
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Access handoff / upkeep progression with large targets. */
export function ChecklistTimeline({ items }: { items: ChecklistItem[] }) {
  return (
    <ol className="timeline" style={{ ["--row-content-x" as string]: "56px" }}>
      {items.map((item) => {
        const tone: RecordState["tone"] =
          item.state === "done"
            ? "healthy"
            : item.state === "current"
              ? "attention"
              : item.state === "blocked"
                ? "critical"
                : "neutral";
        const Icon = iconFor(item.state === "done" ? "check" : "circle");
        const time = item.at ? displayTime(item.at, "minute") : null;

        return (
          <li key={item.id}>
            <div
              className={`op-row${item.state === "current" ? " op-row--focused" : ""}`}
              style={{
                gridTemplateColumns: "56px minmax(0,1fr) auto",
                ["--rail-x" as string]: "24px",
              }}
            >
              <span className="op-row__node" aria-hidden="true">
                {item.state === "done" ? <Icon size={14} strokeWidth={2.4} /> : null}
              </span>
              <span style={{ gridColumn: 2, minWidth: 0 }}>
                <span className="op-row__title">{item.label}</span>
                {item.detail ? <span className="op-row__detail">{item.detail}</span> : null}
                {time ? <span className="op-row__detail tnum">{time}</span> : null}
              </span>
              <span className="op-row__trailing">
                <StatusText label={item.stateLabel} tone={tone} />
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* ================================================================== *
 * Intelligence — briefing, reports
 * ================================================================== */

export function IntelligenceScreen({
  title,
  subtitle,
  backHref,
  controls,
  children,
}: {
  title: string;
  subtitle?: string;
  backHref?: string;
  controls?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <>
      <PageTitle title={title} subtitle={subtitle} backHref={backHref} />
      {controls ? <div style={{ marginTop: 14 }}>{controls}</div> : null}
      <div style={{ marginTop: 4 }}>{children}</div>
    </>
  );
}

/** Ranked attention list — what needs a decision, most urgent first. */
export function AttentionList({
  items,
}: {
  items: { id: string; title: string; detail: string; href: string; state: RecordState }[];
}) {
  if (!items.length) {
    return <EmptyState title="Nothing needs attention" body="Every open item is on track." />;
  }
  return (
    <ol className="list">
      {items.map((i) => (
        <li key={i.id}>
          <Link href={i.href} className="row">
            <span className="row__body">
              <span className="row__title">{i.title}</span>
              <span className="row__detail">{i.detail}</span>
            </span>
            <span className="row__trailing">
              <StatusText label={i.state.label} tone={i.state.tone} />
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}

/* ================================================================== *
 * Settings list — More, Settings, Agents, Content
 * ================================================================== */

export function SettingsListScreen({
  title,
  subtitle,
  backHref,
  groups,
}: {
  title: string;
  subtitle?: string;
  backHref?: string;
  groups: { id: string; label: string; items: React.ReactNode }[];
}) {
  return (
    <>
      <PageTitle title={title} subtitle={subtitle} backHref={backHref} />
      {groups.map((g) => (
        <section className="group" key={g.id}>
          <h2 className="group__label">{g.label}</h2>
          <div className="group__panel">
            <ul className="list">{g.items}</ul>
          </div>
        </section>
      ))}
    </>
  );
}

/** Renders a settings group's rows, including immediate toggles. */
export function SettingsRows({ group }: { group: SettingsGroup }) {
  const [state, setState] = useState<Record<string, boolean>>(
    Object.fromEntries(group.rows.map((r) => [r.id, Boolean(r.enabled)])),
  );

  return (
    <>
      {group.rows.map((row) => {
        if (row.kind === "toggle") {
          return (
            <li key={row.id}>
              <div className="row" style={{ cursor: "default", paddingInline: 14 }}>
                <span className="row__body">
                  <span className="row__title">{row.label}</span>
                  {row.detail ? <span className="row__detail">{row.detail}</span> : null}
                </span>
                <span className="row__trailing">
                  <Toggle
                    label={row.label}
                    checked={Boolean(state[row.id])}
                    onChange={(v) => setState((s) => ({ ...s, [row.id]: v }))}
                  />
                </span>
              </div>
            </li>
          );
        }
        if (row.kind === "select") {
          return (
            <NavRow
              key={row.id}
              label={row.label}
              detail={row.detail}
              href={row.href}
              trailing={<StatusText label={row.value ?? ""} />}
            />
          );
        }
        return (
          <NavRow
            key={row.id}
            label={row.label}
            detail={row.detail}
            href={row.href}
            badge={row.badge}
          />
        );
      })}
    </>
  );
}

export { CountBadge, DestructiveButton, PrimaryButton, SecondaryButton };
