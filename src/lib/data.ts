import "server-only";
import { getSupabaseAdmin } from "@core/supabase";
import type {
  VillaRow,
  RoomRow,
  EventRow,
  ProfileRow,
  BookingRow,
  ApplicationRow,
  UserRole,
} from "@core/database.types";
import { BLOCKING_STATUSES } from "@core/availability";
import type { SessionUser } from "./auth";

export const db = getSupabaseAdmin;

/**
 * Where a signed-in user belongs right now. Leads sit in the funnel
 * (application -> screening); members go through onboarding once, then /app.
 */
export async function resolveDestination(user: SessionUser): Promise<string> {
  if (["member", "admin", "operator"].includes(user.role)) {
    const { data: profile } = await db()
      .from("profiles")
      .select("onboarding_completed")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!profile?.onboarding_completed && user.role === "member") return "/onboarding";
    return "/app";
  }
  // lead
  const { data: application } = await db()
    .from("applications")
    .select("status")
    .eq("email", user.email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!application) return "/join";
  if (application.status === "approved") return "/onboarding";
  return "/pending";
}

export async function fetchGates(): Promise<VillaRow[]> {
  const { data } = await db()
    .from("villas")
    .select("*")
    .neq("status", "archived")
    .order("sort_order", { ascending: true });
  return (data as VillaRow[]) || [];
}

export type GateWithRooms = VillaRow & { rooms: RoomRow[] };

export async function fetchGateBySlug(slug: string): Promise<GateWithRooms | null> {
  const { data } = await db()
    .from("villas")
    .select("*, rooms(*)")
    .eq("slug", slug)
    .maybeSingle();
  return (data as unknown as GateWithRooms | null) || null;
}

export type EventWithMeta = EventRow & {
  villas: Pick<VillaRow, "name" | "slug" | "region"> | null;
  event_rsvps: { user_id: string; status: string }[];
};

export async function fetchUpcomingEvents(limit = 20): Promise<EventWithMeta[]> {
  const { data } = await db()
    .from("events")
    .select("*, villas(name, slug, region), event_rsvps(user_id, status)")
    .eq("status", "published")
    .gte("start_at", new Date(Date.now() - 12 * 3600_000).toISOString())
    .order("start_at", { ascending: true })
    .limit(limit);
  return (data as EventWithMeta[]) || [];
}

export type MemberCard = ProfileRow & {
  users: { id: string; email: string; role: UserRole } | null;
};

export async function fetchMembers(): Promise<MemberCard[]> {
  const { data } = await db()
    .from("profiles")
    .select("*, users!profiles_user_id_fkey(id, email, role)")
    .eq("visibility", "members")
    .order("created_at", { ascending: true });
  const rows = (data as MemberCard[]) || [];
  // Directory shows members and hosts (admins/operators), never funnel leads.
  return rows.filter((p) => p.users && p.users.role !== "lead");
}

export async function fetchProfileByUserId(userId: string): Promise<ProfileRow | null> {
  const { data } = await db()
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  return (data as unknown as ProfileRow | null) || null;
}

/** Accepted stays overlapping a window, with who is coming (for presence UI). */
export type PresenceBooking = BookingRow & {
  rooms: Pick<RoomRow, "name" | "slug"> | null;
  users: { id: string; email: string } | null;
};

export async function fetchPresence(
  villaId: string,
  from: string,
  to: string
): Promise<PresenceBooking[]> {
  const { data } = await db()
    .from("bookings")
    .select("*, rooms(name, slug), users(id, email)")
    .eq("villa_id", villaId)
    .in("status", BLOCKING_STATUSES)
    .lt("check_in", to)
    .gt("check_out", from);
  return (data as PresenceBooking[]) || [];
}

export async function fetchMyRequests(userId: string): Promise<
  (BookingRow & { rooms: Pick<RoomRow, "name"> | null; villas: Pick<VillaRow, "name" | "slug"> | null })[]
> {
  const { data } = await db()
    .from("bookings")
    .select("*, rooms(name), villas(name, slug)")
    .eq("user_id", userId)
    .order("check_in", { ascending: true });
  return (data as (BookingRow & { rooms: Pick<RoomRow, "name"> | null; villas: Pick<VillaRow, "name" | "slug"> | null })[]) || [];
}

/** Operator-editable copy (admin console → Content). Null → caller's fallback. */
export async function fetchContentBlock(key: string): Promise<string | null> {
  const { data } = await db()
    .from("content_blocks")
    .select("body_md")
    .eq("key", key)
    .maybeSingle();
  const body = (data?.body_md as string | undefined)?.trim();
  return body || null;
}

export async function fetchLatestApplication(email: string): Promise<ApplicationRow | null> {
  const { data } = await db()
    .from("applications")
    .select("*")
    .eq("email", email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as unknown as ApplicationRow | null) || null;
}
