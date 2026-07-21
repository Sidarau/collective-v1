# Collective deployment guide

## Prerequisites

- Node.js 20+.
- Access to the member and admin Vercel projects.
- The intended Supabase project and its public/server credentials.
- Auth secrets and public URLs for both apps.
- Resend credentials only when real delivery is approved.

Use .env.local.example as the variable inventory. Do not read, print, or commit real environment files.

## Database

1. Confirm the target Supabase project.
2. Apply the ordered files in supabase/migrations/.
3. Verify the expected tables, policies, seed content, storage buckets, and admin account.
4. Never apply a destructive schema change without a data check and rollback plan.

## Member app

From the repository root:

~~~bash
npm install
npm run lint
npm run build
vercel
~~~

Use vercel --prod only after the preview passes.

## Admin app

From admin/:

~~~bash
npm install
npm run lint
npm run typecheck
npm run build
vercel
~~~

The prebuild step synchronizes the shared core into admin/vendor-core.

## Safe email mode

Keep EMAIL_MODE=log until Alex explicitly approves delivery. In log mode, communications are persisted to the outbox but are not sent.

## Owner-agent access

The admin deployment hosts the Operator MCP and KB REST API. Agent tokens are currently owner/admin credentials because backend per-role scopes and KB row filtering are not yet enforced. Do not create or distribute a Don/staff token until scoped authorization and a whoami/capabilities action are deployed and verified.

## Post-deploy checks

- Landing, legal pages, login, and referral doors load.
- Application and screening routes validate invalid input safely.
- Member login reaches the portal.
- Admin login reaches the console and blocks unauthorized users.
- Applications, people, requests, gates, events, referrals, schedule, communications, and KB pages load without server errors.
- MCP and KB routes reject missing/invalid credentials.
- EMAIL_MODE has the intended value.
- Browser console and Vercel logs show no unexpected errors.

Record the deployment and verification evidence in the assigned Linear issue.
