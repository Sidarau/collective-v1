import { MobileShell } from "@/components/shell/MobileShell";
import { requireOperator } from "@/lib/guard";
import { getProvider, parseScenario } from "@/data/provider";
import { first, type PageArgs } from "@/lib/page-params";
import { PeopleClient } from "./PeopleClient";

export const dynamic = "force-dynamic";

export default async function PeoplePage({ searchParams }: PageArgs) {
  await requireOperator();
  const sp = await searchParams;
  const people = await getProvider(parseScenario(sp.scenario)).listPeople(first(sp.relationship));

  return (
    <MobileShell>
      <PeopleClient people={people} />
    </MobileShell>
  );
}
