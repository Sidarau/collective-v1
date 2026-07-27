"use client";

import { useState } from "react";
import type {
  AccessRequest,
  DaySummary as DaySummaryData,
  Experience,
  ForecastSeries,
  NumbersOfTheDay,
  NumbersPeriod,
  OperationEvent,
  Person,
  Space,
  Transaction,
} from "@/data/contracts";
import { PageTitle } from "@/components/shell/MobileShell";
import { DaySummary } from "@/components/intel/DaySummary";
import { NumbersDisclosure } from "@/components/intel/NumbersDisclosure";
import { FilterTabs } from "@/components/intel/FilterTabs";
import { ForecastCurve, MetricStrip, PeriodControl } from "@/components/intel/Metrics";
import { TimelineStream } from "@/components/timeline/TimelineStream";
import { OperationRow } from "@/components/timeline/OperationRow";
import {
  AreaRow,
  EventRow,
  MoneyRow,
  PersonRow,
  SpaceRow,
} from "@/components/rows/rows";
import {
  Banner,
  CountBadge,
  DestructiveButton,
  EmptyState,
  PrimaryButton,
  SecondaryButton,
  SkeletonList,
  StatusDot,
  StatusPill,
  StatusText,
  UndoToast,
} from "@/components/ui/primitives";
import { OverflowMenu } from "@/components/ui/OverflowMenu";
import {
  CheckboxRow,
  Checklist,
  DateRangeField,
  DateTimeField,
  MoneyField,
  PeopleStepper,
  RadioGroup,
  SearchField,
  Segmented,
  SelectRow,
  TextArea,
  TextField,
  Toggle,
} from "@/components/ui/forms";
import { ConfirmSheet } from "@/components/sheets/ConfirmSheet";
import { ComposerSheet } from "@/components/sheets/ComposerSheet";
import { CollectaSheet } from "@/components/sheets/CollectaSheet";
import { DetailSheet, PickerSheet } from "@/components/sheets/DetailSheet";
import { getProvider } from "@/data/provider";
import { ChecklistTimeline } from "@/components/templates/templates";

const TOKENS = {
  void: "#060D0B",
  field: "#0A1310",
  fieldDeep: "#040807",
  raised: "#101C17",
  line: "#17251F",
  lineStrong: "#2A3A32",
  ink: "#F2F5F1",
  inkDim: "#8A9A93",
  inkFaint: "#5A6B64",
  champagne: "#E8C87A",
  champagneHighlight: "#F6E4B2",
  champagneShadow: "#C9A054",
  healthy: "#86C9A4",
  healthyDeep: "#5FB98A",
  critical: "#F0645A",
  navy: "#0A2140",
};

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="ds-item">
      <p className="ds-item__label">{label}</p>
      {children}
    </div>
  );
}

function Sec({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="ds-section">
      <h2 className="ds-section__title">{title}</h2>
      {children}
    </section>
  );
}

export function GalleryClient({
  summary,
  numbers,
  forecast,
  events,
  request,
  person,
  space,
  transaction,
  experience,
  nowIso,
}: {
  summary: DaySummaryData;
  numbers: Record<NumbersPeriod, NumbersOfTheDay>;
  forecast: ForecastSeries;
  events: OperationEvent[];
  request: AccessRequest;
  person: Person;
  space: Space;
  transaction: Transaction;
  experience: Experience;
  nowIso: string;
}) {
  const [tab, setTab] = useState<"all" | "requests" | "access">("all");
  const [period, setPeriod] = useState<NumbersPeriod>("30d");
  const [text, setText] = useState("");
  const [note, setNote] = useState("");
  const [amount, setAmount] = useState("850");
  const [people, setPeople] = useState(2);
  const [toggle, setToggle] = useState(true);
  const [checked, setChecked] = useState(true);
  const [radio, setRadio] = useState("a");
  const [seg, setSeg] = useState<"one" | "two">("one");
  const [sheet, setSheet] = useState<
    null | "confirm" | "composer" | "collecta" | "detail" | "picker" | "destructive"
  >(null);
  const [toast, setToast] = useState(false);

  const focused = events.find((e) => e.status === "review") ?? events[0];
  const carried = events.find((e) => e.carriedFrom) ?? events[0];
  const complete = events.find((e) => e.status === "complete") ?? events[0];
  const blocked = events.find((e) => e.status === "blocked") ?? events[0];

  return (
    <>
      <PageTitle
        title="Design system"
        subtitle="Living gallery — every component and state. Not a production surface."
        backHref="/more"
      />

      {/* ---------------- Tokens ---------------- */}
      <Sec title="1 · Tokens">
        <Item label="color — mobile-ui-tokens.json">
          <div className="ds-swatches">
            {Object.entries(TOKENS).map(([name, hex]) => (
              <div className="ds-swatch" key={name}>
                <span className="ds-swatch__chip" style={{ background: hex }} />
                {name}
                <br />
                {hex}
              </div>
            ))}
          </div>
        </Item>

        <Item label="type — display serif is reserved for orientation and major numbers">
          <p className="display" style={{ fontSize: 33, lineHeight: "35px", margin: 0 }}>
            Today · €128,420
          </p>
          <p style={{ fontSize: 28, lineHeight: "32px", margin: "6px 0 0" }}>Page title 28/32</p>
          <p style={{ fontSize: 17, lineHeight: "23px", margin: "6px 0 0" }}>Row 17/23</p>
          <p style={{ fontSize: 15, lineHeight: "21px", margin: "4px 0 0" }}>Body 15/21</p>
          <p style={{ fontSize: 13, color: "var(--color-ink-dim)", margin: "4px 0 0" }}>Meta 13/18</p>
          <p style={{ fontSize: 11, color: "var(--color-ink-faint)", margin: "4px 0 0" }}>
            Caption 11/14
          </p>
          <p className="tnum" style={{ margin: "6px 0 0" }}>
            Tabular numerals 0123456789
          </p>
        </Item>
      </Sec>

      {/* ---------------- Orientation ---------------- */}
      <Sec title="2 · Orientation and intelligence">
        <Item label="DaySummary — three lines maximum, every term applies a filter">
          <DaySummary summary={summary} onFilter={() => {}} />
        </Item>
        <Item label="NumbersDisclosure — expands in place, links to /briefing">
          <NumbersDisclosure numbers={numbers} />
        </Item>
        <Item label="PeriodControl">
          <PeriodControl value={period} onChange={setPeriod} />
        </Item>
        <Item label="MetricStrip — two columns">
          <MetricStrip metrics={numbers[period].metrics.slice(0, 4)} />
        </Item>
        <Item label="MetricStrip — four columns">
          <MetricStrip metrics={numbers[period].metrics.slice(0, 4)} columns={4} />
        </Item>
        <Item label="ForecastCurve — settled solid, projected dashed">
          <ForecastCurve series={forecast} />
        </Item>
        <Item label="FilterTabs — tab semantics with one travelling rule">
          <FilterTabs
            label="Gallery filters"
            options={[
              { key: "all", label: "All" },
              { key: "requests", label: "Requests" },
              { key: "access", label: "Access" },
            ]}
            value={tab}
            onChange={setTab}
            resultCount={events.length}
          />
        </Item>
      </Sec>

      {/* ---------------- Timeline ---------------- */}
      <Sec title="3 · Timeline and rows">
        <Item label="OperationRow — default (no invented time)">
          <ol className="timeline">
            <OperationRow event={{ ...complete, status: "ready", carriedFrom: undefined }} />
          </ol>
        </Item>
        <Item label="FocusedOperationRow — one luminous item per viewport">
          <ol className="timeline">
            <OperationRow event={focused} focused />
          </ol>
        </Item>
        <Item label="CarriedRow — overdue incomplete work, still actionable">
          <ol className="timeline">
            <OperationRow event={carried} />
          </ol>
        </Item>
        <Item label="OperationRow — complete (history collapses to a dot)">
          <ol className="timeline">
            <OperationRow event={complete} />
          </ol>
        </Item>
        <Item label="OperationRow — blocked">
          <ol className="timeline">
            <OperationRow event={blocked} />
          </ol>
        </Item>
        <Item label="TimelineStream — day dividers, present marker, continuous rail">
          <TimelineStream events={events.slice(0, 8)} nowIso={nowIso} bidirectional={false} />
        </Item>
        <Item label="ChecklistTimeline — access handoff">
          <ChecklistTimeline items={request.checklist} />
        </Item>
        <Item label="DirectoryRow (person) — plain and selected">
          <ul className="list">
            <PersonRow person={person} />
            <PersonRow person={person} selected />
          </ul>
        </Item>
        <Item label="SpaceRow / MoneyRow / EventRow / AreaRow">
          <ul className="list">
            <SpaceRow space={space} />
            <MoneyRow transaction={transaction} />
            <EventRow experience={experience} />
            {space.areas.map((a) => (
              <AreaRow key={a.id} area={a} />
            ))}
          </ul>
        </Item>
        <Item label="SkeletonRow — preserves final row geometry">
          <SkeletonList rows={3} />
        </Item>
        <Item label="EmptyState">
          <EmptyState
            title="Nothing in this filter"
            body="Switch to All to see the whole day, or add work with the + control."
          />
        </Item>
      </Sec>

      {/* ---------------- Status ---------------- */}
      <Sec title="4 · Status">
        <Item label="StatusText — default list-row trailing state">
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <StatusText label="Completed" />
            <StatusText label="In progress" tone="healthy" />
            <StatusText label="Confirm list" tone="attention" />
            <StatusText label="Review" tone="critical" />
          </div>
        </Item>
        <Item label="StatusPill — detail headers and confirmation sheets">
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <StatusPill label="Ready" tone="healthy" />
            <StatusPill label="Needs confirmation" tone="attention" />
            <StatusPill label="Blocked" tone="critical" />
            <StatusPill label="Scheduled" />
          </div>
        </Item>
        <Item label="StatusDot + CountBadge">
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <StatusDot tone="healthy" />
            <StatusDot tone="attention" />
            <StatusDot tone="critical" />
            <CountBadge count={3} label="open requests" />
            <CountBadge count={12} label="open items" />
          </div>
        </Item>
      </Sec>

      {/* ---------------- Actions ---------------- */}
      <Sec title="5 · Actions and feedback">
        <Item label="Buttons — one champagne primary action per viewport">
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <PrimaryButton>Confirm</PrimaryButton>
            <SecondaryButton>View details</SecondaryButton>
            <DestructiveButton>Cancel request</DestructiveButton>
            <PrimaryButton disabled>Disabled</PrimaryButton>
          </div>
        </Item>
        <Item label="OverflowMenu — never hides the primary action">
          <OverflowMenu
            items={[
              { id: "view", label: "View details", icon: "pencil" },
              { id: "dup", label: "Duplicate", icon: "copy" },
              { id: "del", label: "Delete", icon: "trash", destructive: true },
            ]}
          />
        </Item>
        <Item label="Banners">
          <div style={{ display: "grid", gap: 10 }}>
            <Banner tone="success">Pool system upkeep completed</Banner>
            <Banner tone="error">Space is not available</Banner>
            <Banner tone="info">Passport received</Banner>
          </div>
        </Item>
        <Item label="UndoToast — reversible low-risk writes only">
          <SecondaryButton onClick={() => setToast(true)}>Show undo toast</SecondaryButton>
          {toast ? (
            <UndoToast message="Access request approved" onUndo={() => setToast(false)} />
          ) : null}
        </Item>
      </Sec>

      {/* ---------------- Forms ---------------- */}
      <Sec title="6 · Form controls">
        <div style={{ display: "grid", gap: 18 }}>
          <TextField label="Space name" value={text} onChange={(e) => setText(e.target.value)} />
          <TextField label="Space name" value="" placeholder="Enter space name" error="Required field" readOnly />
          <TextField label="Disabled" value="Cannot edit" disabled readOnly />
          <SearchField label="Search people, spaces, areas…" />
          <SelectRow
            label="Gate"
            options={[
              { value: "north", label: "North Gate" },
              { value: "founding", label: "Founding circle" },
            ]}
          />
          <DateRangeField label="Access dates" value="2026-07-29" />
          <DateTimeField label="Arrival" value="2026-07-29T17:30" />
          <MoneyField label="Amount" value={amount} onChange={setAmount} />
          <PeopleStepper label="People" value={people} onChange={setPeople} />
          <TextArea label="Note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={280} />
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Toggle label="Notifications" checked={toggle} onChange={setToggle} />
            <span className="row__detail">Toggle — immediate reversible preference</span>
          </div>
          <CheckboxRow label="Agree to terms" checked={checked} onChange={setChecked} />
          <RadioGroup
            label="Options"
            value={radio}
            onChange={setRadio}
            options={[
              { value: "a", label: "Option A" },
              { value: "b", label: "Option B" },
            ]}
          />
          <Segmented
            label="Segmented control"
            value={seg}
            onChange={setSeg}
            options={[
              { value: "one", label: "Option 1" },
              { value: "two", label: "Option 2" },
            ]}
          />
          <Checklist
            label="Access handoff"
            items={[
              { id: "1", label: "Identity verified", done: true },
              { id: "2", label: "Space ready", detail: "Area 2", done: true },
              { id: "3", label: "Welcome note" },
            ]}
          />
        </div>
      </Sec>

      {/* ---------------- Sheets ---------------- */}
      <Sec title="7 · Sheets">
        <Item label="Every sheet traps focus and restores it to the opener">
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <SecondaryButton onClick={() => setSheet("detail")}>DetailSheet</SecondaryButton>
            <SecondaryButton onClick={() => setSheet("composer")}>ComposerSheet</SecondaryButton>
            <SecondaryButton onClick={() => setSheet("confirm")}>ConfirmSheet</SecondaryButton>
            <SecondaryButton onClick={() => setSheet("destructive")}>
              ConfirmSheet · destructive
            </SecondaryButton>
            <SecondaryButton onClick={() => setSheet("picker")}>PickerSheet</SecondaryButton>
            <SecondaryButton onClick={() => setSheet("collecta")}>CollectaSheet</SecondaryButton>
          </div>
        </Item>
      </Sec>

      {/* ---------------- Load states ---------------- */}
      <Sec title="8 · Load and edge states">
        <Item label="Every screen renders all five through ?scenario=">
          <ul className="list">
            {(["healthy", "empty", "loading", "error", "offline", "busy"] as const).map((s) => (
              <li key={s}>
                <a className="row" href={`/?scenario=${s}`}>
                  <span className="row__body">
                    <span className="row__title">Today · {s}</span>
                    <span className="row__detail">/?scenario={s}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </Item>
        <Item label="Long names and translated-length labels">
          <ul className="list">
            <li>
              <div className="row" style={{ cursor: "default" }}>
                <span className="row__body">
                  <span className="row__title">
                    Berth inspection and anti-fouling assessment for the north pontoon
                  </span>
                  <span className="row__detail">
                    Zugangsanfrage · Bartholomew Okonkwo-Fitzgerald · Marina zone
                  </span>
                </span>
                <span className="row__trailing">
                  <StatusText label="Needs confirmation" tone="attention" />
                </span>
              </div>
            </li>
          </ul>
        </Item>
      </Sec>

      <ConfirmSheet
        open={sheet === "confirm"}
        onClose={() => setSheet(null)}
        onConfirm={() => setSheet(null)}
        title="Approve access request?"
        facts={[
          { icon: "person", label: "Person", value: "Nora + 1" },
          { icon: "calendar-range", label: "Period", value: "29 Jul – 2 Aug" },
          { icon: "euro", label: "Contribution", value: "€1,400" },
        ]}
      />
      <ConfirmSheet
        open={sheet === "destructive"}
        onClose={() => setSheet(null)}
        onConfirm={() => setSheet(null)}
        title="Decline access request?"
        confirmLabel="Decline"
        destructive
        facts={[
          { icon: "person", label: "Person", value: "Nora + 1" },
          { icon: "info", label: "Effect", value: "The request is closed" },
        ]}
      />
      <ComposerSheet
        open={sheet === "composer"}
        onClose={() => setSheet(null)}
        options={getProvider().getComposerOptions()}
        defaultDate="2026-07-29"
      />
      <CollectaSheet open={sheet === "collecta"} onClose={() => setSheet(null)} />
      <DetailSheet
        open={sheet === "detail"}
        onClose={() => setSheet(null)}
        title="Review access request"
        state={request.state}
        facts={[
          { icon: "calendar-range", label: "Period", value: request.periodLabel },
          { icon: "landmark", label: "Gate", value: request.gateName },
          { icon: "person", label: "People", value: String(request.people) },
        ]}
        href={`/requests/${request.id}`}
      />
      <PickerSheet
        open={sheet === "picker"}
        onClose={() => setSheet(null)}
        title="Select Space"
        value="space-roca-llisa"
        onSelect={() => {}}
        options={[
          { value: "space-roca-llisa", label: "Roca Llisa", detail: "Coastal residence · 4 areas" },
          { value: "space-can-verde", label: "Can Verde", detail: "Inland residence · 3 areas" },
          { value: "space-marina", label: "North pontoon", detail: "Marina · 6 berths" },
        ]}
      />
    </>
  );
}
