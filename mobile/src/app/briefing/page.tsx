import { MobileShell } from "@/components/shell/MobileShell";
import { getProvider, parseScenario } from "@/data/provider";
import type { PageArgs } from "@/lib/page-params";
import { BriefingClient } from "./BriefingClient";

export const dynamic = "force-dynamic";

export default async function BriefingPage({ searchParams }: PageArgs) {
  const sp = await searchParams;
  const provider = getProvider(parseScenario(sp.scenario));

  const [today, sevenDay, thirtyDay, fToday, f7, f30, requests] = await Promise.all([
    provider.getNumbers("today"),
    provider.getNumbers("7d"),
    provider.getNumbers("30d"),
    provider.getForecast("today"),
    provider.getForecast("7d"),
    provider.getForecast("30d"),
    provider.listRequests(),
  ]);

  return (
    <MobileShell>
      <BriefingClient
        numbers={{ today, "7d": sevenDay, "30d": thirtyDay }}
        forecasts={{ today: fToday, "7d": f7, "30d": f30 }}
        requests={requests}
      />
    </MobileShell>
  );
}
