import Image from "next/image";
import { redirect } from "next/navigation";
import { getAuthUserWithPassword } from "@/lib/auth";
import { db, fetchLatestApplication, fetchProfileByUserId } from "@/lib/data";
import OnboardingForm from "./OnboardingForm";

export const dynamic = "force-dynamic";

const BG =
  "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?q=80&w=2400&auto=format&fit=crop";

/**
 * Post-approval onboarding: welcome the new member, gather the practical
 * details (allergies etc.), and pre-fill their profile from the application.
 */
export default async function OnboardingPage() {
  const user = await getAuthUserWithPassword();
  if (!user) redirect("/login");
  if (!user.hasPassword) redirect("/setup-password");
  if (user.role === "lead") redirect("/enter");

  const profile = await fetchProfileByUserId(user.id);
  if (profile?.onboarding_completed) redirect("/app");

  const application = await fetchLatestApplication(user.email);
  const { data: lead } = user.leadId
    ? await db().from("leads").select("first_name, last_name, phone, whatsapp, dietary_restrictions").eq("id", user.leadId).maybeSingle()
    : { data: null };

  const initial = {
    firstName: profile?.first_name || application?.first_name || lead?.first_name || "",
    lastName: profile?.last_name || application?.last_name || lead?.last_name || "",
    headline: profile?.headline || application?.occupation || "",
    location: profile?.location || application?.location || "",
    bio: profile?.bio || "",
    contribution: profile?.contribution || application?.contribution || "",
    phone: profile?.phone || lead?.phone || "",
    whatsapp: profile?.whatsapp || lead?.whatsapp || "",
    allergies: profile?.allergies || "",
    dietary: profile?.dietary || lead?.dietary_restrictions || "",
    birthday: profile?.birthday || application?.birthday || "",
  };

  return (
    <main className="relative min-h-dvh">
      <div className="fixed inset-0 -z-10">
        <Image src={BG} alt="" fill priority sizes="100vw" className="object-cover" />
        <div className="absolute inset-0 scrim-full" />
      </div>

      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-16 pt-12">
        <p className="wordmark reveal text-center text-sm text-ink">Collective</p>

        <div className="reveal mt-10" style={{ animationDelay: "0.08s" }}>
          <p className="eyebrow">Welcome to the Circle</p>
          <h1 className="display mt-3 text-[34px] leading-[1.08] text-ink">
            You&apos;re in{initial.firstName ? `, ${initial.firstName}` : ""}.
          </h1>
          <p className="muted mt-4 text-[15px] leading-relaxed">
            A few practical things before your first stay. This becomes your member
            profile — you can refine it anytime.
          </p>
        </div>

        <div className="reveal mt-8" style={{ animationDelay: "0.16s" }}>
          <OnboardingForm initial={initial} />
        </div>
      </div>
    </main>
  );
}
