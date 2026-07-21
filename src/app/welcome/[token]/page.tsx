import Image from "next/image";
import Link from "next/link";
import { getSupabaseAdmin } from "@core/supabase";
import WelcomeForm from "./WelcomeForm";

export const dynamic = "force-dynamic";

const BG =
  "/villa/roca-llisa-hero.jpg";

/** Landing for phone/WhatsApp invites: you were vouched for — claim your entrance. */
export default async function WelcomePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const { data: invite } = await getSupabaseAdmin()
    .from("invite_tokens")
    .select("token, kind, first_name, last_name, used_at, expires_at")
    .eq("token", token)
    .maybeSingle();

  const dead = !invite || !!invite.used_at || invite.expires_at < new Date().toISOString();

  return (
    <main className="relative min-h-dvh overflow-hidden">
      <Image src={BG} alt="" fill priority sizes="100vw" className="object-cover" />
      <div className="absolute inset-0 scrim-full" />

      <div className="relative z-10 flex min-h-dvh flex-col items-center justify-center px-5 py-12">
        <p className="wordmark reveal mb-10 text-lg text-ink">Collective</p>

        {dead ? (
          <div className="glass-strong reveal w-full max-w-sm p-7 text-center">
            <h1 className="display text-[26px] leading-tight text-ink">
              This invitation has lapsed.
            </h1>
            <p className="muted mt-3 text-[14px] leading-relaxed">
              Entrance links work once and rest after seven days. Ask your host for a fresh
              one — or enter with your email if you already belong.
            </p>
            <Link href="/login" className="btn-glass tap mt-6 inline-flex h-12 items-center px-8 text-[14px]">
              Go to the entrance
            </Link>
          </div>
        ) : (
          <WelcomeForm
            token={invite.token}
            kind={invite.kind}
            firstName={invite.first_name || ""}
            lastName={invite.last_name || ""}
          />
        )}
      </div>
    </main>
  );
}
