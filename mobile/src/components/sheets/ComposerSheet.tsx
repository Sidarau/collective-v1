"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import type { ComposerKind, ComposerOption } from "@/data/contracts";
import { iconFor } from "@/lib/icons";
import { PrimaryButton, SecondaryButton } from "@/components/ui/primitives";
import {
  DateRangeField,
  DateTimeField,
  MoneyField,
  PeopleStepper,
  SelectRow,
  TextArea,
  TextField,
} from "@/components/ui/forms";
import { Sheet } from "./Sheet";
import { ConfirmSheet } from "./ConfirmSheet";

/**
 * The satin + opens a type chooser, then a type-aware form.
 *
 * The date defaults to whatever day is currently visible in the timeline, so
 * scrolling into the future and tapping + creates work on that day.
 */
export function ComposerSheet({
  open,
  onClose,
  options,
  defaultDate,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  options: ComposerOption[];
  defaultDate: string;
  onCreated?: (kind: ComposerKind, title: string) => void;
}) {
  const [kind, setKind] = useState<ComposerKind | null>(null);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [people, setPeople] = useState(2);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [reviewing, setReviewing] = useState(false);

  /* Re-seed the date each time the sheet opens so it tracks the timeline.
     Adjusted during render on the open transition — an effect would show the
     previous date for one frame. */
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setDate(defaultDate);
  }

  const reset = () => {
    setKind(null);
    setTitle("");
    setPeople(2);
    setAmount("");
    setNote("");
    setReviewing(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const chosen = options.find((o) => o.kind === kind);

  // Money, access and experience creation is material — it must be reviewed.
  const needsReview = kind === "due" || kind === "access" || kind === "experience";

  const submit = () => {
    if (needsReview) {
      setReviewing(true);
      return;
    }
    onCreated?.(kind!, title || chosen!.label);
    close();
  };

  if (!kind) {
    return (
      <Sheet open={open} onClose={close} title="Add" testId="composer-sheet">
        <ul className="list">
          {options.map((o) => {
            const Icon = iconFor(o.icon);
            return (
              <li key={o.kind}>
                <button
                  type="button"
                  className="row"
                  onClick={() => setKind(o.kind)}
                  data-testid={`composer-option-${o.kind}`}
                >
                  <span className="row__icon" aria-hidden="true">
                    <Icon size={18} strokeWidth={1.6} />
                  </span>
                  <span className="row__body">
                    <span className="row__title">{o.label}</span>
                    <span className="row__detail">{o.detail}</span>
                  </span>
                  <span className="row__trailing">
                    <ChevronRight size={18} className="row__chev" aria-hidden="true" />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </Sheet>
    );
  }

  return (
    <>
      <Sheet
        open={open && !reviewing}
        onClose={close}
        title={chosen!.label}
        testId="composer-form"
        footer={
          <>
            <SecondaryButton onClick={() => setKind(null)}>Back</SecondaryButton>
            <PrimaryButton onClick={submit} data-testid="composer-submit">
              {needsReview ? "Review" : "Create"}
            </PrimaryButton>
          </>
        }
      >
        <div style={{ display: "grid", gap: 16, paddingTop: 4 }}>
          <TextField
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={chosen!.detail}
          />

          {kind === "experience" ? (
            <DateTimeField label="Starts" value={`${date}T19:30`} />
          ) : (
            <DateRangeField label="Date" value={date} onChange={setDate} />
          )}

          {kind === "access" || kind === "experience" ? (
            <PeopleStepper label="People" value={people} onChange={setPeople} />
          ) : null}

          {kind === "due" ? (
            <MoneyField label="Amount" value={amount} onChange={setAmount} />
          ) : null}

          {kind === "access" || kind === "space_reset" ? (
            <SelectRow
              label="Space"
              options={[
                { value: "space-roca-llisa", label: "Roca Llisa" },
                { value: "space-can-verde", label: "Can Verde" },
                { value: "space-marina", label: "North pontoon" },
                { value: "space-studio", label: "Terrace studio" },
              ]}
            />
          ) : null}

          {kind === "request" ? (
            <SelectRow
              label="Gate"
              options={[
                { value: "gate-north", label: "North Gate" },
                { value: "gate-founding", label: "Founding circle" },
                { value: "gate-marina", label: "Marina programme" },
              ]}
            />
          ) : null}

          <TextArea
            label="Note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={280}
          />
        </div>
      </Sheet>

      <ConfirmSheet
        open={reviewing}
        onClose={() => setReviewing(false)}
        onConfirm={() => {
          onCreated?.(kind, title || chosen!.label);
          close();
        }}
        title={`Create ${chosen!.label.toLowerCase()}?`}
        confirmLabel="Create"
        facts={[
          { icon: "calendar-range", label: "Date", value: date },
          { icon: "pencil", label: "Title", value: title || chosen!.label },
          ...(kind === "due" && amount
            ? [{ icon: "euro", label: "Amount", value: `€${amount}` }]
            : []),
          ...(kind === "access" || kind === "experience"
            ? [{ icon: "person", label: "People", value: String(people) }]
            : []),
        ]}
      />
    </>
  );
}
