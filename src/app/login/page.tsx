"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { config } from "@/lib/config";

function LoginForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [token, setToken] = useState(searchParams.get("token") || "");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success?: boolean; error?: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      // Fetch CSRF token first
      const csrfRes = await fetch("/api/auth/csrf");
      const csrfData = (await csrfRes.json()) as { csrfToken?: string };

      const res = await fetch("/api/auth/callback/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          token,
          csrfToken: csrfData.csrfToken,
          callbackUrl: "/portal/villa",
          json: true,
        }),
      });

      const data = (await res.json()) as { url?: string; error?: string };
      if (res.ok && data.url) {
        setResult({ success: true });
        window.location.href = data.url;
      } else {
        setResult({ error: data.error || "Login failed" });
      }
    } catch (err: unknown) {
      setResult({ error: err instanceof Error ? err.message : "Login failed" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-light text-stone-900 text-center mb-8">
          {config.brandName}
        </h1>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border p-6 space-y-5">
          {result?.error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
              {result.error}
            </div>
          )}

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

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Access Token</label>
            <input
              type="text"
              required
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Check your email"
              className="w-full rounded-lg border-stone-300 px-3 py-2 border"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-stone-900 text-white py-3 rounded-lg font-medium hover:bg-stone-800 transition disabled:opacity-50"
          >
            {loading ? "Logging in..." : "Log In"}
          </button>
        </form>

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
    <Suspense fallback={<div className="min-h-screen bg-stone-50 flex items-center justify-center">Loading...</div>}>
      <LoginForm />
    </Suspense>
  );
}
