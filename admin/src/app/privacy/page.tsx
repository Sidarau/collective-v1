import type { Metadata } from "next";
import { config } from "@core/config";
import { PublicPolicyPage, PolicySection } from "@/components/PublicPolicyPage";

export const metadata: Metadata = {
  title: "Privacy — Open Collective Operator",
  description: "Privacy notice for Open Collective Operator and its Google Calendar integration.",
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  const email = config.supportEmail;
  return (
    <PublicPolicyPage eyebrow="Privacy" title="Privacy notice" updated="26 July 2026">
      <PolicySection title="Who controls the data">
        <p>
          Open Collective, operated from Ibiza, Spain, controls personal data processed through
          Open Collective Operator. For privacy requests, contact{" "}
          <a className="text-gold hover:underline" href={`mailto:${email}`}>
            {email}
          </a>
          .
        </p>
      </PolicySection>

      <PolicySection title="Google data we access">
        <p>
          When an operator connects Google Calendar, we receive their Google account email,
          calendar-list metadata, event details for calendars they approve, and free/busy
          information. We also receive an OAuth refresh token so the requested two-way sync can
          continue without asking the operator to sign in every day.
        </p>
      </PolicySection>

      <PolicySection title="How Google data is used">
        <p>
          Google data is used only to prevent scheduling conflicts, synchronize approved
          Collective appointments, display a private operator agenda, and prepare authorized daily
          schedule updates. We do not use Google data for advertising, sell it, or use it to train
          general-purpose AI models.
        </p>
      </PolicySection>

      <PolicySection title="Storage, sharing, and security">
        <p>
          Refresh tokens are encrypted at rest. Access is limited to authenticated operators,
          explicitly granted agents, and service providers required to operate the integration,
          including Vercel, Supabase, and Google. Sensitive calendar writes require attributable
          owner approval. We do not transfer Google user data to data brokers or advertising
          platforms.
        </p>
      </PolicySection>

      <PolicySection title="Retention and deletion">
        <p>
          Calendar authorization and synchronized metadata are kept while the connection is active.
          An authorized operator can disconnect from Operator OS at any time, which removes the
          stored authorization and connection metadata. Existing events already written to Google
          Calendar remain in Google unless the operator deletes them there. You may also request
          deletion by emailing{" "}
          <a className="text-gold hover:underline" href={`mailto:${email}`}>
            {email}
          </a>
          .
        </p>
      </PolicySection>

      <PolicySection title="Google API Limited Use">
        <p>
          Open Collective Operator&apos;s use and transfer of information received from Google
          APIs adheres to the Google API Services User Data Policy, including the Limited Use
          requirements.
        </p>
      </PolicySection>

      <PolicySection title="Your rights">
        <p>
          Depending on where you live, you may request access, correction, deletion, restriction,
          objection, or portability of your personal data. We verify the request against the
          account details we hold and respond within the period required by applicable law.
        </p>
      </PolicySection>
    </PublicPolicyPage>
  );
}
