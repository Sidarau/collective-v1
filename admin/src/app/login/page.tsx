"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

const ERROR_COPY: Record<string, string> = {
  link_invalid: "That entrance link has expired or was already used.",
  missing_params: "That link was incomplete.",
  server_error: "Something went wrong — try again.",
};

function LoginForm() {
  const searchParams = useSearchParams();
  const urlError = searchParams.get("error");
  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [token] = useState(searchParams.get("token") || "");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [autoLoggingIn, setAutoLoggingIn] = useState(false);
  const [error, setError] = useState<string | null>(
    urlError ? ERROR_COPY[urlError] || "Sign-in failed." : null
  );

  const credentialsLogin = useCallback(async (loginEmail: string, creds: { token?: string; password?: string }) => {
    setLoading(true);
    setError(null);
    try {
      const csrfRes = await fetch("/api/auth/csrf");
      const { csrfToken } = (await csrfRes.json()) as { csrfToken?: string };
      const res = await fetch("/api/auth/callback/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          email: loginEmail,
          csrfToken: csrfToken || "",
          callbackUrl: "/",
          json: "true",
          ...creds,
        }).toString(),
      });
      const data = (await res.json()) as { url?: string };
      if (res.ok && data.url && !data.url.includes("error=")) {
        window.location.href = "/";
      } else {
        setError(creds.token ? "We couldn't verify that entrance link." : "That email and password don't match an operator account.");
        setAutoLoggingIn(false);
      }
    } catch {
      setError("Connection issue — try again.");
      setAutoLoggingIn(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!token || !email) return;
    const timer = window.setTimeout(() => {
      setAutoLoggingIn(true);
      void credentialsLogin(email, { token });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [credentialsLogin, email, token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await credentialsLogin(email, { password });
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-base px-4">
      <div className="w-full max-w-sm">
        <p className="text-center text-[11px] font-bold uppercase tracking-[0.24em] text-gold">
          Collective
        </p>
        <h1 className="mt-1 text-center text-xl font-semibold text-ink">Operator console</h1>

        <form onSubmit={submit} className="panel mt-8 p-6">
          {autoLoggingIn && (
            <p className="mb-4 text-center text-sm text-faint">Opening your operator entrance...</p>
          )}
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
