import { MobileShell } from "@/components/shell/MobileShell";
import { getProvider, parseScenario } from "@/data/provider";
import { first, type PageArgs } from "@/lib/page-params";
import { DuesClient } from "./DuesClient";

export const dynamic = "force-dynamic";

export default async function DuesPage({ searchParams }: PageArgs) {
  const sp = await searchParams;
  const provider = getProvider(parseScenario(sp.scenario));

  const [transactions, fToday, f7, f30, nToday, n7, n30] = await Promise.all([
    provider.listTransactions(first(sp.filter)),
    provider.getForecast("today"),
    provider.getForecast("7d"),
    provider.getForecast("30d"),
    provider.getNumbers("today"),
    provider.getNumbers("7d"),
    provider.getNumbers("30d"),
  ]);

  return (
    <MobileShell showAdd filter="dues">
      <DuesClient
        transactions={transactions}
        forecasts={{ today: fToday, "7d": f7, "30d": f30 }}
        numbers={{ today: nToday, "7d": n7, "30d": n30 }}
      />
    </MobileShell>
  );
}
