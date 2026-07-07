# Relocation runbook — move Collective to the collective@zeuglab.com Supabase project

**Goal:** run Collective prod on the correct account's project (`evviegqieqdmlxixwwxt`,
owned by `collective@zeuglab.com`) instead of the wrong-account project
(`iudicmvyihswhvgmyvcf`, personal-gmail org) the app was built against.

Doing this also frees a project slot in the gmail org so `zeuglab_db` (ClawPanel
prod, currently paused) can be reactivated. See Linear **ZEUG-424**.

## State discovered 2026-07-04

| | wrong (gmail) `iudicmvyihswhvgmyvcf` | correct (zeuglab) `evviegqieqdmlxixwwxt` |
|---|---|---|
| Schema | full (migrations 001→005, 29 tables) | **only 001 base** (users/villas/rooms/bookings/leads) |
| Keys | legacy JWT (service_role) works | **legacy JWT DISABLED** — must use `sb_secret_…` |
| Data | 2 real users + 7 test, seed content | 5 users, 1 villa, 3 rooms, 2 leads, 1 booking (early real) |
| Reachable by | Supabase MCP (this session) | REST + DB password only (different account) |

The correct project just needs migrations **002→005** applied (all additive —
existing rows are preserved). That SQL is ready:
[`CATCHUP_002-005_apply_in_dashboard.sql`](./CATCHUP_002-005_apply_in_dashboard.sql).

The full migration set (001→005) is now committed under `supabase/migrations/`
— previously 001 and 002 existed only in the gmail DB's history, never as files.

## Credentials (all in NoxKey, prefix `zeuglab/collective/`)

| NoxKey key | → Vercel env var(s) |
|---|---|
| `PROJECT_URL` | `SUPABASE_URL` **and** `NEXT_PUBLIC_SUPABASE_URL` |
| `SUPABASE_SECRET_KEY` (`sb_secret_…`) | `SUPABASE_SECRET_KEY` — **do NOT set `SUPABASE_SERVICE_ROLE_KEY`** |
| `SUPABASE_PUBLISHABLE_KEY` (`sb_publishable_…`) | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `RESEND_API_KEY` | `RESEND_API_KEY` |
| `OS_AGENT_API_KEY` | `AGENT_API_TOKEN` |

> **Why not `SUPABASE_SERVICE_ROLE_KEY`:** the correct project has legacy JWT keys
> disabled, so the service-role JWT returns 401. The app code (`packages/core/src/
> {config,supabase}.ts`) now prefers `SUPABASE_SECRET_KEY`. Leave the JWT var unset.

## Steps (in order)

### 1. Apply the schema catch-up  — *you, in the browser (no CLI/Touch ID)*
1. Open the Supabase dashboard for project **evviegqieqdmlxixwwxt** → SQL Editor.
2. Paste the entire contents of `CATCHUP_002-005_apply_in_dashboard.sql` and Run.
   It's wrapped in `BEGIN/COMMIT` — all-or-nothing. Expect "Success". (Running it
   twice will error on `CREATE TABLE`; it is one-shot on the 001-level DB.)
3. Sanity check in the SQL editor:
   `select count(*) from applications; select count(*) from kb_nodes; select id from storage.buckets where id='media';`
   — applications table exists (0 rows), kb_nodes has the seeded skeleton, media bucket present.

### 2. Set env on BOTH Vercel projects — *you or an agent with NoxKey Touch ID*
Projects: `collective-v1` (member) and `collective-admin` (admin). For **each**,
in **both** Production and Preview, set the vars from the table above. Also on
**admin** set `RESEND_FROM_EMAIL=collective@zeuglab.com` and `ADMIN_EMAIL=<inbox>`
(member already has RESEND_* from before). Remove any existing
`SUPABASE_SERVICE_ROLE_KEY` on both projects so the secret key is used.

CLI (per project dir, values sourced from NoxKey, never echoed):
```
eval "$(noxkey get zeuglab/collective/PROJECT_URL)"
eval "$(noxkey get zeuglab/collective/SUPABASE_SECRET_KEY)"
eval "$(noxkey get zeuglab/collective/SUPABASE_PUBLISHABLE_KEY)"
vercel env rm SUPABASE_SERVICE_ROLE_KEY production --yes   # if present
vercel env add SUPABASE_URL production --value "$PROJECT_URL" --yes
vercel env add NEXT_PUBLIC_SUPABASE_URL production --value "$PROJECT_URL" --yes
vercel env add SUPABASE_SECRET_KEY production --value "$SUPABASE_SECRET_KEY" --yes
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production --value "$SUPABASE_PUBLISHABLE_KEY" --yes
```
(repeat for `preview`, and for the admin project add RESEND_API_KEY / RESEND_FROM_EMAIL / ADMIN_EMAIL / AGENT_API_TOKEN).

### 3. Merge + deploy — *me or you*
- Merge PR #2 then PR #3 (both mergeable). The hardcoded-ref fix rides in on this branch.
- `cd admin && node ../scripts/sync-vendor-core.mjs && vercel deploy --prod`
- `cd .. && vercel deploy --prod`

### 4. Verify against the correct project — *me*
- Admin login works; `/gates` shows the 1 villa + rooms; `/kb` shows Collective OS tree.
- Create a screening window → apply via `/r/founding-circle` → book a slot → call appears.
- `curl -H "Authorization: Bearer <AGENT_API_TOKEN>" <admin>/api/kb/tree` → 200.

### 5. Go-live toggles — *you decide*
- Flip `EMAIL_MODE=send` on both projects when ready (default/unset = safe log mode).
- Delete leftover test users from the correct project before real traffic.

### 6. Reclaim the gmail slot — *you, later*
Once verified, pause/delete `collective` (`iudicmvyihswhvgmyvcf`) in the gmail org
and reactivate `zeuglab_db`. See ZEUG-424.

## Rollback
Nothing here is destructive to the correct project (additive migration; env is
additive). If a deploy misbehaves, repoint env back or `vercel rollback`. The
gmail project stays fully intact as a reference until step 6.
