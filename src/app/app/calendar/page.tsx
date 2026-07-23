import { getAuthUser } from "@/lib/auth";
import { db, fetchGates, fetchUpcomingEvents, fetchPresence } from "@/lib/data";
import { buildDailyAvailability, fetchVillaClosures, BLOCKING_STATUSES } from "@core/availability";
import CalendarView, { type CalendarEvent, type PresenceEntry } from "./CalendarView";
import { fullName } from "@core/names";

export const dynamic = "force-dynamic";

/**
 * Calendar: events at every Gate plus a birds-eye view of the house —
 * who is around, and which days still have free rooms.
 */
export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string }>;
}) {
  const { event: openEventSlug } = await searchParams;
  const user = (await getAuthUser())!;

  const gates = await fetchGates();
  const liveGate = gates.find((g) => g.status === "published");

  const today = new Date();
  const fromISO = today.toISOString().slice(0, 10);
  const horizon = new Date(today.getTime() + 90 * 86400_000).toISOString().slice(0, 10);

  const [events, presence, rooms, bookings, blocks] = await Promise.all([
    fetchUpcomingEvents(30),
    liveGate ? fetchPresence(liveGate.id, fromISO, horizon) : Promise.resolve([]),
    liveGate
      ? db().from("rooms").select("id").eq("villa_id", liveGate.id).then((r) => r.data || [])
      : Promise.resolve([]),
    liveGate
      ? db()
          .from("bookings")
          .select("room_id, check_in, check_out, status")
          .eq("villa_id", liveGate.id)
          .in("status", BLOCKING_STATUSES)
          .lt("check_in", horizon)
          .gt("check_out", fromISO)
          .then((r) => r.data || [])
      : Promise.resolve([]),
    db()
      .from("availability_blocks")
      .select("room_id, date, status")
      .neq("status", "available")
      .gte("date", fromISO)
      .lt("date", horizon)
      .then((r) => r.data || []),
  ]);

  // Resolve attendee + guest names for events and presence.
  const userIds = new Set<string>();
  for (const ev of events) for (const r of ev.event_rsvps) userIds.add(r.user_id);
  for (const p of presence) if (p.users) userIds.add(p.users.id);

  const { data: profileRows } = userIds.size
    ? await db()
        .from("profiles")
        .select("user_id, first_name, last_name, headline")
        .in("user_id", Array.from(userIds))
    : { data: [] };
  const names = new Map(
    (profileRows || []).map((p) => [
      p.user_id,
      { name: fullName(p.first_name, p.last_name), headline: p.headline as string | null },
    ])
  );

  const calendarEvents: CalendarEvent[] = events.map((ev) => ({
    id: ev.id,
    slug: ev.slug,
    title: ev.title,
    description: ev.description,
    type: ev.event_type,
    audience: ev.audience,
    startAt: ev.start_at,
    endAt: ev.end_at,
    image: ev.image,
    capacity: ev.capacity,
    gateName: ev.villas?.name || null,
    gateSlug: ev.villas?.slug || null,
    myRsvp: ev.event_rsvps.find((r) => r.user_id === user.id)?.status || null,
    attendees: ev.event_rsvps
      .filter((r) => r.status === "going")
      .map((r) => ({
        userId: r.user_id,
        name: names.get(r.user_id)?.name || "A member",
        headline: names.get(r.user_id)?.headline || null,
      })),
  }));

  const presenceEntries: PresenceEntry[] = presence.map((p) => ({
    from: p.check_in,
    to: p.check_out,
    name: p.users ? names.get(p.users.id)?.name || "A member" : "A member",
    userId: p.users?.id || null,
    withCompanion: !!p.companion_name,
  }));

  const closures = liveGate
    ? await fetchVillaClosures(db(), liveGate.id, fromISO, horizon)
    : [];
  const freeRooms = liveGate
    ? buildDailyAvailability(rooms, fromISO, horizon, bookings, blocks, closures)
    : {};

  return (
    <CalendarView
      gateName={liveGate?.name || "The Gate"}
      gateSlug={liveGate?.slug || ""}
      totalRooms={rooms.length}
      events={calendarEvents}
      presence={presenceEntries}
      freeRooms={freeRooms}
      openEventSlug={openEventSlug || null}
    />
  );
}
