import Link from "next/link";
import { config } from "@core/config";

export const dynamic = "force-dynamic";

function Sec({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="eyebrow mb-2">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export default function TermsPage() {
  const email = config.supportEmail;
  return (
    <main className="min-h-dvh bg-base px-5 py-12">
      <article className="mx-auto max-w-2xl">
        <Link href="/" className="wordmark text-sm text-ink">
          Collective
        </Link>
        <div className="glass mt-10 p-6 sm:p-8">
          <p className="eyebrow">Terms</p>
          <h1 className="display mt-3 text-[34px] leading-tight text-ink">Terms of service</h1>
          <p className="muted mt-3 text-[13px]">Last updated 10 July 2026.</p>

          <div className="mt-8 space-y-6 text-[14px] leading-relaxed text-ink/82">
            <Sec title="1 · About us and these terms">
              <p>
                Open Collective (&ldquo;the Collective&rdquo;, &ldquo;we&rdquo;) is a private
                members network operated from Ibiza, Spain. These terms govern your use of this
                platform and your participation in Collective events, stays, and experiences.
                Formal legal-entity details (company name, registration number, and registered
                address) will be published here upon completion of incorporation; until then,
                all notices can be served at{" "}
                <a className="text-champagne hover:underline" href={`mailto:${email}`}>
                  {email}
                </a>
                . By using the platform you accept these terms.
              </p>
            </Sec>

            <Sec title="2 · Eligibility">
              <p>
                The Collective is for adults. You must be at least 18 years old (or the age of
                majority where you live, if higher) to apply, hold an account, RSVP, or attend.
                By using the platform you confirm you meet this requirement. We may close
                accounts of underage users and delete their data.
              </p>
            </Sec>

            <Sec title="3 · Private access and membership">
              <p>
                Membership is by referral, application, and personal alignment. Access to member
                areas, villa stays, events, and partner experiences may be accepted, declined,
                waitlisted, changed, or cancelled by the operator at its discretion. Membership
                decisions are personal to the founding circle; you may ask for a decision to be
                reconsidered by writing to us, and we will respond within a reasonable time.
              </p>
            </Sec>

            <Sec title="4 · Your account">
              <p>
                Your account is personal and non-transferable. Keep your password and entrance
                links confidential — anything done through your account is treated as done by
                you. Tell us promptly at the address above if you suspect unauthorised access.
                Account sharing is not permitted.
              </p>
            </Sec>

            <Sec title="5 · Events, stays, and bookings">
              <p>
                Event RSVPs, waiting-list entries, and stay requests are <em>requests</em> until
                confirmed by the operator. Confirmations state the applicable practical terms:
                dates, price, deposit, payment method, and any event- or stay-specific rules.
                Guests must provide accurate contact details and follow house, safety, payment,
                cancellation, and conduct instructions shared for a specific event or stay.
              </p>
            </Sec>

            <Sec title="6 · Payments, deposits, and cancellations">
              <p>
                The platform itself does not process payments today. Where a stay or event
                carries a price, the amount, currency, taxes, payment method, and timing are
                agreed at confirmation. Unless a confirmation says otherwise: (a) nothing is owed
                for a request that is never confirmed, including waiting-list entries; (b)
                deposits secure a confirmed window and are refundable if the operator cancels;
                (c) guest-initiated cancellations follow the cancellation terms stated in the
                confirmation for that stay or event. Statutory consumer rights are not affected.
              </p>
            </Sec>

            <Sec title="7 · Conduct and house rules">
              <p>
                Members and guests are expected to respect the property, hosts, staff, other
                guests, privacy boundaries, and local laws. Photography and social sharing of
                private gatherings follow the rules announced for each gathering — when in
                doubt, ask the host. Guests are responsible for damage they (or their invited
                companions) cause at a property. We may remove access for unsafe, unlawful,
                abusive, or disruptive behavior.
              </p>
            </Sec>

            <Sec title="8 · Content and profiles">
              <p>
                You are responsible for the information you submit. You grant the Collective a
                non-exclusive licence to use content you submit (profile copy, photos) solely to
                operate the service — showing your profile to other members, running the
                directory, coordinating stays. You confirm your content does not infringe anyone
                else&apos;s rights. Member profile content is visible to other members once
                onboarding is complete; private contact details such as email, password, phone,
                and WhatsApp are not shown in the member directory. The Collective&apos;s own
                branding, copy, and software remain ours; scraping or reverse engineering the
                platform is not permitted.
              </p>
            </Sec>

            <Sec title="9 · Suspension and termination">
              <p>
                We may suspend or end access immediately for breach of these terms, unsafe or
                unlawful behavior, or risk to the house, members, or staff. Where reasonable, we
                will tell you why and hear you out — write to us to appeal. If membership ends
                with a confirmed upcoming stay, deposits for that stay are handled per its
                confirmation terms; where the termination is not caused by your breach, unused
                pre-payments are returned. Sections 8–13 survive termination.
              </p>
            </Sec>

            <Sec title="10 · Liability">
              <p>
                We aim to keep the service available and accurate, but the platform is provided
                as-is while the Collective is being built; dates, availability, programming, and
                pricing may change. To the extent permitted by law, our total liability arising
                from the platform or a stay or event is capped at the amounts you paid for the
                specific stay or event concerned (or €500 where nothing was paid), and we are
                not liable for indirect or consequential losses. Nothing in these terms excludes
                or limits liability for death or personal injury caused by negligence, for gross
                negligence or willful misconduct, or for rights consumers hold under mandatory
                law. Experiences arranged through independent third-party providers are those
                providers&apos; responsibility.
              </p>
            </Sec>

            <Sec title="11 · Your responsibility to us">
              <p>
                If your breach of these terms, violation of law, or conduct at a property causes
                claims or losses to the Collective, you are responsible for the direct damages
                that result. For consumers in the EU/EEA/UK this applies only to the extent
                permitted by the law of your country of residence.
              </p>
            </Sec>

            <Sec title="12 · Force majeure">
              <p>
                Neither side is liable for delay or failure caused by events beyond reasonable
                control — natural disasters, pandemics, government action, utility or transport
                failure, civil unrest. If such an event cancels a confirmed stay or event,
                pre-payments for it are refunded or re-credited.
              </p>
            </Sec>

            <Sec title="13 · Governing law and disputes">
              <p>
                These terms are governed by Spanish law, and disputes belong to the courts of
                the Balearic Islands, Spain — except that if you are a consumer in the EU/EEA or
                UK, you keep the protection of the mandatory rules, and the right to sue and be
                sued, in your country of residence. We prefer to resolve things directly first:
                write to{" "}
                <a className="text-champagne hover:underline" href={`mailto:${email}`}>
                  {email}
                </a>{" "}
                and we will try to sort it out informally before anything formal.
              </p>
            </Sec>

            <Sec title="14 · Changes, severability, entire agreement">
              <p>
                We may update these terms as the Collective evolves; material changes are
                announced on the platform and apply from the date shown above. If a clause is
                found unenforceable, the rest stands. These terms, together with the Privacy
                notice and any stay- or event-specific confirmations, are the whole agreement.
              </p>
            </Sec>

            <Sec title="15 · Contact">
              <p>
                Questions about these terms can be sent to{" "}
                <a className="text-champagne hover:underline" href={`mailto:${email}`}>
                  {email}
                </a>
                .
              </p>
            </Sec>
          </div>
        </div>
      </article>
    </main>
  );
}
