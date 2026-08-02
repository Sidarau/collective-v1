import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { safeNextPath } from "@/lib/safe-next-path";
import { LoginForm } from "./LoginClient";

export const dynamic = "force-dynamic";

/**
 * The single operator login. Mobile (and any future *.opencollective.app
 * surface) bounces unauthenticated visitors here with ?next=<absolute url>.
 * Anyone already holding the shared session cookie skips the form entirely
 * and continues to where they were headed — so the mobile → admin → mobile
 * loop is invisible once you're signed in anywhere.
 */
export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const next = safeNextPath(typeof sp.next === "string" ? sp.next : null);

  const session = await getServerSession(authOptions);
  if (session?.user) redirect(next);

  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
