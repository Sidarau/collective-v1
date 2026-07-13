"use client";

import { useState } from "react";

/**
 * Form-friendly label picker: chips + dropdown of known labels + free-text
 * custom add. Submits as a hidden JSON-array input under `name`, so plain
 * server actions can parse it without client wiring.
 */
export default function LabelsInput({
  name,
  suggestions,
  initial,
  placeholder = "custom label",
}: {
  name: string;
  suggestions: string[];
  initial?: string[];
  placeholder?: string;
}) {
  const [labels, setLabels] = useState<string[]>(initial || []);
  const [custom, setCustom] = useState("");

  const has = (label: string) => labels.some((l) => l.toLowerCase() === label.toLowerCase());
  const add = (raw: string) => {
    const label = raw.trim().replace(/\s+/g, " ").slice(0, 40);
    if (label && !has(label)) setLabels((prev) => [...prev, label]);
  };
  const remove = (label: string) => setLabels((prev) => prev.filter((l) => l !== label));
  const available = suggestions.filter((s) => !has(s));

  return (
    <div>
      <input type="hidden" name={name} value={JSON.stringify(labels)} />
      {labels.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {labels.map((label) => (
            <span key={label} className="chip chip-gold inline-flex items-center gap-1.5">
              {label}
              <button
                type="button"
                onClick={() => remove(label)}
                aria-label={`Remove ${label}`}
                className="-mr-0.5 text-[13px] leading-none opacity-70 hover:opacity-100"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <select
          className="input h-9 w-auto min-w-[130px] text-[12.5px]"
          value=""
          onChange={(e) => e.target.value && add(e.target.value)}
          aria-label="Add a known label"
        >
          <option value="">+ Add label…</option>
          {available.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <input
          className="input h-9 w-36 text-[12.5px]"
          placeholder={placeholder}
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(custom);
              setCustom("");
            }
          }}
        />
        <button
          type="button"
          className="btn h-9 px-3"
          onClick={() => {
            add(custom);
            setCustom("");
          }}
        >
          +
        </button>
      </div>
    </div>
  );
}
