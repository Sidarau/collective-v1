import Link from "next/link";
import { config } from "@core/config";

export const dynamic = "force-dynamic";

export default function PrivacyPage() {
  return (
    <main className="min-h-dvh bg-base px-5 py-12">
      <article className="mx-auto max-w-2xl">
        <Link href="/" className="wordmark text-sm text-ink">
          Collective
        </Link>
        <div className="glass mt-10 p-6 sm:p-8">
          <p className="eyebrow">Privacy</p>
          <h1 className="display mt-3 text-[34px] leading-tight text-ink">Privacy and GDPR notice</h1>
          <p className="muted mt-3 text-[13px]">Last updated 8 July 2026.</p>

          <div className="mt-8 space-y-6 text-[14px] leading-relaxed text-ink/82">
            <section>
              <h2 className="eyebrow mb-2">Who controls the data</h2>
              <p>
                Collective uses the information you submit to manage applications, guest-list
                RSVPs, member onboarding, stays, events, communications, and operator follow-up.
                For privacy questions, contact{" "}
                <a className="text-champagne hover:underline" href={`mailto:${config.supportEmail}`}>
                  {config.supportEmail}
                </a>
                .
              </p>
            </section>

            <section>
              <h2 className="eyebrow mb-2">What we collect</h2>
              <p>
                Depending on the flow, we collect name, email, phone or WhatsApp, optional
                Instagram/social links, application answers, profile copy, RSVP notes,
                dietary or allergy notes, stay-window details, internal admin notes, and message
                delivery logs. Passwords are stored only as hashes.
              </p>
            </section>

            <section>
              <h2 className="eyebrow mb-2">Why we use it</h2>
              <p>
                We use data to provide requested services, assess and operate membership,
                coordinate events and villa stays, protect the house and members, respond to
                requests, keep operational records, and send relevant service communications.
                Public-event RSVP consent is recorded with the RSVP.
              </p>
            </section>

            <section>
              <h2 className="eyebrow mb-2">Who can see it</h2>
              <p>
                Operators can see operational records. Members can see member-visible profile
                copy after onboarding. Guest RSVPs and private contact details are not shown in
                the member directory. We may use service providers for hosting, email, auth,
                database, analytics, or CRM operations under appropriate safeguards.
              </p>
            </section>

            <section>
              <h2 className="eyebrow mb-2">Retention</h2>
              <p>
                We keep records for as long as needed to operate the Collective, handle legal or
                accounting obligations, resolve disputes, maintain safety records, and preserve
                membership context. You can ask us to review, correct, export, restrict, or delete
                your personal data where applicable.
              </p>
            </section>

            <section>
              <h2 className="eyebrow mb-2">Your rights</h2>
              <p>
                If GDPR or similar data-protection law applies, you may have rights to access,
                rectification, erasure, restriction, portability, objection, and withdrawal of
                consent where processing relies on consent. You may also lodge a complaint with
                a relevant data-protection authority.
              </p>
            </section>

            <section>
              <h2 className="eyebrow mb-2">Security</h2>
              <p>
                We use authenticated operator access, server-side validation, password hashing,
                logged email delivery, and private admin tools. No online system is risk-free,
                so sensitive operational access should stay limited to trusted admins.
              </p>
            </section>

            <section>
              <h2 className="eyebrow mb-2">Contact</h2>
              <p>
                For privacy questions or to exercise your rights, write to{" "}
                <a className="text-champagne hover:underline" href="mailto:collective@opencollective.app">
                  collective@opencollective.app
                </a>
                .
              </p>
            </section>
          </div>
        </div>
      </article>
    </main>
  );
}
