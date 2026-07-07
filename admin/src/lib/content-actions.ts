"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@core/supabase";
import { writeAudit } from "@core/audit";
import { zonedToUtc, DEFAULT_TIMEZONE } from "@core/scheduling";
import type { EventStatus, EventType, GateStatus, RoomRow } from "@core/database.types";
import { getAdminUser } from "./auth";

const db = getSupabaseAdmin;

async function requireAdmin() {
  const admin = await getAdminUser();
  if (!admin) throw new Error("Not authorized");
  return admin;
}

function backTo(path: string, error?: string): never {
  redirect(error ? `${path}?error=${encodeURIComponent(error)}` : path);
}

function str(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function list(formData: FormData, key: string): string[] {
  return str(formData, key)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function images(formData: FormData, key: string): string[] {
  try {
    const parsed = JSON.parse(str(formData, key) || "[]");
    return Array.isArray(parsed) ? parsed.filter((u) => typeof u === "string" && u) : [];
  } catch {
    return [];
  }
}

const slugify = (input: string) =>
  input.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") ||
  "untitled";

/** Villa wall-clock "YYYY-MM-DDTHH:MM" → UTC ISO. */
function madridToIso(local: string): string | null {
  const m = local.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  return zonedToUtc(
    Number(m[1]),
    Number(m[2]),
    Number(m[3]),
    Number(m[4]) * 60 + Number(m[5]),
    DEFAULT_TIMEZONE
  ).toISOString();
}

// ---------------------------------------------------------------- Gates

export async function saveGateAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = str(formData, "id");
  const path = `/gates/${id}`;
  const name = str(formData, "name");
  if (!name) backTo(path, "The gate needs a name");

  const statusRaw = str(formData, "status");
  const status = (["published", "coming_soon", "archived"].includes(statusRaw)
    ? statusRaw
    : "coming_soon") as GateStatus;

  try {
    const { error } = await db()
      .from("villas")
      .update({
        name,
        location: str(formData, "location") || "—",
        region: str(formData, "region") || null,
        tagline: str(formData, "tagline") || null,
        description: str(formData, "description") || null,
        story: str(formData, "story") || null,
        status,
        sort_order: parseInt(str(formData, "sortOrder"), 10) || 0,
        max_guests: parseInt(str(formData, "maxGuests"), 10) || 8,
        amenities: list(formData, "amenities"),
        hero_image: str(formData, "heroImage") || null,
        images: images(formData, "images"),
      })
      .eq("id", id);
    if (error) throw new Error(error.message);

    await writeAudit({
      actorId: admin.id,
      actorEmail: admin.email,
      action: "villa.update",
      entityType: "villa",
      entityId: id,
      summary: `Gate "${name}" updated`,
    });
  } catch (err) {
    backTo(path, err instanceof Error ? err.message : "Save failed");
  }
  revalidatePath(path);
  revalidatePath("/gates");
  backTo(path);
}

export async function createGateAction(formData: FormData) {
  const admin = await requireAdmin();
  const name = str(formData, "name");
  if (!name) backTo("/gates", "Give the gate a name");

  let gateId = "";
  try {
    const { data, error } = await db()
      .from("villas")
      .insert({
        name,
        slug: slugify(name),
        location: str(formData, "location") || "—",
        status: "coming_soon",
        sort_order: 99,
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message || "Create failed");
    gateId = data.id;

    await writeAudit({
      actorId: admin.id,
      actorEmail: admin.email,
      action: "villa.create",
      entityType: "villa",
      entityId: gateId,
      summary: `Gate "${name}" created (coming soon)`,
    });
  } catch (err) {
    backTo("/gates", err instanceof Error ? err.message : "Create failed");
  }
  revalidatePath("/gates");
  backTo(`/gates/${gateId}`);
}

// ---------------------------------------------------------------- Rooms

export async function saveRoomAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = str(formData, "id");
  const gateId = str(formData, "gateId");
  const path = `/gates/${gateId}`;
  const name = str(formData, "name");
  if (!name) backTo(path, "The room needs a name");

  const typeRaw = str(formData, "roomType");
  const roomType = (["single", "double", "suite", "master"].includes(typeRaw)
    ? typeRaw
    : "double") as RoomRow["room_type"];
  const euros = parseFloat(str(formData, "price") || "0");

  try {
    const { error } = await db()
      .from("rooms")
      .update({
        name,
        description: str(formData, "description") || null,
        room_type: roomType,
        bed_type: str(formData, "bedType") || null,
        max_guests: parseInt(str(formData, "maxGuests"), 10) || 2,
        base_price_per_night: Number.isFinite(euros) ? Math.round(euros * 100) : 0,
        amenities: list(formData, "amenities"),
        images: images(formData, "images"),
      })
      .eq("id", id);
    if (error) throw new Error(error.message);

    await writeAudit({
      actorId: admin.id,
      actorEmail: admin.email,
      action: "room.update",
      entityType: "room",
      entityId: id,
      summary: `Room "${name}" updated`,
    });
  } catch (err) {
    backTo(path, err instanceof Error ? err.message : "Save failed");
  }
  revalidatePath(path);
  backTo(path);
}

export async function createRoomAction(formData: FormData) {
  const admin = await requireAdmin();
  const gateId = str(formData, "gateId");
  const path = `/gates/${gateId}`;
  const name = str(formData, "name");
  if (!name) backTo(path, "Give the room a name");

  try {
    const { data, error } = await db()
      .from("rooms")
      .insert({
        villa_id: gateId,
        name,
        slug: slugify(name),
        room_type: "double",
        max_guests: 2,
        base_price_per_night: 0,
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message || "Create failed");

    await writeAudit({
      actorId: admin.id,
      actorEmail: admin.email,
      action: "room.create",
      entityType: "room",
      entityId: data.id,
      summary: `Room "${name}" added`,
    });
  } catch (err) {
    backTo(path, err instanceof Error ? err.message : "Create failed");
  }
  revalidatePath(path);
  backTo(path);
}

export async function deleteRoomAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = str(formData, "id");
  const gateId = str(formData, "gateId");
  const path = `/gates/${gateId}`;

  const { count } = await db()
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("room_id", id);
  if (count && count > 0) {
    backTo(path, `That room has ${count} booking(s) — it can't be deleted`);
  }

  try {
    await db().from("availability_blocks").delete().eq("room_id", id);
    const { error } = await db().from("rooms").delete().eq("id", id);
    if (error) throw new Error(error.message);

    await writeAudit({
      actorId: admin.id,
      actorEmail: admin.email,
      action: "room.delete",
      entityType: "room",
      entityId: id,
      summary: "Room deleted (no bookings attached)",
    });
  } catch (err) {
    backTo(path, err instanceof Error ? err.message : "Delete failed");
  }
  revalidatePath(path);
  backTo(path);
}

// ---------------------------------------------------------------- Events

export async function saveEventAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = str(formData, "id");
  const isNew = !id;
  const title = str(formData, "title");
  const backPath = isNew ? "/events" : `/events/${id}`;
  if (!title) backTo(backPath, "The event needs a title");

  const startAt = madridToIso(str(formData, "startAt"));
  if (!startAt) backTo(backPath, "Give the event a start time");
  const endAt = madridToIso(str(formData, "endAt"));

  const typeRaw = str(formData, "eventType");
  const eventType = (["dinner", "experience", "session", "gathering", "wellness"].includes(typeRaw)
    ? typeRaw
    : "gathering") as EventType;
  const statusRaw = str(formData, "status");
  const status = (["draft", "published", "cancelled"].includes(statusRaw)
    ? statusRaw
    : "draft") as EventStatus;
  const capacity = parseInt(str(formData, "capacity"), 10);

  const payload = {
    title,
    description: str(formData, "description") || null,
    event_type: eventType,
    status,
    start_at: startAt,
    end_at: endAt,
    capacity: Number.isFinite(capacity) && capacity > 0 ? capacity : null,
    villa_id: str(formData, "villaId") || null,
    location_note: str(formData, "locationNote") || null,
    image: str(formData, "image") || null,
  };

  let eventId = id;
  try {
    if (isNew) {
      const { data, error } = await db()
        .from("events")
        .insert({ ...payload, slug: slugify(title), created_by: admin.id })
        .select("id")
        .single();
      if (error || !data) throw new Error(error?.message || "Create failed");
      eventId = data.id;
    } else {
      const { error } = await db().from("events").update(payload).eq("id", id);
      if (error) throw new Error(error.message);
    }

    await writeAudit({
      actorId: admin.id,
      actorEmail: admin.email,
      action: isNew ? "event.create" : "event.update",
      entityType: "event",
      entityId: eventId,
      summary: `Event "${title}" ${isNew ? "created" : "updated"} (${status})`,
    });
  } catch (err) {
    backTo(backPath, err instanceof Error ? err.message : "Save failed");
  }
  revalidatePath("/events");
  revalidatePath(`/events/${eventId}`);
  backTo(`/events/${eventId}`);
}

export async function deleteEventAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = str(formData, "id");

  try {
    await db().from("event_rsvps").delete().eq("event_id", id);
    const { error } = await db().from("events").delete().eq("id", id);
    if (error) throw new Error(error.message);
    await writeAudit({
      actorId: admin.id,
      actorEmail: admin.email,
      action: "event.delete",
      entityType: "event",
      entityId: id,
      summary: "Event deleted",
    });
  } catch (err) {
    backTo(`/events/${id}`, err instanceof Error ? err.message : "Delete failed");
  }
  revalidatePath("/events");
  backTo("/events");
}

// ---------------------------------------------------------------- Content blocks

export async function saveContentBlockAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = str(formData, "id");
  const key = str(formData, "key");
  const body = str(formData, "body");

  try {
    if (id) {
      const { error } = await db()
        .from("content_blocks")
        .update({ title: str(formData, "title"), body_md: body, updated_by: admin.id })
        .eq("id", id);
      if (error) throw new Error(error.message);
    } else {
      if (!key) backTo("/content", "Give the block a key");
      const { error } = await db().from("content_blocks").insert({
        key: key.toLowerCase(),
        title: str(formData, "title") || key,
        body_md: body,
        updated_by: admin.id,
      });
      if (error) throw new Error(error.message);
    }
  } catch (err) {
    backTo("/content", err instanceof Error ? err.message : "Save failed");
  }
  revalidatePath("/content");
  backTo("/content");
}
