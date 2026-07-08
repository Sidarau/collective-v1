"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Initial {
  firstName: string;
  lastName: string;
  headline: string;
  location: string;
  bio: string;
  contribution: string;
  phone: string;
  whatsapp: string;
  allergies: string;
  dietary: string;
}

export default function OnboardingForm({ initial }: { initial: Initial }) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof Initial) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password && password.length < 8) {
      setError("Password needs at least 8 characters.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Something went wrong — try again.");
        return;
      }
      if (password) {
        await fetch("/api/auth/set-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        });
      }
      router.push("/app");
      router.refresh();
    } catch {
      setError("Connection issue — try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="glass p-6 sm:p-7">
      <p className="eyebrow mb-4">Your profile</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="tag">First name</label>
          <input required className="field" value={form.firstName} onChange={set("firstName")} />
        </div>
        <div>
          <label className="tag">Last name</label>
          <input required className="field" value={form.lastName} onChange={set("lastName")} />
        </div>
      </div>
      <div className="mt-4">
        <label className="tag">What you do</label>
        <input required className="field" placeholder="One line — shown to members" value={form.headline} onChange={set("headline")} />
      </div>
      <div className="mt-4">
        <label className="tag">Where you&apos;re based</label>
        <input required className="field" value={form.location} onChange={set("location")} />
      </div>
      <div className="mt-4">
        <label className="tag">About you</label>
        <textarea className="field" placeholder="A few sentences for the member directory" value={form.bio} onChange={set("bio")} />
      </div>
      <div className="mt-4">
        <label className="tag">What you bring to the Circle</label>
        <textarea className="field" value={form.contribution} onChange={set("contribution")} />
      </div>

      <p className="eyebrow mb-4 mt-8">For your stays</p>
      <div>
        <label className="tag">Allergies</label>
        <input className="field" placeholder="Anything the kitchen must know" value={form.allergies} onChange={set("allergies")} />
      </div>
      <div className="mt-4">
        <label className="tag">Dietary preferences</label>
        <input className="field" placeholder="Vegetarian, no shellfish…" value={form.dietary} onChange={set("dietary")} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <label className="tag">Phone</label>
          <input className="field" type="tel" value={form.phone} onChange={set("phone")} />
        </div>
        <div>
          <label className="tag">WhatsApp</label>
          <input className="field" type="tel" value={form.whatsapp} onChange={set("whatsapp")} />
        </div>
      </div>

      <p className="eyebrow mb-4 mt-8">Return access</p>
      <div>
        <label className="tag">Set a password (optional)</label>
        <input
          className="field"
          type="password"
          autoComplete="new-password"
          placeholder="For your next visits — or keep using email links"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      {error && (
        <p className="notice notice-red mt-5 w-full py-2">{error}</p>
      )}

      <button type="submit" disabled={loading} className="btn-champagne tap mt-6 h-[52px] w-full text-[15px]">
        {loading ? "Opening the Gate…" : "Enter the Circle"}
      </button>
    </form>
  );
}
