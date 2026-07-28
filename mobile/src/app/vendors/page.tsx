import { MobileShell, PageTitle } from "@/components/shell/MobileShell";
import { requireOperator } from "@/lib/guard";
import { getProvider, parseScenario } from "@/data/provider";
import type { PageArgs } from "@/lib/page-params";
import { ResultBoundary } from "@/components/templates/ResultBoundary";
import { VendorRow } from "@/components/rows/rows";

export const dynamic = "force-dynamic";

export default async function VendorsPage({ searchParams }: PageArgs) {
  await requireOperator();
  const sp = await searchParams;
  const vendors = await getProvider(parseScenario(sp.scenario)).listVendors();

  const rows = vendors.status === "ok" ? vendors.data : [];
  const activeJobs = rows.reduce((n, v) => n + v.activeJobs, 0);

  return (
    <MobileShell>
      <PageTitle
        title="Partners & crew"
        subtitle={rows.length ? `${activeJobs} active jobs` : undefined}
        backHref="/more"
      />

      <div style={{ marginTop: 12 }}>
        <ResultBoundary
          result={vendors}
          emptyTitle="No partners yet"
          emptyBody="Supply and upkeep partners appear here once they take on work."
        >
          {(items) => (
            <ul className="list">
              {items.map((v) => (
                <VendorRow key={v.id} vendor={v} />
              ))}
            </ul>
          )}
        </ResultBoundary>
      </div>
    </MobileShell>
  );
}
