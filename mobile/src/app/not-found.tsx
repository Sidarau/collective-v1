import Link from "next/link";
import { MobileShell, PageTitle } from "@/components/shell/MobileShell";
import { EmptyState } from "@/components/ui/primitives";

export default function NotFound() {
  return (
    <MobileShell>
      <PageTitle title="Not found" />
      <EmptyState
        title="That record no longer exists"
        body="It may have been resolved, rescheduled or removed."
        action={
          <Link href="/" className="btn btn--primary" style={{ marginTop: 12 }}>
            Back to Today
          </Link>
        }
      />
    </MobileShell>
  );
}
