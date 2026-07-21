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
- Agents can use the authenticated Operator MCP and KB API. Current tokens are owner/admin access only; do not issue them to staff until server-enforced scopes are implemented.

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
npm run build
cd admin
npm run lint
npm run typecheck
npm run build
~~~

## Database

Tracked changes live in supabase/migrations/. Apply migrations in order to the intended Supabase project. Do not rewrite or remove a migration already applied to a shared environment; create a follow-up migration.

## Operator MCP and KB

The admin application exposes authenticated KB REST routes and the MCP transport. Agent tokens currently authenticate identity and audit attribution but do not yet enforce per-role tool, record, or KB-visibility scopes. Treat them as owner/admin credentials until scoped authorization and a whoami/capabilities action ship.

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
