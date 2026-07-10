"use client";

import { useRef, useState } from "react";
import Image from "next/image";
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
  birthday: string;
  phone: string;
  whatsapp: string;
}

export default function ProfileForm({
  initial,
  initialAvatarUrl,
  canInvite,
}: {
  initial: ProfileFields;
  initialAvatarUrl?: string | null;
  canInvite: boolean;
}) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Avatar
  const fileRef = useRef<HTMLInputElement>(null);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl || null);
  const [avatarBusy, setAvatarBusy] = useState(false);

  async function uploadAvatar(file: File) {
    setAvatarBusy(true);
    setError(null);
    const preview = URL.createObjectURL(file);
    const previous = avatarUrl;
    setAvatarUrl(preview);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/profile/avatar", { method: "POST", body });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setAvatarUrl(previous);
        setError(data.error || "Could not upload the photo.");
        return;
      }
      setAvatarUrl(data.url);
    } catch {
      setAvatarUrl(previous);
      setError("Connection issue — try again.");
    } finally {
      URL.revokeObjectURL(preview);
      setAvatarBusy(false);
    }
  }

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
        {/* Portrait */}
        <div className="mb-6 flex items-center gap-5">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="tap group relative h-24 w-24 shrink-0 overflow-hidden rounded-full border border-white/20"
            aria-label="Change your photo"
          >
            {avatarUrl ? (
              <Image src={avatarUrl} alt="" fill sizes="96px" className="object-cover" unoptimized={avatarUrl.startsWith("blob:")} />
            ) : (
              <span className="flex h-full w-full items-center justify-center bg-champagne/20 text-[30px] font-semibold text-champagne">
                {(form.firstName[0] || "").toUpperCase()}
                {(form.lastName[0] || "").toUpperCase()}
              </span>
            )}
            <span className="absolute inset-x-0 bottom-0 bg-black/55 py-1 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-ink backdrop-blur-sm">
              {avatarBusy ? "…" : "Edit"}
            </span>
          </button>
          <div>
            <p className="text-[15px] font-semibold text-ink">Your portrait</p>
            <p className="muted mt-1 text-[12.5px] leading-relaxed">
              Shown to the Circle in the directory and at the Gate.
            </p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void uploadAvatar(f);
              e.target.value = "";
            }}
          />
        </div>

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
          <textarea className="field min-h-[130px]" value={form.bio} onChange={set("bio")} />
          <p className="faint mt-1.5 text-[11.5px]">
            Markdown welcome — **bold**, *italic*, lists, and line breaks all render.
          </p>
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
        <div className="mt-4">
          <label className="tag">Birthday</label>
          <input
            className="field"
            type="date"
            max={new Date().toISOString().slice(0, 10)}
            value={form.birthday}
            onChange={set("birthday")}
          />
          <p className="faint mt-1.5 text-[11.5px]">Private — the house likes to mark it.</p>
        </div>

        {error && (
          <p className="notice notice-red mt-4 w-full py-2">{error}</p>
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
                <p className="notice notice-red w-full py-2">
                  {inviteState.error}
                </p>
              )}
              <button type="submit" disabled={inviteState.loading} className="btn-glass tap h-12 w-full text-[14px]">
                {inviteState.loading ? "Sending…" : "Send the entrance link"}
              </button>
            </form>
          ) : inviteState.message ? (
            <p className="notice notice-olive mt-4 w-full py-2">
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
