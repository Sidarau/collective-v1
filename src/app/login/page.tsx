"use client";

import { useState, Suspense, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { config } from "@/lib/config";

function LoginForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [token, setToken] = useState(searchParams.get("token") || "");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"magic" | "password">("magic");
  const [loading, setLoading] = useState(false);
  const [autoLoggingIn, setAutoLoggingIn] = useState(false);
  const [result, setResult] = useState<{ success?: boolean; message?: string; error?: string } | null>(null);

  const hasToken = Boolean(token);

  // Auto-login if token is present in URL
  useEffect(() => {
    if (hasToken && email) {
      setAutoLoggingIn(true);
      handleLoginInternal(email, { token });
    }
  }, [hasToken, email]);

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json()) as { success?: boolean; message?: string; error?: string };
      if (res.ok) {
        setResult({ success: true, message: data.message || "Check your email for the magic link." });
      } else {
        setResult({ error: data.error || "Failed to send magic link" });
      }
    } catch (err: unknown) {
      setResult({ error: err instanceof Error ? err.message : "Failed to send magic link" });
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(e?: React.FormEvent, override?: { token?: string; password?: string }) {
    if (e) e.preventDefault();
    await handleLoginInternal(email, override);
  }

  async function handleLoginInternal(loginEmail: string, override?: { token?: string; password?: string }) {
    setLoading(true);
    setResult(null);
    try {
      const csrfRes = await fetch("/api/auth/csrf");
      const csrfData = (await csrfRes.json()) as { csrfToken?: string };

      const body: Record<string, string> = {
        email: loginEmail,
        csrfToken: csrfData.csrfToken || "",
        callbackUrl: "/portal/villa",
        json: "true",
      };

      if (mode === "magic" || override?.token) {
        body.token = override?.token || token;
      }
      if (mode === "password" || override?.password) {
        body.password = override?.password || password;
      }

      const res = await fetch("/api/auth/callback/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(body).toString(),
      });

      const data = (await res.json()) as { url?: string; error?: string };
      if (res.ok && data.url) {
        window.location.href = data.url;
      } else {
        setResult({ error: data.error || "Login failed" });
        setAutoLoggingIn(false);
      }
    } catch (err: unknown) {
      setResult({ error: err instanceof Error ? err.message : "Login failed" });
      setAutoLoggingIn(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-light text-stone-900 text-center mb-8">{config.brandName}</h1>

        <div className="bg-white rounded-xl shadow-sm border p-6 space-y-5">
          {result?.error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">{result.error}</div>
          )}
          {result?.success && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-green-700 text-sm">{result.message}</div>
          )}

          {autoLoggingIn && (
            <div className="bg-stone-50 border border-stone-200 rounded-lg p-3 text-stone-700 text-sm text-center">
              Logging you in…
            </div>
          )}

          <div className="flex rounded-lg border border-stone-200 p-1">
            <button
              type="button"
              onClick={() => setMode("magic")}
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition ${
                mode === "magic" ? "bg-stone-900 text-white" : "text-stone-600 hover:bg-stone-50"
              }`}
            >
              Magic Link
            </button>
            <button
              type="button"
              onClick={() => setMode("password")}
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition ${
                mode === "password" ? "bg-stone-900 text-white" : "text-stone-600 hover:bg-stone-50"
              }`}
            >
              Password
            </button>
          </div>

          {mode === "magic" && !hasToken && (
            <form onSubmit={handleMagicLink} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border-stone-300 px-3 py-2 border"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-stone-900 text-white py-3 rounded-lg font-medium hover:bg-stone-800 transition disabled:opacity-50"
              >
                {loading ? "Sending…" : "Send Magic Link"}
              </button>
            </form>
          )}

          {(mode === "password" || hasToken) && !autoLoggingIn && (
            <form onSubmit={(e) => handleLogin(e)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border-stone-300 px-3 py-2 border"
                />
              </div>

              {mode === "magic" && (
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Access Token</label>
                  <input
                    type="text"
                    required
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="From your email"
                    className="w-full rounded-lg border-stone-300 px-3 py-2 border font-mono text-sm"
                  />
                </div>
              )}

              {mode === "password" && (
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Password</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-lg border-stone-300 px-3 py-2 border"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-stone-900 text-white py-3 rounded-lg font-medium hover:bg-stone-800 transition disabled:opacity-50"
              >
                {loading ? "Logging in…" : "Log In"}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-sm text-stone-500 mt-6">
          Don&apos;t have an account?{" "}
          <Link href="/onboarding" className="text-stone-900 font-medium">
            Request an invitation
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-stone-50 flex items-center justify-center">Loading…</div>}>
      <LoginForm />
    </Suspense>
  );
}
