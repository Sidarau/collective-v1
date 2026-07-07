import PageHeader from "@/components/PageHeader";
import StatusChip from "@/components/StatusChip";
import { listGates } from "@/lib/admin-data";
import { fmtMoney } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function GatesPage() {
  const gates = await listGates();

  return (
    <>
      <PageHeader title="Gates and rooms" eyebrow="Inventory" />
      <div className="grid gap-4">
        {gates.map((gate) => (
          <section key={gate.id} className="panel p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-ink">{gate.name}</h3>
                <p className="text-sm text-muted">{gate.location}</p>
              </div>
              <StatusChip value={gate.status} />
            </div>
            <table className="table mt-4">
              <thead>
                <tr>
                  <th>Room</th>
                  <th>Type</th>
                  <th>Capacity</th>
                  <th>Base price</th>
                </tr>
              </thead>
              <tbody>
                {gate.rooms.map((room) => (
                  <tr key={room.id}>
                    <td>{room.name}</td>
                    <td>{room.room_type}</td>
                    <td>{room.max_guests}</td>
                    <td>{fmtMoney(room.base_price_per_night, room.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
      </div>
    </>
  );
}
