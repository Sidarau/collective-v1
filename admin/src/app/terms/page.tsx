import type { Metadata } from "next";
import { config } from "@core/config";
import { PublicPolicyPage, PolicySection } from "@/components/PublicPolicyPage";

export const metadata: Metadata = {
  title: "Terms — Open Collective Operator",
  description: "Terms for Open Collective Operator.",
  robots: { index: true, follow: true },
};

export default function TermsPage() {
  const email = config.supportEmail;
  return (
    <PublicPolicyPage eyebrow="Terms" title="Operator terms of service" updated="26 July 2026">
      <PolicySection title="The service">
        <p>
          Open Collective Operator is a private operational workspace for authorized founders,
          administrators, and agents. It supports scheduling, applications, communications,
          knowledge, CRM, and related Collective operations.
        </p>
      </PolicySection>

      <PolicySection title="Authorized use">
        <p>
          Access is personal and non-transferable. Users must protect their credentials, connect
          only accounts they are authorized to control, and use calendar and business data only
          for legitimate Collective operations. Automated agents remain limited by their assigned
          permissions and approval rules.
        </p>
      </PolicySection>

      <PolicySection title="Connected services">
        <p>
          Google Calendar and other connected services remain governed by their own terms. You may
          revoke a Google connection at any time. Open Collective is not responsible for outages or
          changes made by a third-party provider, but will make reasonable efforts to preserve
          accurate synchronized state.
        </p>
      </PolicySection>

      <PolicySection title="Availability and changes">
        <p>
          The operator platform is provided while the Collective is actively developing its
          operations. Features may change, and access may be suspended to protect users, data, or
          the service. Mandatory consumer and data-protection rights are not limited by these
          terms.
        </p>
      </PolicySection>

      <PolicySection title="Contact and governing law">
        <p>
          These terms are governed by Spanish law, subject to mandatory rights in a user&apos;s
          country of residence. Questions and notices may be sent to{" "}
          <a className="text-gold hover:underline" href={`mailto:${email}`}>
            {email}
          </a>
          .
        </p>
      </PolicySection>
    </PublicPolicyPage>
  );
}
