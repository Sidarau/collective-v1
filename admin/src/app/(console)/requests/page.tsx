import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import StatusChip from "@/components/StatusChip";
import { listRequests } from "@/lib/admin-data";
import { fmtDate, fmtMoney } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function RequestsPage() {
  const requests = await listRequests();

  return (
    <>
      <PageHeader title="Stay requests" eyebrow="Gate operations" />
      <section className="panel overflow-hidden">
        <table className="table">
          <thead>
            <tr>
              <th>Guest</th>
              <th>Gate / room</th>
              <th>Window</th>
              <th>Status</th>
              <th>Companion</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((request) => (
              <tr key={request.id}>
                <td>
                  <Link href={`/requests/${request.id}`} className="font-medium text-ink hover:text-gold">
                    {request.lead
                      ? `${request.lead.first_name} ${request.lead.last_name}`.trim()
                      : request.user?.email || "Unknown"}
                  </Link>
                  <p className="text-xs text-muted">{request.lead?.email || request.user?.email}</p>
                </td>
                <td>
                  <p>{request.gate?.name || "Gate"}</p>
                  <p className="text-xs text-muted">{request.room?.name || "Room"}</p>
                </td>
                <td>
                  {fmtDate(request.check_in)} - {fmtDate(request.check_out)}
                </td>
                <td>
                  <StatusChip value={request.status} />
                </td>
                <td>{request.companion_name || "-"}</td>
                <td>{fmtMoney(request.total_price, request.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
