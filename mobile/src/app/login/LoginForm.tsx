"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

/**
 * Password sign-in against the shared credentials provider. Magic links are
 * minted in the admin console and land on /api/auth/magic, so this form is
 * the steady-state path for operators with a password set.
 */
export function LoginForm({ next, initialError }: { next: string; initialError: string | null }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(initialError);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setBusy(false);
    if (result?.ok) {
      window.location.assign(next);
      return;
    }
    setError("That email and password did not match an operator account.");
  };

  return (
    <form className="login-form" onSubmit={submit}>
      {error ? (
        <p className="login-form__error" role="alert" data-testid="login-error">
          {error}
        </p>
      ) : null}
      <label className="sr-only" htmlFor="login-email">
        Email
      </label>
      <input
        id="login-email"
        className="control"
        type="email"
        autoComplete="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <label className="sr-only" htmlFor="login-password">
        Password
      </label>
      <input
        id="login-password"
        className="control"
        type="password"
        autoComplete="current-password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <button type="submit" className="btn btn--primary btn--block" disabled={busy}>
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
