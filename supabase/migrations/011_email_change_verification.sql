-- 011: email change with verification (mobile operator account sheet, Phase 2)
--
-- Token round trip: request (authenticated) → signed single-use token to the
-- NEW address → notification + cancel link to the OLD address → only the new
-- address confirming changes users.email, writes the audit row, and bumps
-- token_version so every existing session dies. Rate limits: pending rows
-- per account + expiry sweep.

create table if not exists public.email_change_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  old_email text not null,
  new_email text not null,
  -- Confirm token goes to the NEW address; cancel token to the OLD one.
  token text not null unique,
  cancel_token text not null unique,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'cancelled', 'expired')),
  requested_ip text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  cancelled_at timestamptz
);

create index if not exists email_change_requests_user_pending
  on public.email_change_requests (user_id) where status = 'pending';

create index if not exists email_change_requests_expiry
  on public.email_change_requests (expires_at) where status = 'pending';

-- Session invalidation: NextAuth JWTs carry token_version; the session
-- callback compares it to the live row and kills mismatches.
alter table public.users
  add column if not exists token_version integer not null default 1;

comment on table public.email_change_requests is
  'Signed, single-use, short-expiry email-change tokens. The address only changes after the new address confirms; the old address can cancel.';
