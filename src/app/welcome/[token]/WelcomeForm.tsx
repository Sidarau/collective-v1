"use client";

import { useState } from "react";

export default function WelcomeForm({
  token,
  kind,
  firstName,
  lastName,
}: {
  token: string;
  kind: "member_returning" | "member_new" | "instant_member";
  firstName: string;
  lastName: string;
}) {
  const returning = kind === "member_returning" || kind === "instant_member";
  const [form, setForm] = useState({ email: "", firstName, lastName });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/welcome", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, ...form }),
      });
      const data = (await res.json()) as { destination?: string; error?: string };
      if (!res.ok || !data.destination) {
        setError(data.error || "Something went wrong — try again.");
        return;
      }
      window.location.href = data.destination;
    } catch {
      setError("Connection issue — try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="glass-strong reveal w-full max-w-sm p-7" style={{ animationDelay: "0.08s" }}>
      <p className="eyebrow">{returning ? "Welcome back" : "You were vouched for"}</p>
      <h1 className="display mt-2 text-[26px] leading-tight text-ink">
        {firstName ? `${firstName}, the` : "The"} Gate remembers you.
      </h1>
      <p className="muted mt-2 text-[13.5px] leading-relaxed">
        {returning
          ? "You've stayed with us before, so there's no application and no call — just leave the email you want your entrance tied to, then choose a password."
          : "Leave the email you want your entrance tied to. You'll introduce yourself to the Circle right after."}
      </p>

      <form onSubmit={submit} className="mt-6 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="tag">First name</label>
            <input
              required
              className="field"
              value={form.firstName}
              onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
            />
          </div>
          <div>
            <label className="tag">Last name</label>
            <input
              className="field"
              value={form.lastName}
              onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
            />
          </div>
        </div>
        <div>
          <label className="tag">Email</label>
          <input
            type="email"
            required
            autoComplete="email"
            className="field"
            placeholder="you@example.com"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
        </div>

        {error && <p className="notice notice-red">{error}</p>}

        <button type="submit" disabled={loading} className="btn-champagne tap h-[52px] w-full text-[15px]">
          {loading ? "Opening…" : returning ? "Claim your entrance" : "Continue"}
        </button>
        <p className="faint text-center text-[12px] leading-relaxed">
          Your number stays private — it links this entrance to your WhatsApp.
        </p>
      </form>
    </div>
  );
}
