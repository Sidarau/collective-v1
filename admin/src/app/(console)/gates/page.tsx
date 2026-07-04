import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import StatusChip from "@/components/StatusChip";
import ErrorBanner from "@/components/ErrorBanner";
import { listGates } from "@/lib/admin-data";
import { createGateAction } from "@/lib/content-actions";
import { fmtMoney } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function GatesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const gates = await listGates();

  return (
    <>
      <PageHeader title="Gates and rooms" eyebrow="Inventory" />
      <ErrorBanner error={error} />

      <section className="panel p-5">
        <p className="label">Open a new gate</p>
        <form action={createGateAction} className="flex items-end gap-3">
          <div className="flex-1">
            <label className="label">Name</label>
            <input name="name" required className="input" placeholder="Villa name" />
          </div>
          <div className="flex-1">
            <label className="label">Location</label>
            <input name="location" className="input" placeholder="Ibiza, Spain" />
          </div>
          <button type="submit" className="btn btn-gold">
            Create — starts as coming soon
          </button>
        </form>
      </section>

      <div className="mt-5 grid gap-4">
        {gates.map((gate) => (
          <section key={gate.id} className="panel p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Link href={`/gates/${gate.id}`} className="text-lg font-semibold text-ink hover:text-gold">
                  {gate.name}
                </Link>
                <p className="text-sm text-muted">
                  {gate.location}
                  {gate.tagline ? ` — ${gate.tagline}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StatusChip value={gate.status} />
                <Link href={`/gates/${gate.id}`} className="btn btn-gold">
                  Edit gate & rooms
                </Link>
              </div>
            </div>
            <table className="table mt-4">
              <thead>
                <tr>
                  <th>Room</th>
                  <th>Type</th>
                  <th>Capacity</th>
                  <th>Base price</th>
                  <th>Photos</th>
                </tr>
              </thead>
              <tbody>
                {gate.rooms.map((room) => (
                  <tr key={room.id}>
                    <td>{room.name}</td>
                    <td>{room.room_type}</td>
                    <td>{room.max_guests}</td>
                    <td>{fmtMoney(room.base_price_per_night, room.currency)}</td>
                    <td>{room.images.length || "—"}</td>
                  </tr>
                ))}
                {gate.rooms.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-muted">
                      No rooms yet — add them in the editor.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        ))}
      </div>
    </>
  );
}
