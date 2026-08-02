# Don Onboarding Runbook — Mobile Operator App

> Status 2026-08-01: the app is live, guarded, and sign-in is verified
> end-to-end in production. The only missing input is **Don's email address**.
> Everything below is the exact, tested path — no improvisation needed.

## What Don gets

- `https://mobile.opencollective.app` — the operator surface: Today (live
  numbers), requests, experiences, dues, people, spaces, and Collecta
  (Kimi-backed answers; rule-based fallback so it never goes silent).
- One tap install: shareable install link + Add to Home Screen coach mark.
- Sign-in (single login, 2026-08-01+): the only login form lives on
  `opencollective.app`. The mobile app never shows a form — an
  unauthenticated visitor bounces `mobile → opencollective.app/login?next=…`
  and lands back on the mobile Today screen after sign-in; anyone already
  signed in on the parent domain passes through without seeing any form.
  Magic link (7-day, one-time) is the primary path; password is secondary.

## Verified working (2026-08-01, production)

| Check | Result |
|---|---|
| Magic-link mint → consume → session | ✅ 302 → Today |
| Session cookie contract | ✅ `__Secure-`, `Domain=.opencollective.app`, `SameSite=Lax`, `HttpOnly` |
| Same session on `opencollective.app` (admin) | ✅ one login, both apps |
| One-time replay of a used link | ✅ rejected (`link_invalid`) |
| No-cookie guard | ✅ 307 → `/login?next=…` |
| Live data (experiences/requests/dues) | ✅ real Supabase rows, not fixtures |
| Collecta model key in prod env | ✅ `KIMI_SELENE_API_KEY` set |
| Unit suite | ✅ 104/104 vitest, typecheck, eslint |

## One-time step still owed (blocks email-change only, not sign-in)

Run `supabase/migrations/011_email_change_verification.sql` against the prod
project (`evviegqieqdmlxixwwxt`) in the Supabase SQL editor, or via the
Management API with a PAT. Sessions currently fail-open past the missing
`token_version` column; the email-change feature 500s until applied.
Tracked on ZEUG-481.

## Onboard Don (5 minutes, one command + one text)

1. Create his operator account (run from `admin/` with `.env.local` present):

```bash
EMAIL="<don's-email>"   # ← the only input needed
SUPABASE_URL=$(grep '^SUPABASE_URL=' .env.local | cut -d= -f2-)
KEY=$(grep '^SUPABASE_SECRET_KEY=' .env.local | cut -d= -f2-)
curl -s "$SUPABASE_URL/rest/v1/users" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" -H "Prefer: return=representation" \
  -d "{\"email\": \"$EMAIL\", \"role\": \"operator\"}"
```

2. Send his entrance link — either:
   - from the admin console (operator magic-link action), or
   - `POST https://opencollective.app/api/auth/magic-link` with
     `{"email": "<don's-email>"}` — emails him a one-time link.
3. Text him (copy, ultra-short):

> Your Collective operator app is ready. Open this link on your phone, then
> tap "Add to Home Screen" when it offers. That's it — you're in.
> <link>

4. After his first sign-in, confirm his row shows a recent session and ask
   him to set a password (account sheet) for steady-state logins.

## Seat rules (from `zeug-collective/operator-os/clawpanel-don-seat.yaml`)

- `approval_mode: manual` — nothing consequential auto-executes for Don.
- Bind a phone channel only after one manual send-and-reply pass.
- Connect and review Google calendars before granting calendar reads
  (Google OAuth verification is ZEUG-482 — not a sign-in blocker).
- Don never sees tokens, MCP details, server names, or setup mechanics.

## Incident notes from the 2026-08-01 fix

- **Page guard bounce (the big one):** `getOperatorPrincipal` passed a
  synthetic `{ headers }` req to next-auth v4 `getToken`; the v4
  SessionStore reads `req.headers.cookie` as a plain property, which a
  Next 16 `Headers` instance does not have. Result: middleware passed,
  page guard bounced — every signed-in operator looped on `/login`.
  Fixed in `mobile/src/lib/guard.ts` by reading the cookie via
  `next/headers cookies()` and decoding directly (unsalted, matching both
  `getToken` and the magic-link minter).
- **Temp debug endpoints removed:** `/api/cookie-config` (both apps) and its
  middleware exception are gone; deploys now ship from clean `main` only.
- **Stacked-PR trap:** PR #16 merged into `feat/mobile-phase1-ui`, not main.
  Anything stacked on that branch needed PR #17 to reach production.
