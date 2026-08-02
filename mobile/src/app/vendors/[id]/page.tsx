import { notFound } from "next/navigation";
import { requireOperator } from "@/lib/guard";
import { MobileShell } from "@/components/shell/MobileShell";
import { getProvider, parseScenario } from "@/data/provider";
import type { DetailPageArgs } from "@/lib/page-params";
import { formatMoney } from "@/lib/money";
import {
  ActivityTimeline,
  RecordDetailScreen,
  Section,
} from "@/components/templates/templates";
import { PrimaryButton, SecondaryButton } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

export default async function VendorDetailPage({ params, searchParams }: DetailPageArgs) {
  await requireOperator();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const result = await getProvider(parseScenario(sp.scenario)).getVendor(id);

  if (result.status === "empty") notFound();
  if (result.status !== "ok") {
    return (
      <MobileShell>
        <p className="empty-state__body">This partner could not be loaded.</p>
      </MobileShell>
    );
  }

  const vendor = result.data;

  return (
    <MobileShell>
      <RecordDetailScreen
        title={vendor.name}
        subtitle={`${vendor.contactLabel} · ${vendor.category}`}
        backHref="/vendors"
        state={vendor.state}
        facts={[
          { icon: "wrench", label: "Active jobs", value: String(vendor.activeJobs) },
          {
            icon: "euro",
            label: "Outstanding",
            value: formatMoney(vendor.outstandingMinor, vendor.currency),
          },
          { icon: "person", label: "Type", value: vendor.category },
          { icon: "info", label: "State", value: vendor.state.label },
        ]}
        primaryAction={
          <PrimaryButton block data-testid="primary-action">
            Assign work
          </PrimaryButton>
        }
        secondaryActions={
          <>
            <SecondaryButton style={{ flex: 1 }}>Message</SecondaryButton>
            <SecondaryButton style={{ flex: 1 }}>View invoices</SecondaryButton>
          </>
        }
      >
        <Section title="Jobs and invoices">
          <ActivityTimeline entries={vendor.jobs} />
        </Section>
      </RecordDetailScreen>
    </MobileShell>
  );
}
