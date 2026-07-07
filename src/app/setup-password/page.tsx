import Image from "next/image";
import { redirect } from "next/navigation";
import { getAuthUserWithPassword } from "@/lib/auth";
import SetupPasswordForm from "./SetupPasswordForm";

export const dynamic = "force-dynamic";

const BG =
  "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?q=80&w=2400&auto=format&fit=crop";

export default async function SetupPasswordPage() {
  const user = await getAuthUserWithPassword();
  if (!user) redirect("/login");
  if (user.hasPassword) redirect("/enter");

  return (
    <main className="relative min-h-dvh overflow-hidden">
      <Image src={BG} alt="" fill priority sizes="100vw" className="object-cover" />
      <div className="absolute inset-0 scrim-full" />

      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-16 pt-12">
        <p className="wordmark reveal text-center text-sm text-ink">Collective</p>

        <div className="reveal mt-10" style={{ animationDelay: "0.08s" }}>
          <p className="eyebrow">Return access</p>
          <h1 className="display mt-3 text-[34px] leading-[1.08] text-ink">
            Create your password.
          </h1>
          <p className="muted mt-4 text-[15px] leading-relaxed">
            Your email link worked. Add a password now so future visits can use either
            password login or a fresh entrance link.
          </p>
        </div>

        <div className="reveal" style={{ animationDelay: "0.16s" }}>
          <SetupPasswordForm email={user.email} />
        </div>
      </div>
    </main>
  );
}
