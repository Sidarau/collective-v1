-- Calendar v2: normalized Google OAuth connections, selected calendars,
-- bidirectional event links, agent grants, and human-gated write requests.
-- All access is server-side through the service-role client. Public tables
-- have RLS enabled with no anon/authenticated policies.

BEGIN;

-- Selene-style service principals sit between owner and staff: they can read
-- operator summaries and request bounded calendar changes, but cannot manage
-- tokens/grants or perform broad operational writes.
ALTER TABLE public.agent_tokens DROP CONSTRAINT IF EXISTS agent_tokens_scope_check;
ALTER TABLE public.agent_tokens
  ADD CONSTRAINT agent_tokens_scope_check
  CHECK (scope IN ('owner', 'assistant', 'staff', 'member'));

CREATE TABLE public.google_calendar_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  google_email TEXT,
  refresh_token_ciphertext TEXT NOT NULL,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_synced_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (admin_id)
);
CREATE INDEX idx_google_calendar_connections_active
  ON public.google_calendar_connections(active) WHERE active;
ALTER TABLE public.google_calendar_connections ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.calendar_oauth_invites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_calendar_oauth_invites_active
  ON public.calendar_oauth_invites(token_hash, expires_at)
  WHERE used_at IS NULL;
ALTER TABLE public.calendar_oauth_invites ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.google_calendar_sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  connection_id UUID NOT NULL REFERENCES public.google_calendar_connections(id) ON DELETE CASCADE,
  google_calendar_id TEXT NOT NULL,
  summary TEXT NOT NULL,
  timezone TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  selected BOOLEAN NOT NULL DEFAULT TRUE,
  detail_visibility TEXT NOT NULL DEFAULT 'details'
    CHECK (detail_visibility IN ('busy', 'details', 'private')),
  sync_token TEXT,
  watch_channel_id TEXT,
  watch_resource_id TEXT,
  watch_token_hash TEXT,
  watch_expires_at TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (connection_id, google_calendar_id)
);
CREATE INDEX idx_google_calendar_sources_selected
  ON public.google_calendar_sources(connection_id, selected);
CREATE INDEX idx_google_calendar_sources_watch
  ON public.google_calendar_sources(watch_channel_id)
  WHERE watch_channel_id IS NOT NULL;
ALTER TABLE public.google_calendar_sources ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.calendar_event_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id UUID NOT NULL REFERENCES public.google_calendar_sources(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('screening_call', 'event')),
  entity_id UUID NOT NULL,
  google_event_id TEXT NOT NULL,
  google_etag TEXT,
  content_hash TEXT,
  last_origin TEXT NOT NULL DEFAULT 'collective'
    CHECK (last_origin IN ('collective', 'google')),
  google_deleted_at TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_id, entity_type, entity_id),
  UNIQUE (source_id, google_event_id)
);
CREATE INDEX idx_calendar_event_links_entity
  ON public.calendar_event_links(entity_type, entity_id);
ALTER TABLE public.calendar_event_links ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.agent_calendar_grants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_token_id UUID NOT NULL REFERENCES public.agent_tokens(id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES public.google_calendar_sources(id) ON DELETE CASCADE,
  detail_level TEXT NOT NULL DEFAULT 'details'
    CHECK (detail_level IN ('busy', 'details', 'private')),
  can_read BOOLEAN NOT NULL DEFAULT TRUE,
  can_request_writes BOOLEAN NOT NULL DEFAULT FALSE,
  low_risk_autoexecute BOOLEAN NOT NULL DEFAULT FALSE,
  approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (agent_token_id, source_id)
);
CREATE INDEX idx_agent_calendar_grants_token
  ON public.agent_calendar_grants(agent_token_id);
ALTER TABLE public.agent_calendar_grants ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.calendar_action_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  requested_by_token_id UUID REFERENCES public.agent_tokens(id) ON DELETE SET NULL,
  requested_by_admin_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  source_id UUID NOT NULL REFERENCES public.google_calendar_sources(id) ON DELETE CASCADE,
  operation TEXT NOT NULL
    CHECK (operation IN ('create', 'update', 'cancel')),
  google_event_id TEXT,
  payload JSONB NOT NULL DEFAULT '{}',
  risk TEXT NOT NULL DEFAULT 'high' CHECK (risk IN ('low', 'high')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'denied', 'executing', 'executed', 'failed', 'expired')),
  idempotency_key TEXT NOT NULL UNIQUE,
  preview TEXT NOT NULL,
  approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  denied_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  denied_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  executed_at TIMESTAMPTZ,
  result JSONB,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_calendar_action_requests_pending
  ON public.calendar_action_requests(status, expires_at)
  WHERE status IN ('pending', 'approved');
CREATE INDEX idx_calendar_action_requests_token
  ON public.calendar_action_requests(requested_by_token_id, created_at DESC);
ALTER TABLE public.calendar_action_requests ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER google_calendar_connections_updated_at
  BEFORE UPDATE ON public.google_calendar_connections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER google_calendar_sources_updated_at
  BEFORE UPDATE ON public.google_calendar_sources
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER calendar_event_links_updated_at
  BEFORE UPDATE ON public.calendar_event_links
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER agent_calendar_grants_updated_at
  BEFORE UPDATE ON public.agent_calendar_grants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER calendar_action_requests_updated_at
  BEFORE UPDATE ON public.calendar_action_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMIT;
