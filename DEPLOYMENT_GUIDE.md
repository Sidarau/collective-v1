# Collective V1 — Deployment Guide

## 1. Supabase Schema Setup (Required First)

The app requires these tables in Supabase. Since we couldn't execute the schema via CLI/API due to network restrictions, you need to run it manually:

1. Go to https://supabase.com/dashboard/project/evviegqieqdmlxixwwxt
2. Open **SQL Editor** (left sidebar)
3. Click **New query**
4. Copy the entire contents of `supabase/schema.sql`
5. Click **Run**
6. Verify tables appear in **Table Editor**

## 2. Seed Roca Llisa Data

After schema is created, run:

```bash
cd /Users/alexsidarau/Documents/WORK/ZEUG/SAAS/collective-v1
python3 scripts/seed-roca-llisa.py
```

This imports the 9 rooms and existing bookings from the Excel sheet.

## 3. Deploy to Vercel

### Option A: Vercel Dashboard (Recommended)
1. Go to https://vercel.com/new
2. Import `Sidarau/collective-v1`
3. Set framework to Next.js
4. Add environment variables from `.env.local`
5. Deploy

### Option B: Vercel CLI
```bash
vercel login
vercel --prod
```

## 4. Environment Variables

Copy these from `.env.local` into Vercel project settings:

- `NEXT_PUBLIC_BRAND_NAME`
- `NEXT_PUBLIC_BRAND_TAGLINE`
- `NEXT_PUBLIC_SUPPORT_EMAIL`
- `NEXT_PUBLIC_VILLA_NAME`
- `NEXT_PUBLIC_VILLA_LOCATION`
- `NEXT_PUBLIC_VILLA_DESCRIPTION`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `HUBSPOT_SERVICE_KEY`
- `HUBSPOT_PORTAL_ID`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `HUBSPOT_PIPELINE_ID`
- `HUBSPOT_DEAL_STAGE_REQUESTED`
- `HUBSPOT_DEAL_STAGE_APPROVED`
- `HUBSPOT_DEAL_STAGE_REJECTED`
- `HUBSPOT_DEAL_STAGE_CONFIRMED`

## 5. Test Flow

1. Visit `/public/onboarding`
2. Fill form → creates HubSpot contact + deal + Supabase lead
3. Check email for magic token
4. Visit `/public/login?email=...&token=...`
5. Browse `/portal/villa` → `/portal/rooms` → `/portal/booking`
6. Don uses `/admin/requests` to approve/reject

## Notes

- No Stripe integration yet — Don handles payments manually
- HubSpot notifications are used for Don alerts
- All values are env-driven for whitelabel future
