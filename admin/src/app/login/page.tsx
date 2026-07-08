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
  const [mode, setMode] = useState<"magic" | "password">("magic");
  const [loading, setLoading] = useState(false);
  const [autoLoggingIn, setAutoLoggingIn] = useState(false);
  const [result, setResult] = useState<{ success?: boolean; message?: string; error?: string } | null>(
    urlError ? { error: ERROR_COPY[urlError] || "Sign-in failed." } : null
  );

  const credentialsLogin = useCallback(async (loginEmail: string, creds: { token?: string; password?: string }) => {
    setLoading(true);
    setResult(null);
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
        setResult({
          error: creds.token
            ? "We couldn't verify that entrance link."
            : "That email and password don't match an operator account.",
        });
        setAutoLoggingIn(false);
      }
    } catch {
      setResult({ error: "Connection issue — try again." });
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

  async function requestLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json()) as { message?: string; error?: string };
      if (res.ok) {
        setResult({ success: true, message: data.message });
      } else {
        setResult({ error: data.error || "Could not send the link." });
      }
    } catch {
      setResult({ error: "Connection issue — try again." });
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

        <div className="panel mt-8 p-6">
          {autoLoggingIn && (
            <p className="mb-4 text-center text-sm text-faint">Opening your operator entrance...</p>
          )}
          <div className="mb-6 grid grid-cols-2 gap-1 rounded-md border border-line bg-base p-1">
            {(["magic", "password"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m);
                  setResult(null);
                }}
                className={`rounded-[5px] px-3 py-2 text-[12px] font-semibold transition ${
                  mode === m ? "bg-gold text-base" : "text-muted hover:text-ink"
                }`}
              >
                {m === "magic" ? "Email link" : "Password"}
              </button>
            ))}
          </div>
          {result?.error && (
            <p className="notice notice-red mb-4 w-full py-2">{result.error}</p>
          )}
          {result?.success && (
            <p className="notice notice-green mb-4 w-full py-2">
              {result.message}
            </p>
          )}

          {mode === "magic" ? (
            <form onSubmit={requestLink}>
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
              <button type="submit" disabled={loading} className="btn btn-gold mt-5 w-full py-2.5">
                {loading ? "Sending..." : "Send operator entrance link"}
              </button>
              <p className="mt-4 text-center text-[11.5px] leading-relaxed text-faint">
                Your one-time link arrives by email and opens password setup if needed.
              </p>
            </form>
          ) : (
            <form onSubmit={submit}>
              <label className="label" htmlFor="password-email">
                Email
              </label>
              <input
                id="password-email"
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
                {loading ? "Signing in..." : "Sign in"}
              </button>
            </form>
          )}
        </div>
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
