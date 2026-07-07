import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import StatusChip from "@/components/StatusChip";
import Timeline from "@/components/Timeline";
import CrmPanel from "@/components/CrmPanel";
import ErrorBanner from "@/components/ErrorBanner";
import { getPersonDetail } from "@/lib/admin-data";
import { fmtDate } from "@/lib/format";
import {
  setPersonRoleAction,
  reinvitePersonAction,
  toggleSuppressionAction,
  setFollowUpStatusAction,
} from "@/lib/actions";

export const dynamic = "force-dynamic";

const ROLES = ["lead", "member", "operator", "admin"] as const;

export default async function PersonDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const detail = await getPersonDetail(id);
  if (!detail) notFound();
  const {
    user,
    profile,
    lead,
    applications,
    bookings,
    rsvps,
    intros,
    credits,
    suppression,
    followUps,
    timeline,
    emails,
  } = detail;
  const path = `/people/${id}`;

  const name = profile
    ? `${profile.first_name} ${profile.last_name}`
    : lead
      ? `${lead.first_name} ${lead.last_name}`
      : user.email;

  return (
    <>
      <Link href="/people" className="mb-2 inline-block text-[12px] text-muted hover:text-ink">
        ← People
      </Link>
      <PageHeader title={name} eyebrow="Person">
        <div className="flex items-center gap-2">
          {suppression && <span className="chip chip-red">suppressed</span>}
          <StatusChip value={user.role} />
        </div>
      </PageHeader>
      <ErrorBanner error={error} />

      <div className="grid grid-cols-[1fr_320px] gap-5">
        <div className="space-y-5">
          {/* Identity */}
          <section className="panel p-5">
            <p className="label">Identity</p>
            <dl className="kv mt-2">
              <div className="contents"><dt>Email</dt><dd>{user.email}</dd></div>
              {profile?.headline && <div className="contents"><dt>Does</dt><dd>{profile.headline}</dd></div>}
              {profile?.location && <div className="contents"><dt>Based in</dt><dd>{profile.location}</dd></div>}
              {(profile?.phone || lead?.phone) && (
                <div className="contents"><dt>Phone</dt><dd>{profile?.phone || lead?.phone}</dd></div>
              )}
              {(profile?.whatsapp || lead?.whatsapp) && (
                <div className="contents"><dt>WhatsApp</dt><dd>{profile?.whatsapp || lead?.whatsapp}</dd></div>
              )}
              {(profile?.allergies || profile?.dietary) && (
                <div className="contents">
                  <dt>Kitchen</dt>
                  <dd className="text-gold">{[profile?.allergies, profile?.dietary].filter(Boolean).join(" · ")}</dd>
                </div>
              )}
              {lead?.source && <div className="contents"><dt>Source</dt><dd>{lead.source}</dd></div>}
              <div className="contents"><dt>Since</dt><dd>{fmtDate(user.created_at)}</dd></div>
              {profile && (
                <div className="contents">
                  <dt>Onboarding</dt>
                  <dd>{profile.onboarding_completed ? "complete" : "not completed"}</dd>
                </div>
              )}
            </dl>
            {profile?.bio && <p className="mt-3 text-[13px] leading-relaxed text-muted">{profile.bio}</p>}
            {profile?.contribution && (
              <p className="mt-2 text-[13px] leading-relaxed text-muted">
                <span className="text-faint">Brings: </span>
                {profile.contribution}
              </p>
            )}
          </section>

          {/* Manage */}
          <section className="panel p-5">
            <p className="label">Manage</p>
            <div className="flex flex-wrap items-center gap-2">
              <form action={setPersonRoleAction} className="flex items-center gap-2">
                <input type="hidden" name="userId" value={user.id} />
                <select name="role" defaultValue={user.role} className="input max-w-[130px]">
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <button type="submit" className="btn">
                  Set role
                </button>
              </form>
              <form action={reinvitePersonAction}>
                <input type="hidden" name="userId" value={user.id} />
                <button type="submit" className="btn btn-gold">
                  Mint entrance link
                </button>
              </form>
              <form action={toggleSuppressionAction}>
                <input type="hidden" name="email" value={user.email} />
                <input type="hidden" name="path" value={path} />
                <button type="submit" className={`btn ${suppression ? "" : "btn-red"}`}>
                  {suppression ? "Unsuppress email" : "Suppress email"}
                </button>
              </form>
            </div>
          </section>

          {/* Footprint */}
          <section className="panel p-5">
            <p className="label">Footprint</p>
            <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-3 text-[13px]">
              <div>
                <p className="text-faint">Applications</p>
                {applications.length === 0 && <p className="text-muted">—</p>}
                {applications.map((a) => (
                  <p key={a.id} className="mt-1">
                    <Link href={`/applications/${a.id}`} className="text-ink hover:text-gold">
                      {fmtDate(a.created_at)}
                    </Link>{" "}
                    <StatusChip value={a.status} />
                  </p>
                ))}
              </div>
              <div>
                <p className="text-faint">Windows</p>
                {bookings.length === 0 && <p className="text-muted">—</p>}
                {bookings.slice(0, 5).map((b) => (
                  <p key={b.id} className="mt-1">
                    <Link href={`/requests/${b.id}`} className="text-ink hover:text-gold">
                      {fmtDate(b.check_in)} → {fmtDate(b.check_out)}
                    </Link>{" "}
                    <StatusChip value={b.status} />
                  </p>
                ))}
              </div>
              <div>
                <p className="text-faint">RSVPs</p>
                <p className="text-muted">{rsvps.filter((r) => r.status === "going").length} going</p>
              </div>
              <div>
                <p className="text-faint">Intros</p>
                <p className="text-muted">{intros.length} total</p>
              </div>
            </div>
          </section>

          {/* Referrals */}
          {credits.length > 0 && (
            <section className="panel overflow-hidden">
              <p className="label border-b border-line px-4 pb-3 pt-4">Referral credits</p>
              <table className="table">
                <thead>
                  <tr><th>Referred</th><th>Status</th><th>Reward</th><th>Opened</th></tr>
                </thead>
                <tbody>
                  {credits.map((c) => (
                    <tr key={c.id}>
                      <td>{c.referred_email || "—"}</td>
                      <td><StatusChip value={c.status} /></td>
                      <td>{c.reward.replaceAll("_", " ")}</td>
                      <td>{fmtDate(c.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {/* Open follow-ups */}
          {followUps.length > 0 && (
            <section className="panel p-5">
              <p className="label">Open follow-ups</p>
              <div className="space-y-2">
                {followUps.map((f) => (
                  <div key={f.id} className="flex items-center justify-between gap-3">
                    <p className="text-[13px] text-ink">
                      {f.title}
                      {f.due_at && <span className="text-faint"> · due {fmtDate(f.due_at)}</span>}
                    </p>
                    <form action={setFollowUpStatusAction}>
                      <input type="hidden" name="id" value={f.id} />
                      <input type="hidden" name="status" value="done" />
                      <input type="hidden" name="path" value={path} />
                      <button type="submit" className="btn">
                        Done
                      </button>
                    </form>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Emails to this person */}
          {emails.length > 0 && (
            <section className="panel overflow-hidden">
              <p className="label border-b border-line px-4 pb-3 pt-4">Email history</p>
              <table className="table">
                <thead>
                  <tr><th>Template</th><th>Subject</th><th>Status</th><th>When</th></tr>
                </thead>
                <tbody>
                  {emails.map((e) => (
                    <tr key={e.id}>
                      <td>{e.template || "—"}</td>
                      <td>{e.subject}</td>
                      <td><StatusChip value={e.status} /></td>
                      <td>{fmtDate(e.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {/* Activity */}
          <section className="panel overflow-hidden">
            <p className="label border-b border-line px-4 pb-3 pt-4">Timeline</p>
            <Timeline items={timeline} />
          </section>
        </div>

        <aside>
          <CrmPanel entityType="user" entityId={user.id} path={path} />
        </aside>
      </div>
    </>
  );
}
