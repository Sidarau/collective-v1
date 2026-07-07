import Image from "next/image";
import { computeOpenSlots, loadSlotInputs, fmtMinute } from "@core/scheduling";
import { fetchContentBlock } from "@/lib/data";
import { fmtCallTime, resolveScreeningToken } from "@/lib/screening";
import SlotPicker, { type SlotDay } from "./SlotPicker";

export const dynamic = "force-dynamic";

const BG =
  "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=2400&auto=format&fit=crop";

const dayLabel = (dateKey: string) =>
  new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${dateKey}T00:00:00Z`));

/**
 * Public 15-minute call scheduler. The token (from the application flow or an
 * operator invite email) is the only credential. Times are shown in the
 * villa's clock — the host is in Ibiza.
 */
export default async function ScreeningPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const context = await resolveScreeningToken(token);

  if (!context) {
    return (
      <Shell>
        <div className="glass-strong reveal mt-16 p-8 text-center" style={{ animationDelay: "0.1s" }}>
          <span className="chip">Unknown link</span>
          <h1 className="display mt-5 text-[28px] leading-[1.12] text-ink">
            This scheduling link doesn&apos;t work.
          </h1>
          <p className="muted mt-4 text-[15px] leading-relaxed">
            It may have been replaced. Check your latest email from us, or reply
            to it and we&apos;ll sort you out.
          </p>
        </div>
      </Shell>
    );
  }

  const [slots, intro] = await Promise.all([
    loadSlotInputs(context.kind).then(computeOpenSlots),
    fetchContentBlock("screening.intro"),
  ]);

  const days: SlotDay[] = [];
  for (const slot of slots) {
    let day = days[days.length - 1];
    if (!day || day.dateKey !== slot.dateKey) {
      day = { dateKey: slot.dateKey, label: dayLabel(slot.dateKey), slots: [] };
      days.push(day);
    }
    day.slots.push({ startsAt: slot.startsAt, timeLabel: fmtMinute(slot.minute) });
  }

  return (
    <Shell>
      <div className="reveal mt-10" style={{ animationDelay: "0.08s" }}>
        <p className="eyebrow">{context.kind === "member" ? "Your host call" : "Your interview"}</p>
        <h1 className="display mt-3 text-[34px] leading-[1.08] text-ink">
          {context.firstName}, choose your fifteen minutes.
        </h1>
        <p className="muted mt-4 text-[15px] leading-relaxed">
          {intro || "A short call — fifteen minutes with the host. Choose a window that suits you."}
        </p>
      </div>

      <div className="reveal mt-8" style={{ animationDelay: "0.16s" }}>
        <SlotPicker
          token={token}
          days={days}
          existing={
            context.existingCall
              ? {
                  timeLabel: fmtCallTime(
                    context.existingCall.scheduled_at,
                    context.existingCall.timezone
                  ),
                }
              : null
          }
        />
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative min-h-dvh">
      <div className="fixed inset-0 -z-10">
        <Image src={BG} alt="" fill priority sizes="100vw" className="object-cover" />
        <div className="absolute inset-0 scrim-full" />
      </div>
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-16 pt-12">
        <p className="wordmark reveal text-center text-sm text-ink">Collective</p>
        {children}
      </div>
    </main>
  );
}
