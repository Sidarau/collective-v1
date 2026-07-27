-- Agent chat messages: Selene (owner seat) + Collecta (Don's seat)
-- Two distinct identities, shared Collective workspace, separate conversation history.

CREATE TABLE IF NOT EXISTS public.agent_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_name  text NOT NULL CHECK (agent_name IN ('selene', 'collecta')),
  role        text NOT NULL CHECK (role IN ('user', 'agent', 'system')),
  content     text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Index for fast per-admin, per-agent history lookup
CREATE INDEX IF NOT EXISTS agent_messages_admin_agent_created
  ON public.agent_messages (admin_id, agent_name, created_at DESC);

-- RLS: users only see their own messages
ALTER TABLE public.agent_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own agent messages"
  ON public.agent_messages FOR SELECT
  USING (auth.uid() = admin_id);

CREATE POLICY "users insert own agent messages"
  ON public.agent_messages FOR INSERT
  WITH CHECK (auth.uid() = admin_id);

-- Service role (API routes) bypasses RLS — enforced in code via getAdminUser()
COMMENT ON TABLE public.agent_messages IS 'Chat history for Selene and Collecta identities. Scoped per admin user.';
