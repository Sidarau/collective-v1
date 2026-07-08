"use client";

import { useState } from "react";

const EMPTY = {
  name: "",
  email: "",
  phone: "",
  roleApplied: "",
  experience: "",
  links: "",
  message: "",
};

export default function StaffForm() {
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set =
    (key: keyof typeof EMPTY) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((current) => ({ ...current, [key]: event.target.value }));
      setError(null);
    };

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Could not submit your note.");
        return;
      }
      setDone(true);
      setForm(EMPTY);
    } catch {
      setError("Connection issue. Try again in a moment.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="glass p-6">
        <span className="chip chip-olive">Received</span>
        <p className="mt-4 text-[17px] font-semibold text-ink">
          Thanks — the house team will review this.
        </p>
        <p className="muted mt-2 text-[13px]">
          If there is a fit for the season, someone will reach out directly.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="glass space-y-4 p-5">
      <div>
        <label className="tag">Name</label>
        <input className="field" value={form.name} onChange={set("name")} required />
      </div>
      <div>
        <label className="tag">Email</label>
        <input className="field" type="email" value={form.email} onChange={set("email")} required />
      </div>
      <div>
        <label className="tag">Phone / WhatsApp</label>
        <input className="field" value={form.phone} onChange={set("phone")} />
      </div>
      <div>
        <label className="tag">Role</label>
        <input
          className="field"
          value={form.roleApplied}
          onChange={set("roleApplied")}
          placeholder="Chef, concierge, driver, house manager..."
          required
        />
      </div>
      <div>
        <label className="tag">Experience</label>
        <textarea className="field min-h-28" value={form.experience} onChange={set("experience")} />
      </div>
      <div>
        <label className="tag">Links</label>
        <input
          className="field"
          value={form.links}
          onChange={set("links")}
          placeholder="Website, Instagram, LinkedIn, portfolio"
        />
      </div>
      <div>
        <label className="tag">Anything else?</label>
        <textarea className="field min-h-24" value={form.message} onChange={set("message")} />
      </div>
      {error && (
        <p className="notice notice-red w-full py-2">
          {error}
        </p>
      )}
      <button disabled={loading} className="btn-champagne tap h-12 w-full text-[14px]">
        {loading ? "Sending..." : "Send application"}
      </button>
    </form>
  );
}
