"use client";

import { useState } from "react";
import SignOutButton from "@/components/SignOutButton";

interface ProfileFields {
  firstName: string;
  lastName: string;
  headline: string;
  location: string;
  bio: string;
  contribution: string;
  allergies: string;
  dietary: string;
  phone: string;
  whatsapp: string;
}

export default function ProfileForm({
  initial,
  canInvite,
}: {
  initial: ProfileFields;
  canInvite: boolean;
}) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Referral block
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invite, setInvite] = useState({ email: "", firstName: "", lastName: "" });
  const [inviteState, setInviteState] = useState<{ loading?: boolean; message?: string; error?: string }>({});

  const set = (key: keyof ProfileFields) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setSaved(false);
    setForm((f) => ({ ...f, [key]: e.target.value }));
  };

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Could not save.");
        return;
      }
      setSaved(true);
    } catch {
      setError("Connection issue — try again.");
    } finally {
      setSaving(false);
    }
  }

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteState({ loading: true });
    try {
      const res = await fetch("/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(invite),
      });
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) {
        setInviteState({ error: data.error || "Could not send the invitation." });
        return;
      }
      setInviteState({ message: data.message || "Invitation sent." });
      setInvite({ email: "", firstName: "", lastName: "" });
    } catch {
      setInviteState({ error: "Connection issue — try again." });
    }
  }

  return (
    <div className="space-y-4 pb-4">
      <form onSubmit={save} className="glass p-6">
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
          <input className="field" value={form.headline} onChange={set("headline")} />
        </div>
        <div className="mt-4">
          <label className="tag">Where you&apos;re based</label>
          <input className="field" value={form.location} onChange={set("location")} />
        </div>
        <div className="mt-4">
          <label className="tag">About you</label>
          <textarea className="field" value={form.bio} onChange={set("bio")} />
        </div>
        <div className="mt-4">
          <label className="tag">What you bring</label>
          <textarea className="field" value={form.contribution} onChange={set("contribution")} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <label className="tag">Allergies</label>
            <input className="field" value={form.allergies} onChange={set("allergies")} />
          </div>
          <div>
            <label className="tag">Dietary</label>
            <input className="field" value={form.dietary} onChange={set("dietary")} />
          </div>
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

        {error && (
          <p className="chip chip-red mt-4 w-full whitespace-normal py-2 normal-case tracking-normal">{error}</p>
        )}
        <button type="submit" disabled={saving} className="btn-champagne tap mt-5 h-12 w-full text-[14px]">
          {saving ? "Saving…" : saved ? "Saved" : "Save profile"}
        </button>
      </form>

      {canInvite && (
        <div className="glass p-6">
          <p className="eyebrow">Extend an invitation</p>
          <p className="muted mt-2 text-[13px] leading-relaxed">
            Open the door for someone who belongs here. They&apos;ll receive a private
            entrance link and introduce themselves to the Circle.
          </p>
          {inviteOpen ? (
            <form onSubmit={sendInvite} className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input
                  required
                  className="field"
                  placeholder="First name"
                  value={invite.firstName}
                  onChange={(e) => setInvite((i) => ({ ...i, firstName: e.target.value }))}
                />
                <input
                  required
                  className="field"
                  placeholder="Last name"
                  value={invite.lastName}
                  onChange={(e) => setInvite((i) => ({ ...i, lastName: e.target.value }))}
                />
              </div>
              <input
                required
                type="email"
                className="field"
                placeholder="Their email"
                value={invite.email}
                onChange={(e) => setInvite((i) => ({ ...i, email: e.target.value }))}
              />
              {inviteState.error && (
                <p className="chip chip-red w-full whitespace-normal py-2 normal-case tracking-normal">
                  {inviteState.error}
                </p>
              )}
              <button type="submit" disabled={inviteState.loading} className="btn-glass tap h-12 w-full text-[14px]">
                {inviteState.loading ? "Sending…" : "Send the entrance link"}
              </button>
            </form>
          ) : inviteState.message ? (
            <p className="chip chip-olive mt-4 w-full whitespace-normal py-2 normal-case tracking-normal">
              {inviteState.message}
            </p>
          ) : (
            <button onClick={() => setInviteOpen(true)} className="btn-glass tap mt-4 h-12 w-full text-[14px]">
              Refer someone
            </button>
          )}
        </div>
      )}

      <div className="flex justify-center pt-2">
        <SignOutButton />
      </div>
    </div>
  );
}
