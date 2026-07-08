"use client";

import { useState } from "react";

const ROLES = [
  "Housekeeping",
  "Chef / Kitchen",
  "Maintenance",
  "Gardening",
  "Driver",
  "Security",
  "Wellness / Spa",
  "Events",
  "Other",
];

export default function VendorForm({ code }: { code: string }) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    roleApplied: ROLES[0],
    experience: "",
    links: "",
    message: "",
    website: "", // honeypot
  });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set =
    (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/vendor/${code}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Something went wrong — try again.");
        return;
      }
      setDone(true);
    } catch {
      setError("Connection issue — try again.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="glass-strong p-8 text-center">
        <span className="chip chip-olive">Received</span>
        <h2 className="display mt-5 text-[26px] leading-[1.15] text-ink">
          Thank you — we have your details.
        </h2>
        <p className="muted mt-4 text-[15px] leading-relaxed">
          The house reviews every application. If it fits, you&apos;ll receive an
          email inviting you to a short call.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="glass p-6 sm:p-7">
      <div>
        <label className="tag">Full name</label>
        <input required className="field" value={form.name} onChange={set("name")} autoComplete="name" />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <label className="tag">Email</label>
          <input required type="email" className="field" value={form.email} onChange={set("email")} autoComplete="email" />
        </div>
        <div>
          <label className="tag">Phone</label>
          <input className="field" type="tel" value={form.phone} onChange={set("phone")} autoComplete="tel" />
        </div>
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

      <div className="mt-4">
        <label className="tag">Company (if any)</label>
        <input className="field" placeholder="Your business or agency" value={form.company} onChange={set("company")} />
      </div>

      <div className="mt-4">
        <label className="tag">What do you do?</label>
        <select className="field" value={form.roleApplied} onChange={set("roleApplied")}>
          {ROLES.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4">
        <label className="tag">Experience</label>
        <textarea
          className="field"
          placeholder="Where have you worked? Villas, hotels, private households…"
          value={form.experience}
          onChange={set("experience")}
        />
      </div>

      <div className="mt-4">
        <label className="tag">Links (optional)</label>
        <input
          className="field"
          placeholder="Website, portfolio, references"
          value={form.links}
          onChange={set("links")}
        />
      </div>

      <div className="mt-4">
        <label className="tag">Anything else?</label>
        <textarea
          className="field"
          placeholder="Availability, rates, languages…"
          value={form.message}
          onChange={set("message")}
        />
      </div>

      {error && (
        <p className="notice notice-red mt-5 w-full py-2">{error}</p>
      )}

      <button type="submit" disabled={loading} className="btn-champagne tap mt-6 h-[52px] w-full text-[15px]">
        {loading ? "Sending…" : "Send application"}
      </button>
      <p className="faint mt-4 text-center text-[12px] leading-relaxed">
        If it fits, you&apos;ll be invited to a fifteen-minute call.
      </p>
    </form>
  );
}
