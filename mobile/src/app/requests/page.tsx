import { MobileShell } from "@/components/shell/MobileShell";
import { getProvider, parseScenario } from "@/data/provider";
import { first, type PageArgs } from "@/lib/page-params";
import { RequestsClient } from "./RequestsClient";

export const dynamic = "force-dynamic";

export default async function RequestsPage({ searchParams }: PageArgs) {
  const sp = await searchParams;
  const provider = getProvider(parseScenario(sp.scenario));
  const requests = await provider.listRequests(first(sp.filter));

  return (
    <MobileShell>
      <RequestsClient requests={requests} />
    </MobileShell>
  );
}
