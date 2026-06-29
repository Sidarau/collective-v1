"use client";

import { useState } from "react";
import Link from "next/link";
import { config } from "../../../lib/config";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/callback/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token, csrfToken: "token" }),
      });
      if (res.ok) {
        setResult({ success: true });
        window.location.href = "/portal/villa";
      } else {
        const data = await res.json();
        setResult({ error: data.error || "Login failed" });
      }
    } catch (err: any) {
      setResult({ error: err.message });
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
          <Link href="/public/onboarding" className="text-stone-900 font-medium">
            Request an invitation
          </Link>
        </p>
      </div>
    </div>
  );
}
