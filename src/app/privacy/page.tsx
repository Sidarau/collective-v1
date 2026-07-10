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

function Rows({ rows }: { rows: [string, string][] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/12">
      {rows.map(([a, b], i) => (
        <div
          key={a}
          className={`grid grid-cols-1 gap-1 px-4 py-3 sm:grid-cols-[minmax(0,42%)_1fr] sm:gap-4 ${
            i > 0 ? "border-t border-white/8" : ""
          }`}
        >
          <p className="text-[13px] font-medium text-ink/90">{a}</p>
          <p className="text-[13px] text-ink/65">{b}</p>
        </div>
      ))}
    </div>
  );
}

export default function PrivacyPage() {
  const email = config.supportEmail;
  return (
    <main className="min-h-dvh bg-base px-5 py-12">
      <article className="mx-auto max-w-2xl">
        <Link href="/" className="wordmark text-sm text-ink">
          Collective
        </Link>
        <div className="glass mt-10 p-6 sm:p-8">
          <p className="eyebrow">Privacy</p>
          <h1 className="display mt-3 text-[34px] leading-tight text-ink">Privacy notice</h1>
          <p className="muted mt-3 text-[13px]">Last updated 10 July 2026.</p>

          <div className="mt-8 space-y-6 text-[14px] leading-relaxed text-ink/82">
            <Sec title="1 · Who controls the data">
              <p>
                Open Collective, operated from Ibiza, Spain, is the data controller for personal
                data processed through this platform (formal legal-entity details will be
                published here upon completion of incorporation). For privacy questions and to
                exercise any right described below, contact{" "}
                <a className="text-champagne hover:underline" href={`mailto:${email}`}>
                  {email}
                </a>
                . A dedicated data-protection officer has not been appointed at this stage; the
                same address reaches the person responsible for data protection.
              </p>
            </Sec>

            <Sec title="2 · What we collect">
              <p>
                Depending on the flow: name, email, phone or WhatsApp, birthday, optional
                Instagram/social links, application answers, profile copy and photo, RSVP notes,
                dietary or allergy notes, stay-window details, internal admin notes, message
                delivery logs, and technical logs needed to run the service. Passwords are
                stored only as hashes. We do not run analytics or advertising trackers.
              </p>
            </Sec>

            <Sec title="3 · Why we use it — and the legal basis">
              <p>
                Under the GDPR (and UK GDPR), each use of your data rests on a legal basis:
              </p>
              <Rows
                rows={[
                  ["Applications, screening calls, membership", "Contract — Art. 6(1)(b)"],
                  ["Stays, events, RSVPs, waiting lists", "Contract — Art. 6(1)(b)"],
                  ["Profile shown to other members", "Consent — Art. 6(1)(a), given at onboarding"],
                  ["Dietary & allergy notes (health data)", "Explicit consent — Art. 9(2)(a)"],
                  ["Birthday (greetings, house rituals)", "Legitimate interest — Art. 6(1)(f)"],
                  ["Service emails & operational records", "Legitimate interest — Art. 6(1)(f)"],
                  ["Safety, legal, and accounting records", "Legal obligation — Art. 6(1)(c)"],
                ]}
              />
              <p>
                Where a use rests on consent you can withdraw it at any time — withdrawal
                doesn&apos;t affect what happened before. Public-event RSVP consent is recorded
                with the RSVP.
              </p>
            </Sec>

            <Sec title="4 · Dietary and allergy information">
              <p>
                Allergy and dietary notes are health data. You choose whether to share them;
                they are used only to keep you safe and fed at stays and events, visible only to
                operators and the staff who need them (kitchen, safety), never shown in the
                member directory, and deleted or anonymised when no longer needed for upcoming
                gatherings.
              </p>
            </Sec>

            <Sec title="5 · Cookies">
              <p>
                The platform uses only strictly necessary cookies: session cookies that keep you
                signed in and security cookies that protect forms. No analytics, advertising, or
                cross-site tracking cookies are set — which is why there is no cookie banner. If
                that ever changes, we will ask for consent first.
              </p>
            </Sec>

            <Sec title="6 · Who can see it, and who processes it">
              <p>
                Operators see operational records. Members see member-visible profile copy after
                onboarding. Guest RSVPs and private contact details are not shown in the member
                directory. Infrastructure is provided by processors under data-processing
                agreements (GDPR Art. 28), currently: Vercel (hosting), Supabase (database and
                storage), Resend (email delivery), and Google (Firebase phone verification and —
                where an operator connects it — Google Calendar scheduling). Villa owners and
                staff receive only what a specific stay or event requires.
              </p>
            </Sec>

            <Sec title="7 · International transfers">
              <p>
                Data is hosted in the EU where the provider offers it. Some providers are
                US-based; transfers to them rely on the EU–US Data Privacy Framework or Standard
                Contractual Clauses. You can request a copy of the relevant safeguards via the
                contact address.
              </p>
            </Sec>

            <Sec title="8 · How long we keep it">
              <Rows
                rows={[
                  ["Account & profile", "Duration of membership + 2 years"],
                  ["Applications (not approved)", "2 years from decision"],
                  ["Booking & stay records", "7 years (tax and accounting)"],
                  ["Dietary / allergy notes", "While relevant to upcoming stays, then removed"],
                  ["Email delivery logs", "3 years (dispute resolution)"],
                  ["Guest-list RSVPs", "2 years from the event"],
                ]}
              />
              <p>
                When a period ends we delete or anonymise. You can request earlier deletion at
                any time (see rights below).
              </p>
            </Sec>

            <Sec title="9 · Your rights (EU/EEA & UK)">
              <p>
                You may request access, rectification, erasure, restriction, portability
                (machine-readable export), object to legitimate-interest processing, and
                withdraw consent. Write to{" "}
                <a className="text-champagne hover:underline" href={`mailto:${email}`}>
                  {email}
                </a>
                ; we verify identity against the account details we hold, respond within one
                month (extendable by two for complex requests, with notice), and charge nothing
                unless a request is manifestly unfounded or excessive. You may also complain to
                a supervisory authority — in Spain the AEPD (aepd.es); in the UK the ICO
                (ico.org.uk).
              </p>
            </Sec>

            <Sec title="10 · California and other US state rights">
              <p>
                If you are a California resident, the CCPA/CPRA gives you the right to know what
                personal information we collect (sections 2–3 above), to access and correct it,
                to delete it, to limit use of sensitive personal information, and to not be
                discriminated against for exercising these rights. We do not sell personal
                information and do not share it for cross-context behavioral advertising — there
                is nothing to opt out of. Residents of Virginia, Colorado, Connecticut, Utah,
                and other states with comparable laws have equivalent access, correction,
                deletion, and portability rights, and may appeal a refusal by replying to our
                decision. Exercise any of these via{" "}
                <a className="text-champagne hover:underline" href={`mailto:${email}`}>
                  {email}
                </a>
                ; an authorised agent may act for you with written permission.
              </p>
            </Sec>

            <Sec title="11 · No automated decisions">
              <p>
                Membership, screening, and stay decisions are made by people — the founding
                circle — not by automated profiling. Waiting lists are handled personally, in
                order and in context.
              </p>
            </Sec>

            <Sec title="12 · Children">
              <p>
                The service is not directed at anyone under 18. We do not knowingly collect
                children&apos;s data; if we learn we hold any, we delete it. Parents or
                guardians can contact us at the address above.
              </p>
            </Sec>

            <Sec title="13 · Security and breaches">
              <p>
                We use authenticated operator access, server-side validation, password hashing,
                logged email delivery, and private admin tools. No online system is risk-free.
                If a breach is likely to put your rights at risk, we will notify you without
                undue delay and cooperate with the supervisory authority (GDPR Arts. 33–34).
              </p>
            </Sec>

            <Sec title="14 · Changes and contact">
              <p>
                We will update this notice as the Collective evolves; the date above always
                reflects the current version. For privacy questions or to exercise your rights,
                write to{" "}
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
