import Image from "next/image";
import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth";
import { fetchLatestApplication } from "@/lib/data";
import SignOutButton from "@/components/SignOutButton";

export const dynamic = "force-dynamic";

const BG =
  "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?q=80&w=2400&auto=format&fit=crop";

const STATUS_COPY: Record<string, { title: string; body: string }> = {
  submitted: {
    title: "Your introduction is with the Circle.",
    body: "The founding circle reads every introduction personally. Expect word about a short host call — usually within a few days.",
  },
  screening: {
    title: "You're in conversation.",
    body: "Your host call is being arranged. Keep an eye on your email — and your phone.",
  },
  waitlist: {
    title: "The season is full.",
    body: "We'd like to welcome you when a window opens. You're on the inside track — we'll reach out the moment space appears.",
  },
  rejected: {
    title: "Not this season.",
    body: "The Circle stays deliberately small, and this season we couldn't extend an invitation. Thank you for the introduction.",
  },
};

export default async function PendingPage() {
  const user = await getAuthUser();
  if (!user) redirect("/login");
  if (user.role !== "lead") redirect("/enter");

  const application = await fetchLatestApplication(user.email);
  if (!application) redirect("/join");

  const copy = STATUS_COPY[application.status] || STATUS_COPY.submitted;

  return (
    <main className="relative min-h-dvh overflow-hidden">
      <Image src={BG} alt="" fill priority sizes="100vw" className="object-cover" />
      <div className="absolute inset-0 scrim-full" />

      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-6 text-center">
        <p className="wordmark reveal text-sm text-ink">Collective</p>

        <div className="glass-strong reveal mt-10 w-full p-8" style={{ animationDelay: "0.1s" }}>
          <span className={`chip ${application.status === "screening" ? "chip-gold" : ""}`}>
            {application.status === "submitted" ? "Received" : application.status}
          </span>
          <h1 className="display mt-5 text-[30px] leading-[1.12] text-ink">{copy.title}</h1>
          <p className="muted mt-4 text-[15px] leading-relaxed">{copy.body}</p>
        </div>

        <div className="reveal mt-8" style={{ animationDelay: "0.2s" }}>
          <SignOutButton />
        </div>
      </div>
    </main>
  );
}
