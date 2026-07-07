import { notFound } from "next/navigation";
import { fetchGateBySlug } from "@/lib/data";
import RequestFlow from "./RequestFlow";

export const dynamic = "force-dynamic";

/**
 * Unified request-to-attend flow: pick dates -> see only available rooms ->
 * add one companion -> send. Entered from the gate page, a room card
 * (?room=slug), or the calendar (?from&to).
 */
export default async function RequestPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ from?: string; to?: string; room?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const gate = await fetchGateBySlug(slug);
  if (!gate || gate.status !== "published") notFound();

  return (
    <RequestFlow
      gate={{ name: gate.name, slug: gate.slug, location: gate.location }}
      initialFrom={sp.from || null}
      initialTo={sp.to || null}
      preferredRoom={sp.room || null}
    />
  );
}
