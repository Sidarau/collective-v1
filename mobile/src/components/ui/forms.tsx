"use client";

import { useId, useState } from "react";
import { Check, ChevronDown, Minus, Plus, Search } from "lucide-react";

/** Every field keeps its label visible — placeholders are never the label. */
function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="field">
      <label className="field__label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {error ? (
        <span className="field__error" role="alert">
          {error}
        </span>
      ) : hint ? (
        <span className="field__hint">{hint}</span>
      ) : null}
    </div>
  );
}

export function TextField({
  label,
  hint,
  error,
  ...rest
}: { label: string; hint?: string; error?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <Field label={label} hint={hint} error={error} htmlFor={id}>
      <input
        id={id}
        className="control"
        aria-invalid={error ? true : undefined}
        {...rest}
      />
    </Field>
  );
}

export function TextArea({
  label,
  hint,
  maxLength,
  value,
  ...rest
}: { label: string; hint?: string } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  const count = typeof value === "string" ? value.length : 0;
  return (
    <Field
      label={label}
      /* Character count appears only when the field is actually limited. */
      hint={maxLength ? `${count}/${maxLength}` : hint}
      htmlFor={id}
    >
      <textarea id={id} className="control" rows={3} maxLength={maxLength} value={value} {...rest} />
    </Field>
  );
}

/** Debounced by the caller at 150–250ms. */
export function SearchField({
  label,
  ...rest
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <div className="search-field">
      <label className="sr-only" htmlFor={id}>
        {label}
      </label>
      <Search size={17} aria-hidden="true" />
      <input id={id} type="search" className="control" placeholder={label} {...rest} />
    </div>
  );
}

export function SelectRow({
  label,
  options,
  hint,
  ...rest
}: {
  label: string;
  options: { value: string; label: string }[];
  hint?: string;
} & React.SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId();
  return (
    <Field label={label} hint={hint} htmlFor={id}>
      <div className="select-wrap">
        <select id={id} className="control" {...rest}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown size={16} aria-hidden="true" />
      </div>
    </Field>
  );
}

/** Access periods. The date convention is always stated. */
export function DateRangeField({
  label,
  value,
  onChange,
  timezoneNote = "Dates use the Collective operating timezone",
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  timezoneNote?: string;
}) {
  const id = useId();
  return (
    <Field label={label} hint={timezoneNote} htmlFor={id}>
      <input
        id={id}
        type="date"
        className="control"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
      />
    </Field>
  );
}

/** Only for moments where time is operationally meaningful. */
export function DateTimeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
}) {
  const id = useId();
  return (
    <Field label={label} htmlFor={id}>
      <input
        id={id}
        type="datetime-local"
        className="control"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
      />
    </Field>
  );
}

export function MoneyField({
  label,
  currency = "EUR",
  value,
  onChange,
}: {
  label: string;
  currency?: string;
  value: string;
  onChange?: (v: string) => void;
}) {
  const id = useId();
  return (
    <Field label={label} hint={`Amount in ${currency}`} htmlFor={id}>
      <input
        id={id}
        className="control tnum"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
      />
    </Field>
  );
}

export function PeopleStepper({
  label,
  value,
  onChange,
  min = 1,
  max = 40,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className="field">
      <span className="field__label" id={`${label}-label`}>
        {label}
      </span>
      <div className="stepper" role="group" aria-labelledby={`${label}-label`}>
        <button
          type="button"
          className="stepper__btn"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          aria-label={`Decrease ${label.toLowerCase()}`}
        >
          <Minus size={18} aria-hidden="true" />
        </button>
        <output className="stepper__value" aria-live="polite">
          {value}
        </output>
        <button
          type="button"
          className="stepper__btn"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          aria-label={`Increase ${label.toLowerCase()}`}
        >
          <Plus size={18} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

/** Immediate, reversible preferences only — never destructive actions. */
export function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className="toggle"
      onClick={() => onChange(!checked)}
    >
      <span className="toggle__knob" aria-hidden="true" />
    </button>
  );
}

export function CheckboxRow({
  label,
  detail,
  checked,
  onChange,
}: {
  label: string;
  detail?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      className="check-row"
      onClick={() => onChange(!checked)}
    >
      <span className="checkbox" aria-checked={checked} aria-hidden="true">
        <Check size={15} strokeWidth={3} />
      </span>
      <span className="row__body">
        <span className="row__title">{label}</span>
        {detail ? <span className="row__detail">{detail}</span> : null}
      </span>
    </button>
  );
}

export function RadioGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="field" role="radiogroup" aria-label={label}>
      <span className="field__label">{label}</span>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className="check-row"
          onClick={() => onChange(o.value)}
        >
          <span className="radio" aria-checked={value === o.value} aria-hidden="true" />
          <span className="row__title">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className="segmented__item"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Access handoff and upkeep. Large targets, visible progress. */
export function Checklist({
  label,
  items,
}: {
  label: string;
  items: { id: string; label: string; detail?: string; done?: boolean }[];
}) {
  const [state, setState] = useState<Record<string, boolean>>(
    Object.fromEntries(items.map((i) => [i.id, Boolean(i.done)])),
  );
  const done = Object.values(state).filter(Boolean).length;

  return (
    <div className="field">
      <span className="field__label">
        {label} — {done}/{items.length} complete
      </span>
      {items.map((i) => (
        <CheckboxRow
          key={i.id}
          label={i.label}
          detail={i.detail}
          checked={Boolean(state[i.id])}
          onChange={(v) => setState((s) => ({ ...s, [i.id]: v }))}
        />
      ))}
    </div>
  );
}
