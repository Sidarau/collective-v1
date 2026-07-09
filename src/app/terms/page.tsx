import Link from "next/link";
import { config } from "@core/config";

export const dynamic = "force-dynamic";

export default function TermsPage() {
  return (
    <main className="min-h-dvh bg-base px-5 py-12">
      <article className="mx-auto max-w-2xl">
        <Link href="/" className="wordmark text-sm text-ink">
          Collective
        </Link>
        <div className="glass mt-10 p-6 sm:p-8">
          <p className="eyebrow">Terms</p>
          <h1 className="display mt-3 text-[34px] leading-tight text-ink">Terms and conditions</h1>
          <p className="muted mt-3 text-[13px]">Last updated 8 July 2026.</p>

          <div className="mt-8 space-y-6 text-[14px] leading-relaxed text-ink/82">
            <section>
              <h2 className="eyebrow mb-2">Private access</h2>
              <p>
                Collective is a private membership and guest-list experience. Access to member
                areas, villa stays, events, and partner experiences may be accepted, declined,
                waitlisted, changed, or cancelled by the operator.
              </p>
            </section>

            <section>
              <h2 className="eyebrow mb-2">Events and stays</h2>
              <p>
                Event RSVPs and stay requests are requests until confirmed by the operator.
                Guests must provide accurate contact details and follow house, safety, payment,
                cancellation, and conduct instructions shared for a specific event or stay.
              </p>
            </section>

            <section>
              <h2 className="eyebrow mb-2">Conduct</h2>
              <p>
                Members and guests are expected to respect the property, hosts, staff, other
                guests, privacy boundaries, and local laws. We may remove access for unsafe,
                unlawful, abusive, or disruptive behavior.
              </p>
            </section>

            <section>
              <h2 className="eyebrow mb-2">Content and profiles</h2>
              <p>
                You are responsible for the information you submit. Member profile content is
                visible to other members once onboarding is complete. Private contact details
                such as email, password, phone, and WhatsApp are not shown in the member
                directory.
              </p>
            </section>

            <section>
              <h2 className="eyebrow mb-2">No guarantee</h2>
              <p>
                We aim to keep the service available and accurate, but the platform is provided
                as-is while the Collective is being built. Dates, availability, programming, and
                pricing may change.
              </p>
            </section>

            <section>
              <h2 className="eyebrow mb-2">Contact</h2>
              <p>
                Questions about these terms can be sent to{" "}
                <a className="text-champagne hover:underline" href={`mailto:${config.supportEmail}`}>
                  {config.supportEmail}
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
