import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getOperatorPrincipal } from "@/lib/guard";
import { isGuarded, first, type SearchParams } from "@/lib/page-params";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Sign in — Open Collective" };

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const next = first(sp.next);
  const error = first(sp.error);

  // Preview deploys have no accounts: the guard is off and /login sends you
  // straight to the fixture gallery.
  if (!isGuarded()) redirect(next && next.startsWith("/") ? next : "/");

  // Already signed in → never show the form.
  if (await getOperatorPrincipal()) redirect(next && next.startsWith("/") ? next : "/");

  return (
    <main className="login-shell">
      <div className="login-card">
        {/* eslint-disable-next-line @next/next/no-img-element -- the mark is preloaded at this exact URL */}
        <img className="login-card__mark" src="/brand/keyhole.png" alt="" width={44} height={44} />
        <h1 className="login-card__title">Open Collective</h1>
        <p className="login-card__subtitle">Operator access, by invitation.</p>
        <LoginForm
          next={next && next.startsWith("/") ? next : "/"}
          initialError={
            error === "link_invalid"
              ? "That sign-in link has expired or was already used."
              : error
                ? "Sign-in failed. Try again."
                : null
          }
        />
      </div>
    </main>
  );
}
