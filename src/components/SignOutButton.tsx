"use client";

export default function SignOutButton({ label = "Sign out" }: { label?: string }) {
  async function signOut() {
    try {
      const csrfRes = await fetch("/api/auth/csrf");
      const { csrfToken } = (await csrfRes.json()) as { csrfToken?: string };
      await fetch("/api/auth/signout", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ csrfToken: csrfToken || "", json: "true" }).toString(),
      });
    } finally {
      window.location.href = "/";
    }
  }

  return (
    <button onClick={signOut} className="btn-glass tap h-11 px-6 text-[13px]">
      {label}
    </button>
  );
}
