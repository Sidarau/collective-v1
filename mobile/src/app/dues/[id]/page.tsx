import { notFound } from "next/navigation";
import { requireOperator } from "@/lib/guard";
import { MobileShell } from "@/components/shell/MobileShell";
import { getProvider, parseScenario } from "@/data/provider";
import type { DetailPageArgs } from "@/lib/page-params";
import { TransactionDetailClient } from "./TransactionDetailClient";

export const dynamic = "force-dynamic";

export default async function TransactionDetailPage({ params, searchParams }: DetailPageArgs) {
  await requireOperator();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const result = await getProvider(parseScenario(sp.scenario)).getTransaction(id);

  if (result.status === "empty") notFound();

  return (
    <MobileShell>
      {result.status === "ok" ? (
        <TransactionDetailClient transaction={result.data} />
      ) : (
        <p className="empty-state__body">This transaction could not be loaded.</p>
      )}
    </MobileShell>
  );
}
