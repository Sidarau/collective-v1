import { MobileShell } from "@/components/shell/MobileShell";
import { getProvider, parseScenario } from "@/data/provider";
import type { PageArgs } from "@/lib/page-params";
import { SpacesClient } from "./SpacesClient";

export const dynamic = "force-dynamic";

export default async function SpacesPage({ searchParams }: PageArgs) {
  const sp = await searchParams;
  const spaces = await getProvider(parseScenario(sp.scenario)).listSpaces();

  return (
    <MobileShell>
      <SpacesClient spaces={spaces} />
    </MobileShell>
  );
}
