import { notFound } from "next/navigation";
import { MobileShell } from "@/components/shell/MobileShell";
import { getProvider, parseScenario } from "@/data/provider";
import type { DetailPageArgs } from "@/lib/page-params";
import { SpaceDetailClient } from "./SpaceDetailClient";

export const dynamic = "force-dynamic";

export default async function SpaceDetailPage({ params, searchParams }: DetailPageArgs) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const result = await getProvider(parseScenario(sp.scenario)).getSpace(id);

  if (result.status === "empty") notFound();

  return (
    <MobileShell showAdd>
      {result.status === "ok" ? (
        <SpaceDetailClient space={result.data} />
      ) : (
        <p className="empty-state__body">This Space could not be loaded.</p>
      )}
    </MobileShell>
  );
}
