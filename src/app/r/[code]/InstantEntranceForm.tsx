"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Instant doors skip the application and the host call entirely: the form
 * creates a member account and mints a session; the next stop is choosing a
 * password. Kept deliberately short — these links travel in investor decks
 * and on QR cards.
 */
export default function InstantEntranceForm({ code }: { code: string }) {
  const router = useRouter();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    birthday: "",
    website: "", // honeypot
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set =
    (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/referral/${code}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await res.json()) as { error?: string; redirect?: string; destination?: string };
      if (!res.ok) {
        if (data.redirect) {
          router.push(data.redirect);
          return;
        }
        setError(data.error || "Something went wrong — try again.");
        return;
      }
      router.push(data.destination || "/");
      router.refresh();
    } catch {
      setError("Connection issue — try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="glass p-6 sm:p-7">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="tag">First name</label>
          <input required className="field" value={form.firstName} onChange={set("firstName")} autoComplete="given-name" />
        </div>
        <div>
          <label className="tag">Last name</label>
          <input required className="field" value={form.lastName} onChange={set("lastName")} autoComplete="family-name" />
        </div>
      </div>

      <div className="mt-4">
        <label className="tag">Email</label>
        <input
          required
          type="email"
          className="field"
          placeholder="you@example.com"
          value={form.email}
          onChange={set("email")}
          autoComplete="email"
        />
      </div>

      {/* Honeypot — humans never see it. */}
      <input
        type="text"
        name="website"
        value={form.website}
        onChange={set("website")}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute -left-[9999px] h-0 w-0 opacity-0"
      />

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="min-w-0">
          <label className="tag">Phone (optional)</label>
          <input className="field" type="tel" autoComplete="tel" value={form.phone} onChange={set("phone")} />
        </div>
        <div className="min-w-0">
          <label className="tag">Birthday (optional)</label>
          <input
            className="field"
            type="date"
            max={new Date().toISOString().slice(0, 10)}
            value={form.birthday}
            onChange={set("birthday")}
          />
        </div>
      </div>

      {error && <p className="notice notice-red mt-5 w-full py-2">{error}</p>}

      <button type="submit" disabled={loading} className="btn-champagne tap mt-6 h-[52px] w-full text-[15px]">
        {loading ? "Opening…" : "Step inside"}
      </button>
      <p className="faint mt-4 text-center text-[12px] leading-relaxed">
        Next: choose a password. Your membership opens immediately.
      </p>
    </form>
  );
}
