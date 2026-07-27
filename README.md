# Collective

Owned member platform and Operator OS for the Open Collective business. The repository contains two Next.js 16 applications backed by Supabase:

- Member app at the repository root.
- Admin/operator console in admin/.

Supabase is the live system of record for people, applications, profiles, stays, availability, events, referrals, communications, and the Collective knowledge base.

## Main flows

- Prospects enter through member, instant-member, vendor, or staff referral doors.
- Applications move through screening and human approval.
- Approved members complete onboarding and use the private member portal.
- Members explore gates, request stays, attend events, view members, and manage their profile.
- Operators manage applications, people, requests, gates, rooms, events, referrals, scheduling, communications, and KB content.
- Agents use server-enforced Operator MCP capabilities. Assistant tokens can
  read explicitly granted calendars and request calendar changes; they cannot
  approve those requests or manage connections/grants.

## Stack

- Next.js 16.2.9, React 19, TypeScript, Tailwind CSS.
- Supabase Postgres, Auth, and Storage.
- NextAuth for application sessions.
- Resend-backed outbox with EMAIL_MODE=log as the safe default.
- MCP handler for owner/admin agent access.
- Vercel deployments for the member and admin apps.

## Local development

Install dependencies once at the root:

~~~bash
npm install
~~~

Start the member app:

~~~bash
npm run dev
~~~

Start the admin app in another terminal:

~~~bash
cd admin
npm run dev
~~~

Member defaults to http://localhost:3000 and admin to http://localhost:3001.

Copy .env.local.example to .env.local and provide the required Supabase, auth, URL, email, and optional owner-agent values. Never commit local environment files.

## Verification

~~~bash
npm run lint
npm test
npm run build
cd admin
npm run lint
npm run typecheck
npm run build
~~~

## Database

Tracked changes live in supabase/migrations/. Apply migrations in order to the intended Supabase project. Do not rewrite or remove a migration already applied to a shared environment; create a follow-up migration.

## Operator MCP, KB, and Selene

The admin application exposes authenticated KB REST routes and the MCP
transport. Every MCP tool checks the resolved principal's capability. KB access
also checks tree grants; calendar access checks per-token calendar grants.

Attributable `owner` tokens can use `stay_requests_search` to preview a narrow
stay record, `stay_request_availability` to preview eligible rooms, and
`stay_request_approve` after an explicit owner confirmation. Approval is
atomic, rechecks room commitments/blocks/closures, and can explicitly move a
waitlisted request only to a room with enough capacity and the same quoted
price/currency. Member notification defaults off and every decision is
audited. Assistant, staff, member, and shared system tokens cannot approve
stays.

For Selene, mint an `assistant` token on **Agents & MCP**, connect Google on
**Schedule**, choose calendars, then grant those calendars to the token. Agent
creates/updates/cancellations appear in Schedule as approval requests. Don
never needs a cloud-console account or an MCP configuration screen. An admin
can instead create a 48-hour, one-use Google setup link on **Agents & MCP**;
Don taps it, chooses Google, presses Allow, and is done without setting a
console password. The admin then selects and grants the connected calendars.

## Google Calendar v2

The OAuth consent button lives on Schedule. Configure one Google Web OAuth
client with this redirect URI:

`https://opencollective.app/api/google/oauth/callback`

Set `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`,
`GOOGLE_TOKEN_ENCRYPTION_KEY`, `GOOGLE_CALENDAR_WEBHOOK_URL`, and
`CALENDAR_CRON_SECRET` in the admin deployment. Refresh tokens are AES-GCM
encrypted before storage.

The app uses Google Calendar incremental sync tokens and expiring push
channels. The optional stack in `infra/collective-automation/` acknowledges
webhooks through SQS, retries failures to a DLQ, and runs daily reconciliation.

## Deployment

See DEPLOYMENT_GUIDE.md.

## Project map

~~~text
src/                    member application and public flows
admin/src/              operator console and MCP transport
packages/core/src/      shared data, auth-adjacent, scheduling, and KB logic
supabase/migrations/    ordered database changes
scripts/                maintenance and local fixture utilities
~~~
