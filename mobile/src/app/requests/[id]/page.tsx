import { notFound } from "next/navigation";
import { requireOperator } from "@/lib/guard";
import { MobileShell } from "@/components/shell/MobileShell";
import { getProvider, parseScenario } from "@/data/provider";
import type { DetailPageArgs } from "@/lib/page-params";
import { RequestDetailClient } from "./RequestDetailClient";

export const dynamic = "force-dynamic";

export default async function RequestDetailPage({ params, searchParams }: DetailPageArgs) {
  await requireOperator();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const provider = getProvider(parseScenario(sp.scenario));
  const result = await provider.getRequest(id);

  if (result.status === "empty") notFound();

  return (
    <MobileShell>
      {result.status === "ok" ? (
        <RequestDetailClient request={result.data} />
      ) : (
        <p className="empty-state__body">This request could not be loaded.</p>
      )}
    </MobileShell>
  );
}
