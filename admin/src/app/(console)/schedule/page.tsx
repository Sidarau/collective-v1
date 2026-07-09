import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import ErrorBanner from "@/components/ErrorBanner";
import { listCalls, listScreeningWindows } from "@/lib/funnel-data";
import {
  addScreeningWindowAction,
  deleteScreeningWindowAction,
  ensureCalendarFeedAction,
  rotateCalendarFeedAction,
  setCallStatusAction,
  toggleScreeningWindowAction,
} from "@/lib/funnel-actions";
import { getAdminUser } from "@/lib/auth";
import { getSettingValue } from "@core/settings";
import { fmtMinute } from "@core/scheduling";
import { googleCalendarUrl } from "@core/ics";
import { config } from "@core/config";

export const dynamic = "force-dynamic";

const WEEKDAYS: [number, string][] = [
  [1, "Mon"],
  [2, "Tue"],
  [3, "Wed"],
  [4, "Thu"],
  [5, "Fri"],
  [6, "Sat"],
  [0, "Sun"],
];
const weekdayName = (d: number | null) => WEEKDAYS.find(([n]) => n === d)?.[1] || "—";

const callTime = (iso: string, tz: string) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));

const oneHourAgoIso = () => new Date(new Date().getTime() - 60 * 60_000).toISOString();

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const admin = (await getAdminUser())!;
  const [windows, upcoming, past, feedToken] = await Promise.all([
    listScreeningWindows(),
    listCalls({ from: oneHourAgoIso(), statuses: ["scheduled"] }),
    listCalls({ statuses: ["completed", "no_show", "cancelled"], limit: 15 }).then((rows) =>
      rows.reverse()
    ),
    getSettingValue<string>(`calendar_feed:${admin.id}`),
  ]);

  return (
    <>
      <PageHeader title="Screening schedule" eyebrow="The host's calendar" />
      <ErrorBanner error={error} />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_380px]">
        {/* Agenda */}
        <div className="space-y-5">
          <section className="panel overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <h3 className="text-sm font-semibold text-ink">Upcoming calls ({upcoming.length})</h3>
              <p className="text-[11px] text-faint">15 minutes · Ibiza clock</p>
            </div>
            {upcoming.length === 0 ? (
              <p className="px-4 py-5 text-sm text-faint">
                Nothing booked. Prospects book themselves into the blocks on the right.
              </p>
            ) : (
              <div className="divide-y divide-line">
                {upcoming.map((call) => {
                  const source = call.application_id
                    ? { href: `/applications/${call.application_id}`, label: "application" }
                    : call.staff_application_id
                      ? { href: `/vendors/${call.staff_application_id}`, label: call.staff_application?.role_applied || "vendor" }
                      : null;
                  return (
                    <div key={call.id} className="flex items-center gap-4 px-4 py-3">
                      <div className="w-40 shrink-0">
                        <p className="text-[13px] font-semibold text-gold">
                          {callTime(call.scheduled_at, call.timezone)}
                        </p>
                        <p className="text-[11px] text-faint">{call.duration_minutes} min · {call.kind}</p>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] text-ink">
                          {source ? (
                            <Link href={source.href} className="hover:text-gold">
                              {call.prospect_name}
                            </Link>
                          ) : (
                            call.prospect_name
                          )}
                        </p>
                        <p className="truncate text-[11px] text-muted">
                          {call.prospect_email}
                          {source ? ` · ${source.label}` : ""}
                        </p>
                      </div>
                      <a
                        href={googleCalendarUrl({
                          start: new Date(call.scheduled_at),
                          durationMinutes: call.duration_minutes,
                          title: `${config.brandName} — ${call.kind} call: ${call.prospect_name}`,
                          description: call.prospect_email,
                        })}
                        target="_blank"
                        rel="noreferrer"
                        className="btn"
                      >
                        + Calendar
                      </a>
                      {(["completed", "no_show", "cancelled"] as const).map((status) => (
                        <form key={status} action={setCallStatusAction}>
                          <input type="hidden" name="id" value={call.id} />
                          <input type="hidden" name="status" value={status} />
                          <input type="hidden" name="path" value="/schedule" />
                          <button
                            type="submit"
                            className={`btn ${status === "completed" ? "btn-gold" : status === "cancelled" ? "btn-red" : ""}`}
                          >
                            {status === "completed" ? "Done" : status === "no_show" ? "No-show" : "Cancel"}
                          </button>
                        </form>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="panel overflow-hidden">
            <p className="label border-b border-line px-4 pb-3 pt-4">Recent outcomes</p>
            {past.length === 0 ? (
              <p className="px-4 py-4 text-sm text-faint">No completed calls yet.</p>
            ) : (
              <div className="divide-y divide-line">
                {past.map((call) => (
                  <div key={call.id} className="flex items-center gap-4 px-4 py-2.5">
                    <p className="w-40 shrink-0 text-[12px] text-muted">
                      {callTime(call.scheduled_at, call.timezone)}
                    </p>
                    <p className="min-w-0 flex-1 truncate text-[13px] text-ink">{call.prospect_name}</p>
                    <span
                      className={`chip ${call.status === "completed" ? "chip-green" : call.status === "cancelled" ? "chip-red" : ""}`}
                    >
                      {call.status.replaceAll("_", " ")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Windows */}
        <div className="space-y-5">
          <section className="panel p-5">
            <p className="label">Add host blocks</p>
            <form action={addScreeningWindowAction} className="space-y-3">
              <input type="hidden" name="mode" value="weekly" />
              <div>
                <label className="label">Weekdays</label>
                <div className="flex flex-wrap gap-1.5">
                  {WEEKDAYS.map(([value, label]) => (
                    <label
                      key={value}
                      className="flex cursor-pointer items-center gap-1.5 rounded-md border border-line bg-base px-2.5 py-1.5 text-[12px] text-muted has-[:checked]:border-gold/60 has-[:checked]:text-gold"
                    >
                      <input type="checkbox" name="weekday" value={value} className="accent-[#e0bd73]" />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="label">From</label>
                  <input name="start" type="time" required defaultValue="09:30" className="input" />
                </div>
                <div>
                  <label className="label">To</label>
                  <input name="end" type="time" required defaultValue="11:00" className="input" />
                </div>
                <div>
                  <label className="label">For</label>
                  <select name="kind" className="input">
                    <option value="both">Both funnels</option>
                    <option value="member">Members only</option>
                    <option value="vendor">Vendors only</option>
                  </select>
                </div>
              </div>
              <button type="submit" className="btn btn-gold w-full">
                Add weekly blocks
              </button>
            </form>

            <div className="my-4 border-t border-line" />

            <form action={addScreeningWindowAction} className="space-y-3">
              <input type="hidden" name="mode" value="date" />
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="label">One-off date</label>
                  <input name="date" type="date" className="input" />
                </div>
                <div>
                  <label className="label">From</label>
                  <input name="start" type="time" required defaultValue="16:00" className="input" />
                </div>
                <div>
                  <label className="label">To</label>
                  <input name="end" type="time" required defaultValue="17:00" className="input" />
                </div>
              </div>
              <input type="hidden" name="kind" value="both" />
              <button type="submit" className="btn w-full">
                Add one-off block
              </button>
            </form>
            <p className="mt-3 text-[12px] text-faint">
              Prospects see these as 15-minute slots on the Ibiza clock, at least 2 hours ahead,
              21 days out. Booked slots disappear automatically.
            </p>
          </section>

          {/* Google Calendar connector */}
          <section className="panel p-5">
            <p className="label">Your Google Calendar</p>
            {feedToken ? (
              <>
                <p className="text-[12.5px] leading-relaxed text-muted">
                  Subscribe once and every screening call and interview lands in your calendar.
                  In Google Calendar: <span className="text-ink">Other calendars → + → From URL</span>,
                  paste this link:
                </p>
                <code className="mt-3 block select-all break-all rounded-[10px] border border-white/12 bg-black/40 p-3 text-[11.5px] text-gold">
                  {`${config.adminUrl || "https://opencollective.app"}/api/schedule/feed/${feedToken}`}
                </code>
                <p className="mt-2 text-[11.5px] text-faint">
                  Works in Apple Calendar and Outlook too. Google refreshes feeds every few hours.
                  The link is personal — rotate it if it ever leaks.
                </p>
                <form action={rotateCalendarFeedAction} className="mt-3">
                  <button type="submit" className="btn btn-red">
                    Rotate link
                  </button>
                </form>
              </>
            ) : (
              <>
                <p className="text-[12.5px] leading-relaxed text-muted">
                  Create a personal read-only feed and subscribe to it from Google Calendar —
                  bookings appear automatically, no account linking needed.
                </p>
                <form action={ensureCalendarFeedAction} className="mt-3">
                  <button type="submit" className="btn btn-gold">
                    Create my calendar link
                  </button>
                </form>
              </>
            )}
          </section>

          <section className="panel overflow-hidden">
            <p className="label border-b border-line px-4 pb-3 pt-4">Current blocks</p>
            {windows.length === 0 ? (
              <p className="px-4 py-4 text-sm text-faint">
                No blocks yet — prospects can&apos;t book until you add some.
              </p>
            ) : (
              <div className="divide-y divide-line">
                {windows.map((w) => (
                  <div key={w.id} className={`flex items-center gap-3 px-4 py-2.5 ${w.active ? "" : "opacity-50"}`}>
                    <p className="w-24 shrink-0 text-[13px] font-medium text-ink">
                      {w.date || weekdayName(w.weekday)}
                    </p>
                    <p className="flex-1 text-[13px] text-muted">
                      {fmtMinute(w.start_minute)}–{fmtMinute(w.end_minute)}
                      <span className="text-faint"> · {w.kind}</span>
                    </p>
                    <form action={toggleScreeningWindowAction}>
                      <input type="hidden" name="id" value={w.id} />
                      <input type="hidden" name="active" value={w.active ? "false" : "true"} />
                      <button type="submit" className="btn">
                        {w.active ? "Pause" : "Resume"}
                      </button>
                    </form>
                    <form action={deleteScreeningWindowAction}>
                      <input type="hidden" name="id" value={w.id} />
                      <button type="submit" className="btn btn-red">
                        ✕
                      </button>
                    </form>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
