import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import StatusChip from "@/components/StatusChip";
import ErrorBanner from "@/components/ErrorBanner";
import ImagesField from "@/components/ImagesField";
import { getSupabaseAdmin } from "@core/supabase";
import type { RoomRow, VillaRow } from "@core/database.types";
import { createRoomAction, deleteRoomAction, saveGateAction, saveRoomAction } from "@/lib/content-actions";

export const dynamic = "force-dynamic";

export default async function GateEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const supabase = getSupabaseAdmin();
  const [{ data: gate }, { data: rooms }] = await Promise.all([
    supabase.from("villas").select("*").eq("id", id).maybeSingle(),
    supabase.from("rooms").select("*").eq("villa_id", id).order("name"),
  ]);
  if (!gate) notFound();
  const villa = gate as VillaRow;
  const roomRows = (rooms as RoomRow[]) || [];

  return (
    <>
      <Link href="/gates" className="mb-2 inline-block text-[12px] text-muted hover:text-ink">
        ← Gates and rooms
      </Link>
      <PageHeader title={villa.name} eyebrow="Gate editor">
        <StatusChip value={villa.status} />
      </PageHeader>
      <ErrorBanner error={error} />

      {/* Gate */}
      <section className="panel p-5">
        <p className="label">Gate</p>
        <form action={saveGateAction} className="space-y-4">
          <input type="hidden" name="id" value={villa.id} />
          <div className="grid grid-cols-4 gap-3">
            <div className="col-span-2">
              <label className="label">Name</label>
              <input name="name" required defaultValue={villa.name} className="input" />
            </div>
            <div>
              <label className="label">Status</label>
              <select name="status" defaultValue={villa.status} className="input">
                <option value="published">Published — live for members</option>
                <option value="coming_soon">Coming soon — blurred teaser</option>
                <option value="archived">Archived — hidden</option>
              </select>
            </div>
            <div>
              <label className="label">Sort order</label>
              <input name="sortOrder" type="number" defaultValue={villa.sort_order} className="input" />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div className="col-span-2">
              <label className="label">Location</label>
              <input name="location" defaultValue={villa.location} className="input" />
            </div>
            <div>
              <label className="label">Region</label>
              <input name="region" defaultValue={villa.region || ""} className="input" placeholder="Balearics" />
            </div>
            <div>
              <label className="label">Max guests</label>
              <input name="maxGuests" type="number" defaultValue={villa.max_guests} className="input" />
            </div>
          </div>
          <div>
            <label className="label">Tagline</label>
            <input
              name="tagline"
              defaultValue={villa.tagline || ""}
              className="input"
              placeholder="One line under the name"
            />
          </div>
          <div>
            <label className="label">Description (short)</label>
            <textarea name="description" defaultValue={villa.description || ""} className="input" rows={2} />
          </div>
          <div>
            <label className="label">Story (long — gate detail page)</label>
            <textarea name="story" defaultValue={villa.story || ""} className="input" rows={5} />
          </div>
          <div>
            <label className="label">Amenities (comma-separated)</label>
            <input name="amenities" defaultValue={villa.amenities.join(", ")} className="input" />
          </div>
          <ImagesField name="heroImage" initial={villa.hero_image ? [villa.hero_image] : []} single label="Hero photo" />
          <ImagesField name="images" initial={villa.images} label="Gallery" />
          <button type="submit" className="btn btn-gold">
            Save gate
          </button>
        </form>
      </section>

      {/* Rooms */}
      <div className="mt-6 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink">Rooms ({roomRows.length})</h3>
        <form action={createRoomAction} className="flex items-center gap-2">
          <input type="hidden" name="gateId" value={villa.id} />
          <input name="name" required className="input w-56" placeholder="New room name" />
          <button type="submit" className="btn">
            Add room
          </button>
        </form>
      </div>

      <div className="mt-3 grid gap-4">
        {roomRows.map((room) => (
          <section key={room.id} className="panel p-5">
            <form action={saveRoomAction} className="space-y-4">
              <input type="hidden" name="id" value={room.id} />
              <input type="hidden" name="gateId" value={villa.id} />
              <div className="grid grid-cols-5 gap-3">
                <div className="col-span-2">
                  <label className="label">Name</label>
                  <input name="name" required defaultValue={room.name} className="input" />
                </div>
                <div>
                  <label className="label">Type</label>
                  <select name="roomType" defaultValue={room.room_type} className="input">
                    <option value="master">Master</option>
                    <option value="suite">Suite</option>
                    <option value="double">Double</option>
                    <option value="single">Single / twin</option>
                  </select>
                </div>
                <div>
                  <label className="label">Bed</label>
                  <input name="bedType" defaultValue={room.bed_type || ""} className="input" placeholder="King" />
                </div>
                <div>
                  <label className="label">Guests</label>
                  <input name="maxGuests" type="number" defaultValue={room.max_guests} className="input" />
                </div>
              </div>
              <div className="grid grid-cols-5 gap-3">
                <div>
                  <label className="label">Price / night (€)</label>
                  <input
                    name="price"
                    type="number"
                    step="1"
                    defaultValue={Math.round(room.base_price_per_night / 100)}
                    className="input"
                  />
                </div>
                <div className="col-span-4">
                  <label className="label">Amenities (comma-separated)</label>
                  <input name="amenities" defaultValue={room.amenities.join(", ")} className="input" />
                </div>
              </div>
              <div>
                <label className="label">Description</label>
                <textarea name="description" defaultValue={room.description || ""} className="input" rows={2} />
              </div>
              <ImagesField name="images" initial={room.images} label="Photos" />
              <div className="flex items-center justify-between">
                <button type="submit" className="btn btn-gold">
                  Save room
                </button>
              </div>
            </form>
            <form action={deleteRoomAction} className="mt-2 text-right">
              <input type="hidden" name="id" value={room.id} />
              <input type="hidden" name="gateId" value={villa.id} />
              <button type="submit" className="btn btn-red">
                Delete room
              </button>
            </form>
          </section>
        ))}
      </div>
    </>
  );
}
