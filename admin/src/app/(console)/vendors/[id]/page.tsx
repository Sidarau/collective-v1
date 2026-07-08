import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import StatusChip from "@/components/StatusChip";
import Timeline from "@/components/Timeline";
import CrmPanel from "@/components/CrmPanel";
import ErrorBanner from "@/components/ErrorBanner";
import { getTimeline } from "@/lib/admin-data";
import { getVendorApplication, mapLatestCalls } from "@/lib/funnel-data";
import { inviteVendorToInterviewAction, vendorTransitionAction } from "@/lib/funnel-actions";
import { fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const callTime = (iso: string, tz: string) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));

export default async function VendorDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const vendor = await getVendorApplication(id);
  if (!vendor) notFound();

  const [timeline, calls] = await Promise.all([
    getTimeline("staff_application", id),
    mapLatestCalls("staff_application_id", [id]),
  ]);
  const call = calls.get(id) || null;
  const path = `/vendors/${id}`;
  const links = (vendor.links || {}) as { raw?: string };

  const facts: [string, string | null][] = [
    ["Role", vendor.role_applied],
    ["Company", vendor.company],
    ["Email", vendor.email],
    ["Phone", vendor.phone],
    ["Experience", vendor.experience],
    ["Links", links.raw || null],
    ["Message", vendor.message],
  ];

  return (
    <>
      <Link href="/vendors" className="mb-2 inline-block text-[12px] text-muted hover:text-ink">
        ← Vendors & staff
      </Link>
      <PageHeader title={vendor.name} eyebrow="Vendor application">
        <StatusChip value={vendor.status} />
      </PageHeader>
      <ErrorBanner error={error} />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <section className="panel p-5">
            <p className="label">Application</p>
            <dl className="kv mt-2">
              {facts.map(([k, v]) =>
                v ? (
                  <div key={k} className="contents">
                    <dt>{k}</dt>
                    <dd className="whitespace-pre-wrap">{v}</dd>
                  </div>
                ) : null
              )}
              <div className="contents">
                <dt>Applied</dt>
                <dd>{fmtDate(vendor.created_at)}</dd>
              </div>
            </dl>
          </section>

          {call && (
            <section className="panel p-5">
              <p className="label">Interview</p>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-ink">{callTime(call.scheduled_at, call.timezone)}</p>
                  <p className="text-[12px] text-faint">
                    {call.duration_minutes} min · Ibiza clock · <StatusChip value={call.status} />
                  </p>
                </div>
                <Link href="/schedule" className="btn">
                  Open schedule
                </Link>
              </div>
            </section>
          )}

          <section className="panel p-5">
            <p className="label">Decide</p>
            <div className="flex flex-wrap items-center gap-2">
              {["submitted", "review"].includes(vendor.status) && (
                <form action={inviteVendorToInterviewAction}>
                  <input type="hidden" name="id" value={vendor.id} />
                  <button type="submit" className="btn btn-gold">
                    Invite to interview — email scheduling link
                  </button>
                </form>
              )}
              {vendor.status === "submitted" && (
                <form action={vendorTransitionAction}>
                  <input type="hidden" name="id" value={vendor.id} />
                  <input type="hidden" name="op" value="review" />
                  <button type="submit" className="btn">
                    Move to review
                  </button>
                </form>
              )}
              {vendor.status === "interview_scheduled" && (
                <form action={vendorTransitionAction}>
                  <input type="hidden" name="id" value={vendor.id} />
                  <input type="hidden" name="op" value="interviewed" />
                  <button type="submit" className="btn">
                    Mark interviewed
                  </button>
                </form>
              )}
              {["interviewed", "shortlisted"].includes(vendor.status) && (
                <>
                  <form action={vendorTransitionAction} className="flex items-center gap-2">
                    <input type="hidden" name="id" value={vendor.id} />
                    <input type="hidden" name="op" value="hire" />
                    <label className="flex items-center gap-1.5 text-[12px] text-muted">
                      <input type="checkbox" name="notify" defaultChecked /> notify
                    </label>
                    <button type="submit" className="btn btn-gold">
                      Hire
                    </button>
                  </form>
                  {vendor.status !== "shortlisted" && (
                    <form action={vendorTransitionAction}>
                      <input type="hidden" name="id" value={vendor.id} />
                      <input type="hidden" name="op" value="shortlist" />
                      <button type="submit" className="btn">
                        Shortlist
                      </button>
                    </form>
                  )}
                </>
              )}
              {vendor.status !== "rejected" && vendor.status !== "hired" && (
                <form action={vendorTransitionAction} className="flex items-center gap-2">
                  <input type="hidden" name="id" value={vendor.id} />
                  <input type="hidden" name="op" value="reject" />
                  <label className="flex items-center gap-1.5 text-[12px] text-muted">
                    <input type="checkbox" name="notify" /> notify
                  </label>
                  <button type="submit" className="btn btn-red">
                    Pass
                  </button>
                </form>
              )}
              {(vendor.status === "rejected" || vendor.status === "hired") && (
                <form action={vendorTransitionAction}>
                  <input type="hidden" name="id" value={vendor.id} />
                  <input type="hidden" name="op" value="reopen" />
                  <button type="submit" className="btn">
                    Reopen
                  </button>
                </form>
              )}
            </div>
            <p className="mt-3 text-[12px] text-faint">
              &quot;Invite to interview&quot; emails a one-time scheduling link; the candidate books
              into the host&apos;s blocks like a member prospect. Delivery follows the email mode in
              Settings — links always appear in the timeline.
            </p>
          </section>

          <section className="panel overflow-hidden">
            <p className="label border-b border-line px-4 pb-3 pt-4">Timeline</p>
            <Timeline items={timeline} />
          </section>
        </div>

        <aside>
          <CrmPanel entityType="staff_application" entityId={vendor.id} path={path} />
        </aside>
      </div>
    </>
  );
}
