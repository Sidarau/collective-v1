import Image from "next/image";
import { redirect } from "next/navigation";
import { getAuthUserWithPassword } from "@/lib/auth";
import { fetchLatestApplication, db } from "@/lib/data";
import JoinForm from "./JoinForm";

export const dynamic = "force-dynamic";

const BG =
  "/villa/roca-llisa-hero.jpg";

/**
 * First arrival after a referral entrance link. The form is about the person,
 * not a booking — who they are, what they build, why the Circle.
 */
export default async function JoinPage() {
  const user = await getAuthUserWithPassword();
  if (!user) redirect("/login");
  if (!user.hasPassword) redirect("/setup-password");
  if (user.role !== "lead") redirect("/enter");

  const existing = await fetchLatestApplication(user.email);
  if (existing) redirect("/pending");

  // Prefill from the lead row the referral created.
  const { data: lead } = user.leadId
    ? await db().from("leads").select("first_name, last_name, phone, whatsapp").eq("id", user.leadId).maybeSingle()
    : { data: null };

  return (
    <main className="relative min-h-dvh">
      <div className="fixed inset-0 -z-10">
        <Image src={BG} alt="" fill priority sizes="100vw" className="object-cover" />
        <div className="absolute inset-0 scrim-full" />
      </div>

      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-16 pt-12">
        <p className="wordmark reveal text-center text-sm text-ink">Collective</p>

        <div className="reveal mt-10" style={{ animationDelay: "0.08s" }}>
          <p className="eyebrow">Your introduction</p>
          <h1 className="display mt-3 text-[34px] leading-[1.08] text-ink">
            The Circle would like to know you.
          </h1>
          <p className="muted mt-4 text-[15px] leading-relaxed">
            A member has opened the door. Tell us who you are — this goes to the
            founding circle ahead of a short host call.
          </p>
        </div>

        <div className="reveal mt-8" style={{ animationDelay: "0.16s" }}>
          <JoinForm
            email={user.email}
            firstName={lead?.first_name || ""}
            lastName={lead?.last_name || ""}
            phone={lead?.phone || ""}
            whatsapp={lead?.whatsapp || ""}
          />
        </div>
      </div>
    </main>
  );
}
