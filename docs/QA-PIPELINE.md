# Release & QA pipeline — collective-v1

Standard: Zeug release pipeline (skill `zeug-release-pipeline`). **PR CI gate → QA surface → phone check → prod.** Every bugfix ships with a failing-first regression test.

## Flow

1. Branch → PR to `main`. CI must go green: `mobile (typecheck · lint · unit · build · e2e)`, `admin (typecheck · lint · build)`, `member portal (lint · build)`. Branch protection enforces; self-merge allowed.
2. Merge → deploy the working tree to QA: `scripts/deploy-qa.sh mobile|admin|member`.
3. Phone check on the QA URL.
4. Prod: `vercel deploy --prod --yes` from the app dir. Smoke: unauth `/` → 307 to canonical login.

## Surfaces

| App | Prod | QA | QA Vercel project | Notes |
|---|---|---|---|---|
| mobile | mobile.opencollective.app (`collective-mobile-ops`) | qa.opencollective.app | `collective-mobile-qa` | guard enforced, live data, Kimi+Resend wired |
| admin | opencollective.app (`collective-admin`) | qa1.opencollective.app | `collective-admin-qa` | `EMAIL_MODE=log` — nothing sends |
| member | myopencollective.com (`collective-v1`) | qa.myopencollective.com | `collective-member-qa` | `EMAIL_MODE=log` |

QA projects have **no git connection** — CLI deploys only, so QA always reflects the working tree.

## Gotchas (all bit 2026-08-02)

- New Vercel projects are created `framework:null` → every route edge-404s. PATCH `{"framework":"nextjs"}` via `/v9/projects/:id` and redeploy.
- New projects have SSO deployment protection ON → phone hits a Vercel login. PATCH `{"ssoProtection":null}`.
- `vercel env pull` returns `""` for Sensitive vars — source QA envs from `.env.local` + NoxKey, never pull-copy.
- Attach domains via `POST /v9/projects/:id/domains`; stale `vercel alias` entries shadow and 404.
- Porkbun API base: `https://api.porkbun.com` (bare domain 403s). opencollective.app DNS = Porkbun; myopencollective.com = Route53.
- CI builds use placeholder envs only — no credentials in the workflow.
- Time-relative e2e fixtures rot as dates slide: `expect.poll`, never fixed waits.
