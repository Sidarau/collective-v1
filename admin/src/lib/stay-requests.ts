import { getSupabaseAdmin } from "@core/supabase";
import { sendTrackedEmail } from "@core/email";
import { writeAudit } from "@core/audit";
import {
  approveStayRequest,
  publicStayRequestView,
  type ApprovableStayStatus,
  type AtomicStayApproval,
  type StayApprovalInput,
  type StayApprovalResult,
  type StayNotificationStatus,
  type StayRequestSearchResult,
  type StayRequestSearchSource,
} from "@core/stay-requests";
import type { BookingRow, Json } from "@core/database.types";

interface SearchInput {
  query?: string;
  checkIn?: string;
  checkOut?: string;
  status?: BookingRow["status"];
  limit?: number;
}

interface BookingSearchRow {
  id: string;
  lead_id: string;
  user_id: string | null;
  room_id: string;
  villa_id: string;
  check_in: string;
  check_out: string;
  status: BookingRow["status"];
  guest_names: string[];
}

function atomicApproval(value: Json): AtomicStayApproval {
  if (!value || Array.isArray(value) || typeof value !== "object") {
    throw new Error("Approval returned an invalid receipt");
  }
  const row = value as Record<string, Json | undefined>;
  if (
    typeof row.booking_id !== "string" ||
    typeof row.changed !== "boolean" ||
    typeof row.from_status !== "string" ||
    row.status !== "approved" ||
    typeof row.check_in !== "string" ||
    typeof row.check_out !== "string" ||
    !(typeof row.user_id === "string" || row.user_id === null) ||
    typeof row.from_room_id !== "string" ||
    typeof row.room_id !== "string"
  ) {
    throw new Error("Approval returned an incomplete receipt");
  }
  return {
    booking_id: row.booking_id,
    changed: row.changed,
    from_status: row.from_status,
    status: "approved",
    check_in: row.check_in,
    check_out: row.check_out,
    user_id: row.user_id,
    from_room_id: row.from_room_id,
    room_id: row.room_id,
  };
}

export async function approveStayRequestLive(
  input: StayApprovalInput
): Promise<StayApprovalResult> {
  const supabase = getSupabaseAdmin();
  return approveStayRequest(input, {
    async approveAtomic({ id, expectedStatus, targetRoomId, note }) {
      const { data, error } = await supabase.rpc("approve_stay_request_with_room", {
        p_booking_id: id,
        p_expected_status: expectedStatus,
        p_target_room_id: targetRoomId,
        p_note: note,
      });
      if (error) throw new Error(error.message);
      return atomicApproval(data);
    },
    async resolveRecipient(userId) {
      const { data } = await supabase
        .from("users")
        .select("email")
        .eq("id", userId)
        .maybeSingle();
      return data?.email || null;
    },
    async notifyApproved({ bookingId, email, checkIn, checkOut, actorId }) {
      const result = await sendTrackedEmail({
        to: email,
        subject: "Your window is approved",
        heading: "From the Gate",
        body: `Your window ${checkIn} → ${checkOut} has been approved by the host. You'll receive arrival details as the dates approach.`,
        template: "stay_approve",
        entityType: "booking",
        entityId: bookingId,
        actorId,
      });
      return result.status as Exclude<
        StayNotificationStatus,
        "skipped" | "recipient_missing"
      >;
    },
    async audit(event) {
      const label = event.actor.label ? `[${event.actor.label}] ` : "";
      await writeAudit({
        actorId: event.actor.id,
        actorEmail: event.actor.email,
        action: event.action,
        entityType: "booking",
        entityId: event.bookingId,
        summary: `${label}${event.summary}`,
        meta: {
          ...event.meta,
          via: event.actor.via,
        } as Record<string, Json | undefined>,
      });
    },
  });
}

export async function searchStayRequests(
  input: SearchInput
): Promise<StayRequestSearchResult[]> {
  const supabase = getSupabaseAdmin();
  const limit = Math.min(Math.max(input.limit || 20, 1), 50);
  let request = supabase
    .from("bookings")
    .select("id, lead_id, user_id, room_id, villa_id, check_in, check_out, status, guest_names")
    .order("check_in", { ascending: true })
    .limit(input.query ? 100 : limit);

  if (input.status) request = request.eq("status", input.status);
  if (input.checkIn) request = request.eq("check_in", input.checkIn);
  if (input.checkOut) request = request.eq("check_out", input.checkOut);

  const { data, error } = await request;
  if (error) throw new Error(error.message);
  const bookings = (data || []) as BookingSearchRow[];
  if (!bookings.length) return [];

  const leadIds = [...new Set(bookings.map((booking) => booking.lead_id).filter(Boolean))];
  const userIds = [
    ...new Set(
      bookings
        .map((booking) => booking.user_id)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const roomIds = [...new Set(bookings.map((booking) => booking.room_id))];
  const villaIds = [...new Set(bookings.map((booking) => booking.villa_id))];

  const [leadResult, profileResult, roomResult, villaResult] = await Promise.all([
    leadIds.length
      ? supabase.from("leads").select("id, first_name, last_name").in("id", leadIds)
      : Promise.resolve({ data: [] }),
    userIds.length
      ? supabase.from("profiles").select("user_id, first_name, last_name").in("user_id", userIds)
      : Promise.resolve({ data: [] }),
    supabase.from("rooms").select("id, name").in("id", roomIds),
    supabase.from("villas").select("id, name").in("id", villaIds),
  ]);

  const leadNames = new Map(
    (leadResult.data || []).map((lead) => [
      lead.id,
      `${lead.first_name} ${lead.last_name}`.trim(),
    ])
  );
  const profileNames = new Map(
    (profileResult.data || []).map((profile) => [
      profile.user_id,
      `${profile.first_name} ${profile.last_name}`.trim(),
    ])
  );
  const roomNames = new Map(
    (roomResult.data || []).map((room) => [room.id, room.name])
  );
  const villaNames = new Map(
    (villaResult.data || []).map((villa) => [villa.id, villa.name])
  );

  const query = input.query?.trim().toLocaleLowerCase();
  return bookings
    .map((booking) => {
      const memberName =
        (booking.user_id ? profileNames.get(booking.user_id) : null) ||
        leadNames.get(booking.lead_id) ||
        booking.guest_names?.[0] ||
        "Unknown guest";
      const source: StayRequestSearchSource = {
        id: booking.id,
        memberName,
        checkIn: booking.check_in,
        checkOut: booking.check_out,
        status: booking.status,
        roomName: roomNames.get(booking.room_id) || "Unknown room",
        gateName: villaNames.get(booking.villa_id) || "Unknown gate",
      };
      return publicStayRequestView(source);
    })
    .filter((booking) =>
      query ? booking.memberName.toLocaleLowerCase().includes(query) : true
    )
    .slice(0, limit);
}

export function isApprovableStayStatus(
  status: string
): status is ApprovableStayStatus {
  return status === "requested" || status === "waitlisted";
}

export interface StayRoomAvailability {
  id: string;
  name: string;
  current: boolean;
  available: boolean;
  samePrice: boolean;
  maxGuests: number;
}

export async function getStayRequestAvailability(
  id: string
): Promise<{
  requestId: string;
  checkIn: string;
  checkOut: string;
  status: string;
  rooms: StayRoomAvailability[];
}> {
  const supabase = getSupabaseAdmin();
  const { data: booking, error } = await supabase
    .from("bookings")
    .select("id, villa_id, room_id, check_in, check_out, status, guests")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!booking) throw new Error("Stay request not found");

  const { data: currentRoom } = await supabase
    .from("rooms")
    .select("base_price_per_night, currency")
    .eq("id", booking.room_id)
    .single();
  if (!currentRoom) throw new Error("Current room not found");

  const [
    { data: rooms, error: roomsError },
    { data: closures, error: closuresError },
    { data: blocks, error: blocksError },
    { data: committed, error: committedError },
  ] =
    await Promise.all([
      supabase
        .from("rooms")
        .select("id, name, max_guests, base_price_per_night, currency, sort_order")
        .eq("villa_id", booking.villa_id)
        .order("sort_order"),
      supabase
        .from("closure_periods")
        .select("room_id")
        .eq("villa_id", booking.villa_id)
        .lt("starts_on", booking.check_out)
        .or(`ends_on.is.null,ends_on.gte.${booking.check_in}`),
      supabase
        .from("availability_blocks")
        .select("room_id")
        .neq("status", "available")
        .gte("date", booking.check_in)
        .lt("date", booking.check_out),
      supabase
        .from("bookings")
        .select("room_id")
        .neq("id", booking.id)
        .in("status", ["approved", "deposit_paid", "paid", "confirmed"])
        .lt("check_in", booking.check_out)
        .gt("check_out", booking.check_in),
    ]);
  const availabilityError =
    roomsError || closuresError || blocksError || committedError;
  if (availabilityError) throw new Error(availabilityError.message);

  const wholeGateClosed = (closures || []).some((row) => row.room_id === null);
  const closedRooms = new Set(
    (closures || []).map((row) => row.room_id).filter((roomId): roomId is string => Boolean(roomId))
  );
  const blockedRooms = new Set((blocks || []).map((row) => row.room_id));
  const committedRooms = new Set((committed || []).map((row) => row.room_id));

  return {
    requestId: booking.id,
    checkIn: booking.check_in,
    checkOut: booking.check_out,
    status: booking.status,
    rooms: (rooms || []).map((room) => {
      const samePrice =
        room.base_price_per_night === currentRoom.base_price_per_night &&
        room.currency === currentRoom.currency;
      return {
        id: room.id,
        name: room.name,
        current: room.id === booking.room_id,
        available:
          !wholeGateClosed &&
          !closedRooms.has(room.id) &&
          !blockedRooms.has(room.id) &&
          !committedRooms.has(room.id) &&
          room.max_guests >= booking.guests,
        samePrice,
        maxGuests: room.max_guests,
      };
    }),
  };
}
