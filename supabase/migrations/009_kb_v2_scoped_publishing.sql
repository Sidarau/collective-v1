-- KB v2: immutable HTML revisions, tiered agent tokens, tree grants,
-- external password/NDA shares, legal acceptance evidence, redacted audit.
-- Additive + idempotent — safe to apply to production (evviegqieqdmlxixwwxt).
-- Implements ADR 0001 (docs/adr/0001-…) for ZEUG-446/451/454/455.

-- ---------------------------------------------------------------- Tiered agent tokens
ALTER TABLE public.agent_tokens
  ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'owner'
    CHECK (scope IN ('owner', 'staff'));

-- ---------------------------------------------------------------- Immutable revisions
CREATE TABLE IF NOT EXISTS public.kb_revisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  node_id UUID NOT NULL REFERENCES public.kb_nodes(id) ON DELETE CASCADE,
  markdown TEXT NOT NULL,
  html TEXT NOT NULL,                       -- sanitized, rendered from an approved template
  template TEXT NOT NULL DEFAULT 'article' CHECK (template IN ('article', 'brief', 'deck')),
  theme JSONB NOT NULL DEFAULT '{}',
  content_hash TEXT NOT NULL,               -- sha256(markdown + template + renderer_version)
  renderer_version INTEGER NOT NULL DEFAULT 1,
  source_ref TEXT,                          -- e.g. second-brain path / commit
  author_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  author_email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_kb_revisions_node ON public.kb_revisions(node_id, created_at DESC);

-- Published-revision pointer on the stable node.
ALTER TABLE public.kb_nodes
  ADD COLUMN IF NOT EXISTS published_revision_id UUID REFERENCES public.kb_revisions(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------- Tree grants (inherit down; default deny)
CREATE TABLE IF NOT EXISTS public.kb_grants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  node_id UUID NOT NULL REFERENCES public.kb_nodes(id) ON DELETE CASCADE,
  audience TEXT NOT NULL CHECK (audience IN ('operator', 'staff', 'member', 'vendor')),
  effect TEXT NOT NULL DEFAULT 'allow' CHECK (effect IN ('allow', 'deny')),
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (node_id, audience)
);
CREATE INDEX IF NOT EXISTS idx_kb_grants_node ON public.kb_grants(node_id);

-- ---------------------------------------------------------------- Legal documents (versioned, immutable)
CREATE TABLE IF NOT EXISTS public.legal_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  title TEXT NOT NULL,
  body_md TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  effective_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (slug, version)
);

-- ---------------------------------------------------------------- External shares (recipient × pinned revision)
CREATE TABLE IF NOT EXISTS public.external_shares (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  node_id UUID NOT NULL REFERENCES public.kb_nodes(id) ON DELETE CASCADE,
  revision_id UUID NOT NULL REFERENCES public.kb_revisions(id) ON DELETE CASCADE,
  recipient_label TEXT NOT NULL,
  token_hash TEXT UNIQUE NOT NULL,          -- sha256 of the URL token (token shown once)
  token_prefix TEXT NOT NULL,               -- first chars, for operator identification only
  password_hash TEXT NOT NULL,              -- bcrypt cost >= 12 (password shown once)
  require_nda BOOLEAN NOT NULL DEFAULT FALSE,
  legal_document_id UUID REFERENCES public.legal_documents(id) ON DELETE SET NULL,
  watermark BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at TIMESTAMPTZ,
  max_views INTEGER,
  view_count INTEGER NOT NULL DEFAULT 0,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_external_shares_token ON public.external_shares(token_hash);
CREATE INDEX IF NOT EXISTS idx_external_shares_node ON public.external_shares(node_id);

-- ---------------------------------------------------------------- Legal acceptances (append-only evidence)
CREATE TABLE IF NOT EXISTS public.legal_acceptances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  share_id UUID REFERENCES public.external_shares(id) ON DELETE CASCADE,
  legal_document_id UUID NOT NULL REFERENCES public.legal_documents(id) ON DELETE CASCADE,
  legal_version INTEGER NOT NULL,
  legal_hash TEXT NOT NULL,
  typed_name TEXT NOT NULL,
  ip_hash TEXT,                             -- hashed, never raw IP
  ua_hash TEXT,
  accepted_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_legal_acceptances_share ON public.legal_acceptances(share_id);

-- ---------------------------------------------------------------- Access events (redacted audit)
-- Never stores document bodies, tokens, passwords, hashes, raw IP, or external emails.
CREATE TABLE IF NOT EXISTS public.access_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  principal_kind TEXT NOT NULL,             -- owner|operator|member|vendor|agent|external_share|public
  principal_id TEXT,                        -- user id / token id / share id (opaque), never a secret
  capability TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  decision TEXT NOT NULL CHECK (decision IN ('allow', 'deny')),
  reason TEXT,
  request_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_access_events_created ON public.access_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_events_decision ON public.access_events(decision, created_at DESC);

-- ---------------------------------------------------------------- RLS (service-role-only, matches existing model)
ALTER TABLE public.kb_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_acceptances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_events ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------- Triggers
CREATE TRIGGER external_shares_updated_at BEFORE UPDATE ON public.external_shares
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
