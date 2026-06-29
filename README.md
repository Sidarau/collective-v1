# Collective V1 — Whitelabel Villa Booking Platform

A configurable, whitelabel-ready villa booking platform built for Collective.

## Architecture

- **Frontend**: Next.js 14 App Router + TypeScript + Tailwind CSS
- **Auth**: NextAuth.js (magic link + credentials)
- **Database**: Supabase (PostgreSQL)
- **CRM**: HubSpot (deals, contacts, pipeline)
- **Payments**: Stripe (placeholder for now — Don handles payments manually)
- **Notifications**: HubSpot email + WhatsApp (Twilio stub)

## Whitelabel Config

All brand values, villa data, and pricing are configurable via environment variables and database tables.

## Flow

1. **Lead gets WhatsApp link** from Don → opens onboarding form
2. **Lead submits form** → account created → data to HubSpot + Supabase
3. **Lead logs into portal** → sees villa, rooms, availability calendar
4. **Lead requests room** → Don gets notification → CRM deal updated
5. **Don approves** → status updated everywhere → invoice generated (v2)
6. **Payment** → Stripe (v2) → booking confirmed → welcome/FAQ sent

## Project Structure

```
src/
  app/
    (public)/
      onboarding/         # Lead onboarding form
      login/              # Magic link login
    (portal)/
      dashboard/          # Lead portal
      villa/              # Villa view
      rooms/              # Room listing
      booking/            # Availability + request
    (admin)/
      dashboard/          # Don's operator dashboard
      requests/           # Pending approvals
      leads/              # Lead management
    api/
      auth/               # NextAuth config
      hubspot/            # HubSpot webhooks
      onboarding/         # Form submission
      booking/            # Booking requests
  components/
    ui/                   # shadcn/ui components
    forms/                # Form components
    calendar/             # Availability calendar
  lib/
    config.ts             # Whitelabel config
    supabase.ts           # Supabase client
    hubspot.ts            # HubSpot API client
    auth.ts               # Auth helpers
  types/
    index.ts              # TypeScript types
```
