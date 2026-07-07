"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ReferralForm({ code }: { code: string }) {
  const router = useRouter();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    location: "",
    occupation: "",
    motivation: "",
    contribution: "",
    referredBy: "",
    instagram: "",
    linkedin: "",
    phone: "",
    whatsapp: "",
    preferredWindow: "",
    website: "", // honeypot
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set =
    (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
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
      const data = (await res.json()) as { error?: string; redirect?: string; schedulingUrl?: string };
      if (!res.ok) {
        if (data.redirect) {
          router.push(data.redirect);
          return;
        }
        setError(data.error || "Something went wrong — try again.");
        return;
      }
      router.push(data.schedulingUrl || "/");
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

      <div className="mt-4">
        <label className="tag">Where are you based?</label>
        <input required className="field" placeholder="City, country" value={form.location} onChange={set("location")} />
      </div>

      <div className="mt-4">
        <label className="tag">What do you do?</label>
        <input
          required
          className="field"
          placeholder="Founder, investor, artist…"
          value={form.occupation}
          onChange={set("occupation")}
        />
      </div>

      <div className="mt-4">
        <label className="tag">Why do you want to join?</label>
        <textarea
          required
          className="field"
          placeholder="What draws you to the Circle — and what are you hoping to find here?"
          value={form.motivation}
          onChange={set("motivation")}
        />
      </div>

      <div className="mt-4">
        <label className="tag">What would you bring?</label>
        <textarea
          required
          className="field"
          placeholder="A session you could host, introductions you could make, a craft you could share…"
          value={form.contribution}
          onChange={set("contribution")}
        />
      </div>

      <div className="mt-4">
        <label className="tag">Who opened the door for you?</label>
        <input
          className="field"
          placeholder="The person who shared this link"
          value={form.referredBy}
          onChange={set("referredBy")}
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <label className="tag">Instagram</label>
          <input className="field" placeholder="@handle" value={form.instagram} onChange={set("instagram")} />
        </div>
        <div>
          <label className="tag">LinkedIn</label>
          <input className="field" placeholder="Profile URL" value={form.linkedin} onChange={set("linkedin")} />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <label className="tag">Phone</label>
          <input className="field" type="tel" autoComplete="tel" value={form.phone} onChange={set("phone")} />
        </div>
        <div>
          <label className="tag">WhatsApp</label>
          <input className="field" type="tel" value={form.whatsapp} onChange={set("whatsapp")} />
        </div>
      </div>

      <div className="mt-4">
        <label className="tag">When could you see yourself at the Gate? (optional)</label>
        <input
          className="field"
          placeholder="e.g. late July, first half of August"
          value={form.preferredWindow}
          onChange={set("preferredWindow")}
        />
      </div>

      {error && (
        <p className="chip chip-red mt-5 w-full whitespace-normal py-2 normal-case tracking-normal">{error}</p>
      )}

      <button type="submit" disabled={loading} className="btn-champagne tap mt-6 h-[52px] w-full text-[15px]">
        {loading ? "Sending…" : "Continue to schedule your call"}
      </button>
      <p className="faint mt-4 text-center text-[12px] leading-relaxed">
        Next: choose fifteen minutes with the host. Reviewed personally by the founding circle.
      </p>
    </form>
  );
}
