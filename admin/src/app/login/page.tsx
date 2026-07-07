"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

const ERROR_COPY: Record<string, string> = {
  link_invalid: "That entrance link has expired or was already used.",
  missing_params: "That link was incomplete.",
  server_error: "Something went wrong — try again.",
};

function LoginForm() {
  const searchParams = useSearchParams();
  const urlError = searchParams.get("error");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    urlError ? ERROR_COPY[urlError] || "Sign-in failed." : null
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const csrfRes = await fetch("/api/auth/csrf");
      const { csrfToken } = (await csrfRes.json()) as { csrfToken?: string };
      const res = await fetch("/api/auth/callback/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          email,
          password,
          csrfToken: csrfToken || "",
          callbackUrl: "/",
          json: "true",
        }).toString(),
      });
      const data = (await res.json()) as { url?: string };
      if (res.ok && data.url && !data.url.includes("error=")) {
        window.location.href = "/";
      } else {
        setError("That email and password don't match an operator account.");
      }
    } catch {
      setError("Connection issue — try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-base px-4">
      <div className="w-full max-w-sm">
        <p className="text-center text-[11px] font-bold uppercase tracking-[0.24em] text-gold">
          Collective
        </p>
        <h1 className="mt-1 text-center text-xl font-semibold text-ink">Operator console</h1>

        <form onSubmit={submit} className="panel mt-8 p-6">
          {error && (
            <p className="chip chip-red mb-4 w-full whitespace-normal py-2 normal-case">{error}</p>
          )}
          <label className="label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <label className="label mt-4" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button type="submit" disabled={loading} className="btn btn-gold mt-5 w-full py-2.5">
            {loading ? "Signing in…" : "Sign in"}
          </button>
          <p className="mt-4 text-center text-[11.5px] leading-relaxed text-faint">
            Operators and admins only. No password yet? Open the entrance link from your
            invitation email — it signs you in and lets you set one.
          </p>
        </form>
      </div>
    </main>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
