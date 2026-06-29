# Collective V1

A whitelabel MVP for private villa bookings. Built with Next.js 16, TypeScript, Tailwind CSS, Supabase, NextAuth, and HubSpot.

## What it does

- Visitors apply to stay via `/onboarding`.
- Onboarding creates a HubSpot contact + deal, a Supabase lead/user, and a magic login token.
- Leads log in at `/login` with email + magic token.
- Authenticated leads browse the villa, rooms, and request bookings.
- Operators/admins log in with the same flow (users with role `operator` or `admin`).
- Operators review and approve/reject booking requests at `/admin/requests`.
- HubSpot webhook updates booking status when deal stages change.

## Tech stack

- **Framework:** Next.js 16.2.9 (App Router, Turbopack)
- **Language:** TypeScript 5
- **Styling:** Tailwind CSS
- **Database:** Supabase (Postgres)
- **Auth:** NextAuth.js with magic-link credentials
- **CRM:** HubSpot (direct fetch API client)
- **Deployment:** Vercel

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

Copy `.env.local.example` to `.env.local` and fill in:

```bash
# Brand (public)
NEXT_PUBLIC_BRAND_NAME=Collective
NEXT_PUBLIC_BRAND_TAGLINE="Private villa living, curated."
NEXT_PUBLIC_SUPPORT_EMAIL=hello@example.com

# Villa (public)
NEXT_PUBLIC_VILLA_NAME="Roca Llisa"
NEXT_PUBLIC_VILLA_LOCATION="Ibiza, Spain"
NEXT_PUBLIC_VILLA_DESCRIPTION="A private Mediterranean villa experience."
NEXT_PUBLIC_BASE_URL=http://localhost:3000

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Auth
NEXTAUTH_SECRET=your-random-secret
NEXTAUTH_URL=http://localhost:3000

# HubSpot
HUBSPOT_SERVICE_KEY=your-hubspot-private-app-token
HUBSPOT_PORTAL_ID=your-portal-id
HUBSPOT_PIPELINE_ID=default
HUBSPOT_STAGE_INQUIRY=inquiry_received
HUBSPOT_STAGE_REQUESTED=requested
HUBSPOT_STAGE_APPROVED=approved
HUBSPOT_STAGE_BOOKED=booked
HUBSPOT_STAGE_PAID=paid
HUBSPOT_STAGE_CANCELLED=cancelled
```

## Database setup

1. Open the Supabase Dashboard SQL Editor.
2. Run the full schema from `supabase/schema.sql`.
3. The schema seeds one villa (`Roca Llisa`) and three rooms.

## Deployment

See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for Vercel setup.

## Project structure

```
src/
  app/              # Next.js App Router pages
  lib/              # Config, Supabase client, HubSpot client, auth helpers
  types/            # Shared TypeScript types
supabase/
  schema.sql        # Database schema + seed data
```
