"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SetupPasswordForm({ email }: { email: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("The passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Could not save password.");
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setError("Connection issue — try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="panel mt-8 p-6">
      <p className="mb-5 text-sm leading-relaxed text-muted">
        Create a password for <span className="text-ink">{email}</span> so you can return to
        the operator console without a one-time email link.
      </p>

      {error && (
        <p className="notice notice-red mb-4 w-full py-2">{error}</p>
      )}

      <label className="label" htmlFor="password">
        New password
      </label>
      <input
        id="password"
        type="password"
        required
        minLength={8}
        autoComplete="new-password"
        className="input"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      <label className="label mt-4" htmlFor="confirm">
        Confirm password
      </label>
      <input
        id="confirm"
        type="password"
        required
        minLength={8}
        autoComplete="new-password"
        className="input"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
      />

      <button type="submit" disabled={loading} className="btn btn-gold mt-5 w-full py-2.5">
        {loading ? "Saving..." : "Create password"}
      </button>
    </form>
  );
}
