"use client";

import { useState, Suspense, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ConfirmationResult } from "firebase/auth";

const PHONE_LOGIN = process.env.NEXT_PUBLIC_PHONE_LOGIN === "1";

const BG =
  "/villa/roca-llisa-hero.jpg";

const ERROR_COPY: Record<string, string> = {
  link_invalid: "That entrance link has expired or was already used. Request a fresh one below.",
  missing_params: "That link was incomplete. Request a fresh one below.",
  server_error: "Something went wrong on our side. Try again in a moment.",
};

function LoginForm() {
  const searchParams = useSearchParams();
  const urlError = searchParams.get("error");
  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [token] = useState(searchParams.get("token") || "");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"magic" | "password" | "phone">("magic");
  const [loading, setLoading] = useState(false);
  const [phone, setPhone] = useState("");
  const [smsCode, setSmsCode] = useState("");
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [autoLoggingIn, setAutoLoggingIn] = useState(false);
  const [result, setResult] = useState<{ success?: boolean; message?: string; error?: string } | null>(
    urlError ? { error: ERROR_COPY[urlError] || ERROR_COPY.server_error } : null
  );

  const credentialsLogin = useCallback(
    async (loginEmail: string, creds: { token?: string; password?: string }) => {
      setLoading(true);
      setResult(null);
      try {
        const csrfRes = await fetch("/api/auth/csrf");
        const csrfData = (await csrfRes.json()) as { csrfToken?: string };

        const body: Record<string, string> = {
          email: loginEmail,
          csrfToken: csrfData.csrfToken || "",
          callbackUrl: "/enter",
          json: "true",
          ...creds,
        };

        const res = await fetch("/api/auth/callback/credentials", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams(body).toString(),
        });

        const data = (await res.json()) as { url?: string; error?: string };
        if (res.ok && data.url && !data.url.includes("error=")) {
          window.location.href = data.url;
        } else {
          setResult({
            error:
              mode === "password"
                ? "That email and password don't match."
                : "We couldn't verify that link. Request a fresh one below.",
          });
          setAutoLoggingIn(false);
        }
      } catch {
        setResult({ error: "Connection issue — try again." });
        setAutoLoggingIn(false);
      } finally {
        setLoading(false);
      }
    },
    [mode]
  );

  // Old-format links (/login?email&token) still auto-enter.
  useEffect(() => {
    if (!token || !email) return;
    const timer = window.setTimeout(() => {
      setAutoLoggingIn(true);
      void credentialsLogin(email, { token });
    }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const { sendPhoneCode } = await import("@/lib/firebase-client");
      const conf = await sendPhoneCode(phone.replace(/[\s\-()]/g, ""), "recaptcha-anchor");
      setConfirmation(conf);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      setResult({
        error: /invalid-phone/.test(msg)
          ? "Use the international format, e.g. +34 600 123 456."
          : "Couldn't send the code — try again in a moment.",
      });
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    if (!confirmation) return;
    setLoading(true);
    setResult(null);
    try {
      const { confirmPhoneCode } = await import("@/lib/firebase-client");
      const idToken = await confirmPhoneCode(confirmation, smsCode.trim());
      const res = await fetch("/api/auth/phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      const data = (await res.json()) as { destination?: string; error?: string };
      if (res.ok && data.destination) {
        window.location.href = data.destination;
        return;
      }
      setResult({ error: data.error || "We couldn't match that number." });
      setConfirmation(null);
      setSmsCode("");
    } catch {
      setResult({ error: "That code didn't verify — request a fresh one." });
      setConfirmation(null);
      setSmsCode("");
    } finally {
      setLoading(false);
    }
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

  async function requestPasswordReset() {
    if (!email.trim()) {
      setResult({ error: "Enter your email first." });
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json()) as { message?: string; error?: string };
      if (res.ok) {
        setPassword("");
        setResult({ success: true, message: data.message });
      } else {
        setResult({ error: data.error || "Could not send the setup link." });
      }
    } catch {
      setResult({ error: "Connection issue — try again." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-dvh overflow-hidden">
      <Image src={BG} alt="" fill priority sizes="100vw" className="object-cover" />
      <div className="absolute inset-0 scrim-full" />

      <div className="relative z-10 flex min-h-dvh flex-col items-center justify-center px-5 py-12">
        <Link href="/" className="wordmark reveal mb-10 text-lg text-ink">
          Collective
        </Link>

        <div className="glass-strong reveal w-full max-w-sm p-7" style={{ animationDelay: "0.1s" }}>
          {autoLoggingIn ? (
            <p className="muted py-6 text-center text-[15px]">Opening your entrance…</p>
          ) : (
            <>
              <div className="glass-flat mb-6 flex p-1">
                {([...(PHONE_LOGIN ? (["magic", "password", "phone"] as const) : (["magic", "password"] as const))]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setMode(m);
                      setResult(null);
                      setConfirmation(null);
                      setSmsCode("");
                    }}
                    className={`pill tap flex-1 py-2.5 text-[13px] font-semibold transition ${
                      mode === m ? "bg-champagne text-base" : "muted"
                    }`}
                  >
                    {m === "magic" ? "Email link" : m === "password" ? "Password" : "Phone"}
                  </button>
                ))}
              </div>

              {result?.error && (
                <p className="notice notice-red mb-4 w-full py-2">
                  {result.error}
                </p>
              )}
              {result?.success && (
                <p className="notice notice-olive mb-4 w-full py-2">
                  {result.message}
                </p>
              )}

              {mode === "phone" ? (
                confirmation ? (
                  <form onSubmit={verifyCode} className="space-y-4">
                    <div>
                      <label className="tag">Code from SMS</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        required
                        maxLength={6}
                        value={smsCode}
                        onChange={(e) => setSmsCode(e.target.value)}
                        className="field text-center tracking-[0.4em]"
                        placeholder="••••••"
                      />
                    </div>
                    <button type="submit" disabled={loading || smsCode.length < 6} className="btn-champagne tap h-[52px] w-full text-[15px]">
                      {loading ? "Verifying…" : "Enter"}
                    </button>
                    <p className="faint text-center text-[12px]">
                      Sent to {phone}.{" "}
                      <button type="button" onClick={() => setConfirmation(null)} className="underline underline-offset-4">
                        Change number
                      </button>
                    </p>
                  </form>
                ) : (
                  <form onSubmit={sendCode} className="space-y-4">
                    <div>
                      <label className="tag">Phone</label>
                      <input
                        type="tel"
                        required
                        autoComplete="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="field"
                        placeholder="+34 600 123 456"
                      />
                    </div>
                    <button type="submit" disabled={loading} className="btn-champagne tap h-[52px] w-full text-[15px]">
                      {loading ? "Sending…" : "Text me a code"}
                    </button>
                    <p className="faint text-center text-[12px] leading-relaxed">
                      Works once your number is linked — or arrives with a WhatsApp invitation.
                    </p>
                  </form>
                )
              ) : mode === "magic" ? (
                <form onSubmit={requestLink} className="space-y-4">
                  <div>
                    <label className="tag">Email</label>
                    <input
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="field"
                      placeholder="you@example.com"
                    />
                  </div>
                  <button type="submit" disabled={loading} className="btn-champagne tap h-[52px] w-full text-[15px]">
                    {loading ? "Sending…" : "Send my entrance link"}
                  </button>
                  <p className="faint text-center text-[12px] leading-relaxed">
                    Your link arrives by email and works once.
                  </p>
                </form>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    credentialsLogin(email, { password });
                  }}
                  className="space-y-4"
                >
                  <div>
                    <label className="tag">Email</label>
                    <input
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="field"
                      placeholder="you@example.com"
                    />
                  </div>
                  <div>
                    <label className="tag">Password</label>
                    <input
                      type="password"
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="field"
                      placeholder="••••••••"
                    />
                  </div>
                  <button type="submit" disabled={loading} className="btn-champagne tap h-[52px] w-full text-[15px]">
                    {loading ? "Entering…" : "Enter"}
                  </button>
                  <button
                    type="button"
                    onClick={requestPasswordReset}
                    disabled={loading}
                    className="tap mx-auto block text-[12.5px] text-ink/55 underline-offset-4 hover:text-champagne hover:underline"
                  >
                    Forgot password? Send a setup link
                  </button>
                </form>
              )}
            </>
          )}
        </div>

        <p className="faint reveal mt-8 max-w-xs text-center text-[13px] leading-relaxed" style={{ animationDelay: "0.2s" }}>
          No account? Membership is by referral — ask the member who told you about us.
        </p>
        {/* Invisible reCAPTCHA anchor for phone sign-in (must stay mounted). */}
        <div id="recaptcha-anchor" />
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={<div className="flex min-h-dvh items-center justify-center bg-base muted">…</div>}
    >
      <LoginForm />
    </Suspense>
  );
}
