import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import StatusChip from "@/components/StatusChip";
import { listVendorApplications } from "@/lib/funnel-data";
import { fmtDate } from "@/lib/format";
import type { StaffApplicationStatus } from "@core/database.types";

export const dynamic = "force-dynamic";

const STAGES: { status: StaffApplicationStatus; label: string; hint: string }[] = [
  { status: "submitted", label: "New", hint: "Prescreen these" },
  { status: "review", label: "In review", hint: "Invited or being checked" },
  { status: "interview_scheduled", label: "Interview booked", hint: "On the schedule" },
  { status: "interviewed", label: "Interviewed", hint: "Decide" },
  { status: "shortlisted", label: "Shortlist", hint: "Bench strength" },
  { status: "hired", label: "Hired", hint: "Working with the house" },
];

const callTime = (iso: string, tz: string) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));

export default async function VendorsPage() {
  const vendors = await listVendorApplications();
  const rejected = vendors.filter((v) => v.status === "rejected");

  return (
    <>
      <PageHeader title="Vendors & staff" eyebrow="Hiring funnel">
        <p className="text-[12px] text-faint">
          Housekeepers, chefs, maintenance, drivers — share a vendor door from Referral Links.
        </p>
      </PageHeader>

      <div className="grid grid-cols-3 gap-4">
        {STAGES.map((stage) => {
          const rows = vendors.filter((v) => v.status === stage.status);
          return (
            <section key={stage.status} className="panel self-start overflow-hidden">
              <div className="flex items-baseline justify-between border-b border-line px-4 py-3">
                <h3 className="text-sm font-semibold text-ink">
                  {stage.label} <span className="text-muted">({rows.length})</span>
                </h3>
                <p className="text-[11px] text-faint">{stage.hint}</p>
              </div>
              {rows.length === 0 ? (
                <p className="px-4 py-4 text-[12px] text-faint">Empty.</p>
              ) : (
                <div className="divide-y divide-line">
                  {rows.map((v) => (
                    <Link key={v.id} href={`/vendors/${v.id}`} className="block px-4 py-3 hover:bg-white/5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-[13px] font-medium text-ink">{v.name}</p>
                        <span className="chip">{v.role_applied}</span>
                      </div>
                      <p className="mt-1 truncate text-[11px] text-muted">
                        {v.company ? `${v.company} · ` : ""}
                        {v.email}
                      </p>
                      <p className="mt-1 text-[11px] text-faint">
                        {v.call && v.call.status === "scheduled"
                          ? `Call ${callTime(v.call.scheduled_at, v.call.timezone)}`
                          : fmtDate(v.created_at)}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>

      {rejected.length > 0 && (
        <section className="panel mt-5 overflow-hidden">
          <p className="label border-b border-line px-4 pb-3 pt-4">Passed on ({rejected.length})</p>
          <div className="divide-y divide-line">
            {rejected.map((v) => (
              <Link
                key={v.id}
                href={`/vendors/${v.id}`}
                className="flex items-center justify-between px-4 py-2.5 opacity-60 hover:bg-white/5 hover:opacity-100"
              >
                <p className="text-[13px] text-ink">
                  {v.name} <span className="text-muted">· {v.role_applied}</span>
                </p>
                <StatusChip value={v.status} />
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
