import { MobileShell } from "@/components/shell/MobileShell";
import { getProvider, parseScenario } from "@/data/provider";
import { requireOperator } from "@/lib/guard";
import { scenarioAllowed } from "@/lib/page-params";
import { parseTodayFilter } from "@/lib/routes";
import type { NumbersOfTheDay, NumbersPeriod } from "@/data/contracts";
import { TodayClient } from "./TodayClient";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function TodayPage({ searchParams }: { searchParams: SearchParams }) {
  await requireOperator();
  const sp = await searchParams;
  const scenario = parseScenario(sp.scenario);
  const filter = parseTodayFilter(sp.filter);
  const provider = getProvider(scenario);

  // The fixture timeline is anchored to a fixed instant so screenshots are
  // deterministic; the live stream anchors to the actual present.
  const nowIso =
    scenarioAllowed() && scenario !== "healthy"
      ? (await import("@/data/fixtures")).FIXTURE_NOW
      : new Date().toISOString();

  const [summary, timeline, today, sevenDay, thirtyDay] = await Promise.all([
    provider.getDaySummary(),
    provider.getTimeline({ category: filter, direction: "around" }),
    provider.getNumbers("today"),
    provider.getNumbers("7d"),
    provider.getNumbers("30d"),
  ]);

  const fallback = (r: typeof today, period: NumbersPeriod): NumbersOfTheDay =>
    r.status === "ok" ? r.data : { period, asOf: nowIso, metrics: [] };

  const numbers: Record<NumbersPeriod, NumbersOfTheDay> = {
    today: fallback(today, "today"),
    "7d": fallback(sevenDay, "7d"),
    "30d": fallback(thirtyDay, "30d"),
  };

  return (
    <MobileShell showAdd hero filter={filter}>
      <TodayClient
        summary={summary}
        numbers={numbers}
        timeline={timeline}
        filter={filter}
        nowIso={nowIso}
      />
    </MobileShell>
  );
}
