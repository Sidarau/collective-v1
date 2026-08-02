"use client";

import Link from "next/link";
import { ArrowDown, ArrowUp, ChevronRight } from "lucide-react";
import type {
  Area,
  Communication,
  Experience,
  Gate,
  Person,
  RecordState,
  Space,
  Transaction,
  Vendor,
} from "@/data/contracts";
import { Icon } from "@/lib/icons";
import { formatMoney, moneyAnnouncement } from "@/lib/money";
import { displayTime, formatDayShort } from "@/lib/time";
import { StatusText } from "@/components/ui/primitives";

/** Shared row scaffold: state and next relevant event, no card masonry. */
function RowShell({
  href,
  selected,
  leading,
  title,
  detail,
  trailing,
  testId,
}: {
  href: string;
  selected?: boolean;
  leading: React.ReactNode;
  title: string;
  detail?: string;
  trailing: React.ReactNode;
  testId?: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className={`row${selected ? " row--selected" : ""}`}
        data-testid={testId}
        aria-current={selected ? "true" : undefined}
      >
        {leading}
        <span className="row__body">
          <span className="row__title">{title}</span>
          {detail ? <span className="row__detail">{detail}</span> : null}
        </span>
        <span className="row__trailing">
          {trailing}
          <ChevronRight size={18} className="row__chev" aria-hidden="true" />
        </span>
      </Link>
    </li>
  );
}

function Initials({ text }: { text: string }) {
  return (
    <span className="row__icon" aria-hidden="true">
      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-ink-dim)" }}>
        {text}
      </span>
    </span>
  );
}

function KindIcon({ kind }: { kind: string }) {
  return (
    <span className="row__icon" aria-hidden="true">
      <Icon name={kind} size={18} />
    </span>
  );
}

/* ------------------------------------------------------------------ */

export function PersonRow({
  person,
  selected,
}: {
  person: Person;
  selected?: boolean;
}) {
  return (
    <RowShell
      href={`/people/${person.id}`}
      selected={selected}
      testId="person-row"
      leading={<Initials text={person.initials} />}
      title={person.name}
      detail={`${person.relationshipLabel}${person.summary ? ` · ${person.summary.replace(`${person.relationshipLabel} · `, "")}` : ""}`}
      trailing={<StatusText label={person.state.label} tone={person.state.tone} />}
    />
  );
}

export function SpaceRow({ space, selected }: { space: Space; selected?: boolean }) {
  return (
    <RowShell
      href={`/spaces/${space.id}`}
      selected={selected}
      testId="space-row"
      leading={<KindIcon kind={space.spaceType.toLowerCase().includes("berth") ? "berths" : "residence"} />}
      title={space.name}
      detail={space.summary}
      trailing={
        <span className="row__trailing-stack">
          <span className="status status--neutral tnum">{space.utilizationPct}%</span>
          <StatusText label={space.state.label} tone={space.state.tone} />
        </span>
      }
    />
  );
}

export function GateRow({ gate }: { gate: Gate }) {
  return (
    <RowShell
      href={`/gates/${gate.id}`}
      testId="gate-row"
      leading={<KindIcon kind="landmark" />}
      title={gate.name}
      detail={gate.summary}
      trailing={<StatusText label={gate.state.label} tone={gate.state.tone} />}
    />
  );
}

export function VendorRow({ vendor }: { vendor: Vendor }) {
  return (
    <RowShell
      href={`/vendors/${vendor.id}`}
      testId="vendor-row"
      leading={<KindIcon kind="person" />}
      title={vendor.name}
      detail={`${vendor.contactLabel} · ${vendor.category}`}
      trailing={<StatusText label={vendor.state.label} tone={vendor.state.tone} />}
    />
  );
}

/** Announces direction in words, never with a sign or arrow alone. */
export function MoneyRow({ transaction }: { transaction: Transaction }) {
  const Arrow = transaction.direction === "incoming" ? ArrowDown : ArrowUp;
  const tone: RecordState["tone"] = transaction.state.tone;

  return (
    <RowShell
      href={`/dues/${transaction.id}`}
      testId="money-row"
      leading={<KindIcon kind={transaction.direction === "incoming" ? "euro" : "vendor_invoice"} />}
      title={transaction.title}
      detail={transaction.detail}
      trailing={
        <span className="row__trailing-stack">
          <span className={`status status--${tone} tnum`}>
            <span aria-hidden="true">
              {formatMoney(transaction.amountMinor, transaction.currency)}
              <Arrow size={12} style={{ display: "inline", verticalAlign: "-1px", marginLeft: 3 }} />
            </span>
            <span className="sr-only">
              {moneyAnnouncement(
                transaction.amountMinor,
                transaction.currency,
                transaction.direction,
              )}
            </span>
          </span>
          <StatusText label={transaction.state.label} tone={tone} />
        </span>
      }
    />
  );
}

/** Time appears only when the experience is actually scheduled to a minute. */
export function EventRow({ experience }: { experience: Experience }) {
  const time = displayTime(experience.startAt, experience.displayPrecision);
  const when = `${formatDayShort(experience.startAt)}${time ? ` · ${time}` : " · All day"}`;

  return (
    <RowShell
      href={`/experiences/${experience.id}`}
      testId="event-row"
      leading={<KindIcon kind="experience" />}
      title={experience.title}
      detail={`${when} · ${experience.spaceName}`}
      trailing={
        <span className="row__trailing-stack">
          <span className="status status--neutral tnum">
            <span aria-hidden="true">
              {experience.rsvpConfirmed}/{experience.rsvpCapacity}
            </span>
            <span className="sr-only">
              {`${experience.rsvpConfirmed} of ${experience.rsvpCapacity} places confirmed`}
            </span>
          </span>
          <StatusText label={experience.state.label} tone={experience.state.tone} />
        </span>
      }
    />
  );
}

export function CommunicationRow({ item }: { item: Communication }) {
  return (
    <RowShell
      href="/communications"
      testId="communication-row"
      leading={<KindIcon kind="message-square" />}
      title={item.subject}
      detail={`${item.audience} · ${item.detail}`}
      trailing={<StatusText label={item.state.label} tone={item.state.tone} />}
    />
  );
}

/** Ready / in use / attention. The label may read room, deck, berth or zone. */
export function AreaRow({ area }: { area: Area }) {
  const tone: RecordState["tone"] =
    area.state === "ready"
      ? "healthy"
      : area.state === "in_use"
        ? "attention"
        : area.state === "attention"
          ? "critical"
          : "neutral";

  return (
    <li>
      <div className="row" style={{ cursor: "default" }} data-testid="area-row">
        <span className="row__body">
          <span className="row__title">{area.label}</span>
        </span>
        <span className="row__trailing">
          <StatusText label={area.stateLabel} tone={tone} />
          <span className={`status-dot status--${tone}`} aria-hidden="true" />
        </span>
      </div>
    </li>
  );
}
