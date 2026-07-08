"use client";

import { useState } from "react";

interface Props {
  toUserId: string;
  firstName: string;
  existingStatus: string | null;
}

export default function IntroRequestButton({ toUserId, firstName, existingStatus }: Props) {
  const [status, setStatus] = useState<string | null>(existingStatus);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/intros", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toUserId, note: note.trim() || null }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Could not send the request.");
        return;
      }
      setStatus("requested");
      setOpen(false);
    } catch {
      setError("Connection issue — try again.");
    } finally {
      setLoading(false);
    }
  }

  if (status) {
    return (
      <div className="glass-flat flex items-center justify-between p-4">
        <p className="muted text-[13px]">Introduction requested — the concierge will connect you.</p>
        <span className="chip chip-gold">{status}</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {open && (
        <div className="glass reveal p-4">
          <label className="tag">Why the introduction?</label>
          <textarea
            className="field"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={`What you'd like to explore with ${firstName}`}
          />
          {error && (
            <p className="notice notice-red mt-3 w-full py-2">{error}</p>
          )}
        </div>
      )}
      <button
        onClick={() => (open ? send() : setOpen(true))}
        disabled={loading}
        className="btn-champagne tap h-12 w-full text-[14px]"
      >
        {loading ? "Sending…" : open ? "Send request" : `Request an intro to ${firstName}`}
      </button>
    </div>
  );
}
