# Collective V1 — Deployment Guide

## 1. Prerequisites

- Node.js 20+
- Vercel CLI: `npm i -g vercel`
- Access to the Collective Vercel project (or create a new one)
- Supabase project with service role key
- HubSpot private app token

## 2. Vercel project setup

```bash
cd collective-v1
vercel link
```

Select the target project or create a new one.

## 3. Environment variables

Add all required env vars to Vercel:

```bash
# Public brand/villa
vercel env add NEXT_PUBLIC_BRAND_NAME production
vercel env add NEXT_PUBLIC_BRAND_TAGLINE production
vercel env add NEXT_PUBLIC_SUPPORT_EMAIL production
vercel env add NEXT_PUBLIC_VILLA_NAME production
vercel env add NEXT_PUBLIC_VILLA_LOCATION production
vercel env add NEXT_PUBLIC_VILLA_DESCRIPTION production
vercel env add NEXT_PUBLIC_BASE_URL production

# Supabase
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production

# Auth
vercel env add NEXTAUTH_SECRET production
vercel env add NEXTAUTH_URL production

# HubSpot
vercel env add HUBSPOT_SERVICE_KEY production
vercel env add HUBSPOT_PORTAL_ID production
vercel env add HUBSPOT_PIPELINE_ID production
vercel env add HUBSPOT_STAGE_INQUIRY production
vercel env add HUBSPOT_STAGE_REQUESTED production
vercel env add HUBSPOT_STAGE_APPROVED production
vercel env add HUBSPOT_STAGE_BOOKED production
vercel env add HUBSPOT_STAGE_PAID production
vercel env add HUBSPOT_STAGE_CANCELLED production
```

For local development, copy `.env.local.example` to `.env.local` and fill in the same values.

## 4. Database

Run `supabase/schema.sql` in the Supabase Dashboard SQL Editor before first deploy. The schema includes seed data for Roca Llisa.

## 5. Deploy

### Preview deploy

```bash
vercel
```

### Production deploy

```bash
vercel --prod
```

## 6. Post-deploy checks

- `/` loads the landing page.
- `/onboarding` submits and creates a lead + user + magic token.
- `/login` accepts email + token and redirects to `/portal/villa`.
- `/admin/requests` is accessible only to users with role `admin` or `operator`.
- HubSpot webhook endpoint: `POST /api/webhooks/hubspot`.

## 7. HubSpot webhook

Subscribe to `deal.propertyChange` for `dealstage` and point the target URL to:

```
https://your-domain.com/api/webhooks/hubspot
```

In production, configure HubSpot signature verification in `src/app/api/webhooks/hubspot/route.ts`.

## 8. Creating an admin/operator user

Insert a user directly into Supabase with role `admin` or `operator`, then create a magic token:

```sql
INSERT INTO public.users (email, role)
VALUES ('ops@example.com', 'operator');

INSERT INTO public.magic_tokens (user_id, token, expires_at)
VALUES (
  (SELECT id FROM public.users WHERE email = 'ops@example.com'),
  'dev-token',
  NOW() + INTERVAL '7 days'
);
```

Then visit `/login?email=ops@example.com&token=dev-token`.
