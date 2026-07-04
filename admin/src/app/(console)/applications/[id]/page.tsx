import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import StatusChip from "@/components/StatusChip";
import Timeline from "@/components/Timeline";
import CrmPanel from "@/components/CrmPanel";
import ErrorBanner from "@/components/ErrorBanner";
import { getApplicationDetail } from "@/lib/admin-data";
import { mapLatestCalls } from "@/lib/funnel-data";
import { sendSchedulingLinkAction, setCallStatusAction } from "@/lib/funnel-actions";
import { fmtDate } from "@/lib/format";
import {
  approveApplicationAction,
  setApplicationStatusAction,
  resendOnboardingLinkAction,
} from "@/lib/actions";

const callTime = (iso: string, tz: string) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));

export const dynamic = "force-dynamic";

export default async function ApplicationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const detail = await getApplicationDetail(id);
  if (!detail) notFound();
  const { application: app, timeline } = detail;
  const call = (await mapLatestCalls("application_id", [id])).get(id) || null;
  const path = `/applications/${id}`;

  const answers: [string, string | null][] = [
    ["Based in", app.location],
    ["Does", app.occupation],
    ["Motivation", app.motivation],
    ["Would bring", app.contribution],
    ["Referred by", app.referred_by],
    ["Instagram", app.instagram],
    ["LinkedIn", app.linkedin],
    ["Preferred window", app.preferred_window],
  ];

  return (
    <>
      <Link href="/applications" className="mb-2 inline-block text-[12px] text-muted hover:text-ink">
        ← Applications
      </Link>
      <PageHeader title={`${app.first_name} ${app.last_name}`} eyebrow="Application">
        <StatusChip value={app.status} />
      </PageHeader>
      <ErrorBanner error={error} />

      <div className="grid grid-cols-[1fr_320px] gap-5">
        <div className="space-y-5">
          {/* Introduction */}
          <section className="panel p-5">
            <p className="label">Introduction</p>
            <p className="text-sm text-muted">{app.email}</p>
            <dl className="kv mt-4">
              {answers.map(([k, v]) =>
                v ? (
                  <div key={k} className="contents">
                    <dt>{k}</dt>
                    <dd className="whitespace-pre-wrap">{v}</dd>
                  </div>
                ) : null
              )}
              <div className="contents">
                <dt>Submitted</dt>
                <dd>{fmtDate(app.created_at)}</dd>
              </div>
              {app.reviewed_at && (
                <div className="contents">
                  <dt>Reviewed</dt>
                  <dd>{fmtDate(app.reviewed_at)}</dd>
                </div>
              )}
            </dl>
          </section>

          {/* Screening call */}
          <section className="panel p-5">
            <p className="label">Host call</p>
            {call ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-ink">{callTime(call.scheduled_at, call.timezone)}</p>
                  <p className="mt-1 text-[12px] text-faint">
                    {call.duration_minutes} min · Ibiza clock · <StatusChip value={call.status} />
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {call.status === "scheduled" &&
                    (["completed", "no_show"] as const).map((status) => (
                      <form key={status} action={setCallStatusAction}>
                        <input type="hidden" name="id" value={call.id} />
                        <input type="hidden" name="status" value={status} />
                        <input type="hidden" name="path" value={path} />
                        <button type="submit" className={`btn ${status === "completed" ? "btn-gold" : ""}`}>
                          {status === "completed" ? "Mark done" : "No-show"}
                        </button>
                      </form>
                    ))}
                  <Link href="/schedule" className="btn">
                    Schedule
                  </Link>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-[13px] text-muted">
                  No call booked yet. They can book from their scheduling link — or send it again.
                </p>
                <form action={sendSchedulingLinkAction}>
                  <input type="hidden" name="id" value={app.id} />
                  <button type="submit" className="btn">
                    Email scheduling link
                  </button>
                </form>
              </div>
            )}
          </section>

          {/* Decisions */}
          <section className="panel p-5">
            <p className="label">Decide</p>
            <div className="flex flex-wrap items-center gap-2">
              {app.status !== "approved" && (
                <form action={approveApplicationAction}>
                  <input type="hidden" name="id" value={app.id} />
                  <button type="submit" className="btn btn-gold">
                    Approve — member + onboarding link
                  </button>
                </form>
              )}
              {app.status === "approved" && (
                <form action={resendOnboardingLinkAction}>
                  <input type="hidden" name="id" value={app.id} />
                  <button type="submit" className="btn btn-gold">
                    Mint fresh onboarding link
                  </button>
                </form>
              )}
              {(["screening", "waitlist"] as const)
                .filter((s) => s !== app.status)
                .map((s) => (
                  <form key={s} action={setApplicationStatusAction}>
                    <input type="hidden" name="id" value={app.id} />
                    <input type="hidden" name="status" value={s} />
                    <button type="submit" className="btn">
                      Move to {s}
                    </button>
                  </form>
                ))}
              {app.status !== "rejected" && (
                <form action={setApplicationStatusAction} className="flex items-center gap-2">
                  <input type="hidden" name="id" value={app.id} />
                  <input type="hidden" name="status" value="rejected" />
                  <label className="flex items-center gap-1.5 text-[12px] text-muted">
                    <input type="checkbox" name="notify" /> notify
                  </label>
                  <button type="submit" className="btn btn-red">
                    Reject
                  </button>
                </form>
              )}
            </div>
            <p className="mt-3 text-[12px] text-faint">
              Approving makes them a member, seeds their profile from this introduction, and
              mints a one-time onboarding link (delivered per the email mode in Settings; always
              revealed in the timeline below).
            </p>
          </section>

          {/* Activity */}
          <section className="panel overflow-hidden">
            <p className="label border-b border-line px-4 pb-3 pt-4">Timeline</p>
            <Timeline items={timeline} />
          </section>
        </div>

        <aside>
          <CrmPanel entityType="application" entityId={app.id} path={path} />
        </aside>
      </div>
    </>
  );
}
