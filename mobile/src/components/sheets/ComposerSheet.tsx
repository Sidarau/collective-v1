"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import {
  LINK_KINDS_BY_COMPOSER,
  LINK_TARGET_LABELS,
  type ComposerKind,
  type ComposerOption,
  type LinkTarget,
} from "@/data/contracts";
import { createFromComposerAction } from "@/app/actions";
import { Icon } from "@/lib/icons";
import { PrimaryButton, SecondaryButton } from "@/components/ui/primitives";
import {
  DateRangeField,
  DateTimeField,
  MoneyField,
  PeopleStepper,
  TextArea,
  TextField,
} from "@/components/ui/forms";
import { Sheet } from "./Sheet";
import { ConfirmSheet } from "./ConfirmSheet";
import { LinkPickerSheet } from "./LinkPickerSheet";

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
  const [link, setLink] = useState<LinkTarget | null>(null);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    setLink(null);
    setPicking(false);
    setBusy(false);
    setError(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const chosen = options.find((o) => o.kind === kind);

  // Money, access and experience creation is material — it must be reviewed.
  const needsReview = kind === "due" || kind === "access" || kind === "experience";

  const create = async () => {
    if (!kind || busy) return;
    setBusy(true);
    setError(null);
    const result = await createFromComposerAction({
      kind,
      title: title || chosen!.label,
      date,
      people,
      amount,
      note,
      link: link ? { id: link.id, kind: link.kind } : undefined,
    });
    setBusy(false);
    if (!result.ok) {
      setReviewing(false);
      setError(result.message);
      return;
    }
    onCreated?.(kind, title || chosen!.label);
    close();
  };

  const submit = () => {
    if (needsReview) {
      setReviewing(true);
      return;
    }
    void create();
  };

  if (!kind) {
    return (
      <Sheet open={open} onClose={close} title="Add" testId="composer-sheet">
        <ul className="list">
          {options.map((o) => (
              <li key={o.kind}>
                <button
                  type="button"
                  className="row"
                  onClick={() => setKind(o.kind)}
                  data-testid={`composer-option-${o.kind}`}
                >
                  <span className="row__icon" aria-hidden="true">
                    <Icon name={o.icon} size={18} />
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
          ))}
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
            <PrimaryButton onClick={submit} disabled={busy} data-testid="composer-submit">
              {busy ? "Creating…" : needsReview ? "Review" : "Create"}
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

          {/* Nothing is created free-floating: every item attaches to a
              Space, Person, partner, experience or Gate. */}
          <div className="field">
            <span className="field__label" id="composer-link-label">
              Link to
            </span>
            <button
              type="button"
              className="control link-row"
              onClick={() => setPicking(true)}
              aria-labelledby="composer-link-label"
              data-testid="composer-link"
            >
              {link ? (
                <span className="row__body">
                  <span className="row__title">{link.label}</span>
                  <span className="row__detail">
                    {LINK_TARGET_LABELS[link.kind].replace(/s$/, "")}
                    {link.detail ? ` · ${link.detail}` : ""}
                  </span>
                </span>
              ) : (
                <span style={{ color: "var(--color-ink-dim)" }}>
                  Choose a Space, person, partner…
                </span>
              )}
              <ChevronRight size={17} className="row__chev" aria-hidden="true" />
            </button>
          </div>

          <TextArea
            label="Note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={280}
          />
          {error ? (
            <p className="banner banner--error" role="alert" data-testid="composer-error">
              {error}
            </p>
          ) : null}
        </div>
      </Sheet>

      <LinkPickerSheet
        open={picking}
        onClose={() => setPicking(false)}
        onSelect={setLink}
        selectedId={link?.id}
        preferredKinds={LINK_KINDS_BY_COMPOSER[kind]}
      />

      <ConfirmSheet
        open={reviewing}
        onClose={() => setReviewing(false)}
        onConfirm={() => void create()}
        title={`Create ${chosen!.label.toLowerCase()}?`}
        confirmLabel="Create"
        facts={[
          { icon: "calendar-range", label: "Date", value: date },
          { icon: "pencil", label: "Title", value: title || chosen!.label },
          ...(link
            ? [
                {
                  icon: "landmark",
                  label: LINK_TARGET_LABELS[link.kind].replace(/s$/, ""),
                  value: link.label,
                },
              ]
            : []),
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
