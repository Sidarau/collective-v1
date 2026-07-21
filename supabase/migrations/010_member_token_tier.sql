-- Add a 'member' agent-token tier (read-only, member-audience KB: events/gates
-- shared with members) alongside owner|staff. Additive + idempotent.

ALTER TABLE public.agent_tokens DROP CONSTRAINT IF EXISTS agent_tokens_scope_check;
ALTER TABLE public.agent_tokens
  ADD CONSTRAINT agent_tokens_scope_check CHECK (scope IN ('owner', 'staff', 'member'));
