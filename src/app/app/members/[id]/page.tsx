import Link from "next/link";
import { notFound } from "next/navigation";
import { getAuthUser } from "@/lib/auth";
import { db, fetchProfileByUserId } from "@/lib/data";
import { BLOCKING_STATUSES } from "@core/availability";
import Avatar from "@/components/Avatar";
import Markdown from "@/components/Markdown";
import IntroRequestButton from "./IntroRequestButton";
import { fullName, titleCaseName } from "@core/names";

export const dynamic = "force-dynamic";

const fmtShort = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { month: "short", day: "numeric" }).format(new Date(`${iso}T12:00:00Z`));

export default async function MemberProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const viewer = (await getAuthUser())!;
  const profile = await fetchProfileByUserId(id);
  if (!profile || profile.visibility === "hidden") notFound();

  const isSelf = viewer.id === id;

  // Their footprint in the community: stays + hosted sessions attended.
  const [{ data: stays }, { data: rsvps }, { data: existingIntro }] = await Promise.all([
    db()
      .from("bookings")
      .select("check_in, check_out, villas(name)")
      .eq("user_id", id)
      .in("status", [...BLOCKING_STATUSES, "completed"])
      .order("check_in", { ascending: false })
      .limit(4),
    db()
      .from("event_rsvps")
      .select("status, events(title, start_at)")
      .eq("user_id", id)
      .eq("status", "going")
      .limit(6),
    isSelf
      ? Promise.resolve({ data: null })
      : db()
          .from("intro_requests")
          .select("id, status")
          .eq("from_user", viewer.id)
          .eq("to_user", id)
          .maybeSingle(),
  ]);
  const stayRows =
    (stays as unknown as {
      check_in: string;
      check_out: string;
      villas: { name: string } | null;
    }[]) || [];
  const rsvpRows =
    (rsvps as unknown as {
      status: string;
      events: { title: string; start_at: string } | null;
    }[]) || [];
  const existingIntroRow = existingIntro as { status: string } | null;

  return (
    <div className="px-5 pb-10 pt-14">
      <Link href="/app/members" className="btn-glass tap reveal inline-flex h-10 w-10 items-center justify-center text-[16px]" aria-label="Back">
        ‹
      </Link>

      <header className="reveal mt-6 flex items-center gap-5" style={{ animationDelay: "0.05s" }}>
        <Avatar
          url={profile.avatar_url}
          first={profile.first_name}
          last={profile.last_name}
          size="lg"
        />
        <div>
          <h1 className="display text-[28px] leading-tight text-ink">
            {fullName(profile.first_name, profile.last_name)}
          </h1>
          <p className="muted text-[14px]">{profile.headline || "Member"}</p>
          {profile.location && <p className="faint text-[13px]">{profile.location}</p>}
        </div>
      </header>

      <div className="stagger mt-6 space-y-4">
        {profile.bio && (
          <section className="glass p-5">
            <p className="eyebrow">About</p>
            <div className="mt-2">
              <Markdown>{profile.bio}</Markdown>
            </div>
          </section>
        )}

        {profile.contribution && (
          <section className="glass p-5">
            <p className="eyebrow">Brings to the Circle</p>
            <div className="mt-2">
              <Markdown>{profile.contribution}</Markdown>
            </div>
          </section>
        )}

        {(stayRows.length > 0 || rsvpRows.length > 0) && (
          <section className="glass p-5">
            <p className="eyebrow">In the community</p>
            <div className="mt-3 space-y-2">
              {stayRows.map((s, i) => {
                const villa = s.villas;
                return (
                  <p key={`s${i}`} className="text-[13px] text-ink/80">
                    Stayed at {villa?.name || "the Gate"} · {fmtShort(s.check_in)} – {fmtShort(s.check_out)}
                  </p>
                );
              })}
              {rsvpRows.map((r, i) => {
                const ev = r.events;
                return ev ? (
                  <p key={`e${i}`} className="text-[13px] text-ink/80">
                    {new Date(ev.start_at) < new Date() ? "Attended" : "Attending"} {ev.title}
                  </p>
                ) : null;
              })}
            </div>
          </section>
        )}

        {isSelf ? (
          <Link href="/app/profile" className="btn-glass tap flex h-12 w-full items-center justify-center text-[14px]">
            Edit your profile
          </Link>
        ) : (
          <IntroRequestButton
            toUserId={id}
            firstName={titleCaseName(profile.first_name)}
            existingStatus={existingIntroRow?.status || null}
          />
        )}
      </div>
    </div>
  );
}
