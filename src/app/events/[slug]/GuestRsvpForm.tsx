"use client";

import Link from "next/link";
import { useState } from "react";

interface Props {
  eventId: string;
}

interface FormState {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  instagram: string;
  birthday: string;
  note: string;
  consent: boolean;
}

const initial: FormState = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  instagram: "",
  birthday: "",
  note: "",
  consent: false,
};

export default function GuestRsvpForm({ eventId }: Props) {
  const [form, setForm] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ status?: string; error?: string } | null>(null);

  const setText =
    (key: Exclude<keyof FormState, "consent">) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((current) => ({ ...current, [key]: e.target.value }));
    };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/public-events/rsvp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, ...form }),
      });
      const data = (await res.json()) as { status?: string; error?: string };
      if (!res.ok) {
        setResult({ error: data.error || "Could not save your RSVP." });
        return;
      }
      setResult({ status: data.status || "going" });
    } catch {
      setResult({ error: "Connection issue — try again." });
    } finally {
      setLoading(false);
    }
  }

  if (result?.status) {
    return (
      <div className="notice notice-olive">
        {result.status === "waitlist"
          ? "You are on the guest list waitlist. We will confirm if space opens."
          : "You are on the guest list. We will send practical details before the event."}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="tag">First name</label>
          <input required className="field" value={form.firstName} onChange={setText("firstName")} />
        </div>
        <div>
          <label className="tag">Last name</label>
          <input required className="field" value={form.lastName} onChange={setText("lastName")} />
        </div>
      </div>
      <div>
        <label className="tag">Email</label>
        <input
          required
          type="email"
          autoComplete="email"
          className="field"
          value={form.email}
          onChange={setText("email")}
          placeholder="you@example.com"
        />
      </div>
      <div>
        <label className="tag">Phone</label>
        <input
          required
          type="tel"
          autoComplete="tel"
          className="field"
          value={form.phone}
          onChange={setText("phone")}
          placeholder="+34 600 123 456"
        />
      </div>
      <div>
        <label className="tag">Instagram</label>
        <input className="field" value={form.instagram} onChange={setText("instagram")} placeholder="@handle" />
      </div>
      <div>
        <label className="tag">Birthday (optional)</label>
        <input
          className="field"
          type="date"
          max={new Date().toISOString().slice(0, 10)}
          value={form.birthday}
          onChange={setText("birthday")}
        />
      </div>
      <div>
        <label className="tag">Note</label>
        <textarea
          className="field"
          value={form.note}
          onChange={setText("note")}
          placeholder="Who invited you, dietary notes, or anything useful"
        />
      </div>

      <label className="flex gap-3 text-[12.5px] leading-relaxed text-ink/70">
        <input
          required
          type="checkbox"
          checked={form.consent}
          onChange={(e) => setForm((current) => ({ ...current, consent: e.target.checked }))}
          className="mt-1 h-4 w-4 shrink-0 accent-champagne"
        />
        <span>
          I agree to the{" "}
          <Link href="/terms" className="text-champagne underline-offset-4 hover:underline">
            Terms
          </Link>{" "}
          and understand how my RSVP data is handled in the{" "}
          <Link href="/privacy" className="text-champagne underline-offset-4 hover:underline">
            Privacy notice
          </Link>
          .
        </span>
      </label>

      {result?.error && <p className="notice notice-red">{result.error}</p>}

      <button type="submit" disabled={loading} className="btn-champagne tap h-[52px] w-full text-[15px]">
        {loading ? "Saving..." : "Request guest list"}
      </button>
    </form>
  );
}
