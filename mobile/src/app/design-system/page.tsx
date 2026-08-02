import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { MobileShell } from "@/components/shell/MobileShell";
import { createFixtureProvider } from "@/data/fixture-provider";
import { FIXTURE_NOW } from "@/data/fixtures";
import type { NumbersOfTheDay, NumbersPeriod } from "@/data/contracts";
import { GalleryClient } from "./GalleryClient";

export const dynamic = "force-dynamic";

/** A design route, never indexed and never linked from the bottom rail. */
export const metadata: Metadata = {
  title: "Design system — Open Collective",
  robots: { index: false, follow: false },
};

export default async function DesignSystemPage() {
  const provider = createFixtureProvider();

  const [summary, timeline, nToday, n7, n30, forecast, request, person, space, transaction, experience] =
    await Promise.all([
      provider.getDaySummary(),
      provider.getTimeline({ category: "all" }),
      provider.getNumbers("today"),
      provider.getNumbers("7d"),
      provider.getNumbers("30d"),
      provider.getForecast("30d"),
      provider.getRequest("req-301"),
      provider.getPerson("person-ana-martins"),
      provider.getSpace("space-roca-llisa"),
      provider.getTransaction("tx-460"),
      provider.getExperience("exp-501"),
    ]);

  // The gallery is fixture-only; if any of it is missing the route is broken.
  if (
    summary.status !== "ok" ||
    timeline.status !== "ok" ||
    nToday.status !== "ok" ||
    n7.status !== "ok" ||
    n30.status !== "ok" ||
    forecast.status !== "ok" ||
    request.status !== "ok" ||
    person.status !== "ok" ||
    space.status !== "ok" ||
    transaction.status !== "ok" ||
    experience.status !== "ok"
  ) {
    notFound();
  }

  const numbers: Record<NumbersPeriod, NumbersOfTheDay> = {
    today: nToday.data,
    "7d": n7.data,
    "30d": n30.data,
  };

  return (
    <MobileShell>
      <GalleryClient
        summary={summary.data}
        numbers={numbers}
        forecast={forecast.data}
        events={timeline.data.events}
        request={request.data}
        person={person.data}
        space={space.data}
        transaction={transaction.data}
        experience={experience.data}
        nowIso={FIXTURE_NOW}
      />
    </MobileShell>
  );
}
