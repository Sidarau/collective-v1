"use client";

import { signOut } from "next-auth/react";

export default function SignOutButton({ compact = false }: { compact?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => void signOut({ callbackUrl: "/login" })}
      className={compact ? "btn w-full justify-start" : "btn w-full"}
    >
      Sign out
    </button>
  );
}
