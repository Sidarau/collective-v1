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

Copy `.env.local.example` to `.env.local` and fill it in for local development.

For Vercel, add the same variables to Production and Preview environments:

```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add NEXTAUTH_SECRET production
vercel env add NEXTAUTH_URL production
vercel env add HUBSPOT_SERVICE_KEY production
vercel env add HUBSPOT_PORTAL_ID production
vercel env add HUBSPOT_PIPELINE_ID production
vercel env add HUBSPOT_STAGE_INQUIRY production
vercel env add HUBSPOT_STAGE_REQUESTED production
vercel env add HUBSPOT_STAGE_APPROVED production
vercel env add HUBSPOT_STAGE_BOOKED production
vercel env add HUBSPOT_STAGE_PAID production
vercel env add HUBSPOT_STAGE_CANCELLED production
vercel env add HUBSPOT_WEBHOOK_SECRET production
```

Repeat for `preview` if you want preview deploys to work.

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
- `/admin/invite` lets operators generate one-time invite links.
- HubSpot webhook endpoint: `POST /api/webhooks/hubspot`.

## 7. HubSpot webhook

Subscribe to `deal.propertyChange` for `dealstage` and point the target URL to:

```
https://your-domain.com/api/webhooks/hubspot
```

Add the webhook client secret to Vercel as `HUBSPOT_WEBHOOK_SECRET`.

## 8. Creating your first admin user

Until the first admin exists, insert them directly into Supabase:

```sql
INSERT INTO public.users (email, role)
VALUES ('you@example.com', 'admin');

INSERT INTO public.magic_tokens (user_id, token, expires_at)
VALUES (
  (SELECT id FROM public.users WHERE email = 'you@example.com'),
  'your-first-token',
  NOW() + INTERVAL '7 days'
);
```

Then visit `/login?email=you@example.com&token=your-first-token`.

After that, use `/admin/invite` to create additional admins, operators, or leads.

## 9. HubSpot magic-link email workflow

1. Create a contact property `magic_link` in HubSpot.
2. Create a workflow triggered when `magic_link` is known.
3. Action: send email with the `magic_link` personalization token.
4. Onboarding will automatically populate `magic_link` on the contact.
