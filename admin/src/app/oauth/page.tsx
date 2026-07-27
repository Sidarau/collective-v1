import type { Metadata } from "next";
import Link from "next/link";
import { PublicPolicyPage, PolicySection } from "@/components/PublicPolicyPage";

export const metadata: Metadata = {
  title: "Google Calendar Integration — Open Collective",
  description: "How Open Collective connects approved operator calendars.",
  robots: { index: true, follow: true },
};

export default function OAuthInformationPage() {
  return (
    <PublicPolicyPage
      eyebrow="Google Calendar integration"
      title="Your schedule, connected with your permission"
      updated="26 July 2026"
    >
      <p>
        Open Collective Operator connects Google Calendar for authorized founders and operators.
        The connection keeps Collective screening calls, interviews, and operational appointments
        coordinated without double-booking.
      </p>

      <PolicySection title="What the integration does">
        <p>
          After you choose a Google account and approve access, Open Collective can read free/busy
          information and the calendars you explicitly select. It can create and update operational
          events on those approved calendars. Collecta may include approved schedule information in
          your private daily brief.
        </p>
      </PolicySection>

      <PolicySection title="You remain in control">
        <p>
          Sensitive changes require attributable owner approval. You can choose which calendars
          participate, reconnect the account, or disconnect it at any time. Disconnecting removes
          the stored Google authorization and synced metadata from Open Collective; it does not
          delete your Google calendars or existing Google events.
        </p>
      </PolicySection>

      <PolicySection title="How to connect">
        <p>
          An Open Collective administrator prepares a private, one-time setup link for the intended
          operator. The operator opens that link, chooses their own Google account, reviews the
          requested permissions, and presses Allow.
        </p>
        <Link href="/login" className="btn btn-gold">
          Open Operator OS
        </Link>
      </PolicySection>
    </PublicPolicyPage>
  );
}
