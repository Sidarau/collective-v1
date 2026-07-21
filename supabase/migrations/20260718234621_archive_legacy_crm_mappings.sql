-- Preserve the retired external CRM identifiers before removing them from the
-- live Collective schema. The archive is deliberately kept in a non-exposed
-- schema and is only reachable with privileged server-side credentials.

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;

CREATE TABLE IF NOT EXISTS private.legacy_crm_mappings (
  source_table TEXT NOT NULL CHECK (source_table IN ('leads', 'bookings', 'applications')),
  source_id UUID NOT NULL,
  mapping JSONB NOT NULL,
  archived_reason TEXT NOT NULL DEFAULT 'retired_external_crm',
  archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (source_table, source_id)
);

ALTER TABLE private.legacy_crm_mappings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.legacy_crm_mappings FROM PUBLIC, anon, authenticated;

INSERT INTO private.legacy_crm_mappings (source_table, source_id, mapping)
SELECT
  'leads',
  id,
  jsonb_strip_nulls(jsonb_build_object(
    'external_contact_id', hubspot_contact_id,
    'external_deal_id', hubspot_deal_id
  ))
FROM public.leads
WHERE hubspot_contact_id IS NOT NULL OR hubspot_deal_id IS NOT NULL
ON CONFLICT (source_table, source_id) DO UPDATE
SET mapping = EXCLUDED.mapping,
    archived_reason = EXCLUDED.archived_reason,
    archived_at = NOW();

INSERT INTO private.legacy_crm_mappings (source_table, source_id, mapping)
SELECT
  'bookings',
  id,
  jsonb_build_object('external_deal_id', hubspot_deal_id)
FROM public.bookings
WHERE hubspot_deal_id IS NOT NULL
ON CONFLICT (source_table, source_id) DO UPDATE
SET mapping = EXCLUDED.mapping,
    archived_reason = EXCLUDED.archived_reason,
    archived_at = NOW();

INSERT INTO private.legacy_crm_mappings (source_table, source_id, mapping)
SELECT
  'applications',
  id,
  jsonb_strip_nulls(jsonb_build_object(
    'external_contact_id', hubspot_contact_id,
    'external_deal_id', hubspot_deal_id,
    'was_synced', hubspot_synced
  ))
FROM public.applications
WHERE hubspot_contact_id IS NOT NULL
   OR hubspot_deal_id IS NOT NULL
   OR hubspot_synced IS TRUE
ON CONFLICT (source_table, source_id) DO UPDATE
SET mapping = EXCLUDED.mapping,
    archived_reason = EXCLUDED.archived_reason,
    archived_at = NOW();

DO $$
DECLARE
  source_count INTEGER;
  preserved_count INTEGER;
BEGIN
  WITH current_mappings AS (
    SELECT
      'leads'::TEXT AS source_table,
      id AS source_id,
      jsonb_strip_nulls(jsonb_build_object(
        'external_contact_id', hubspot_contact_id,
        'external_deal_id', hubspot_deal_id
      )) AS mapping
    FROM public.leads
    WHERE hubspot_contact_id IS NOT NULL OR hubspot_deal_id IS NOT NULL

    UNION ALL

    SELECT
      'bookings',
      id,
      jsonb_build_object('external_deal_id', hubspot_deal_id)
    FROM public.bookings
    WHERE hubspot_deal_id IS NOT NULL

    UNION ALL

    SELECT
      'applications',
      id,
      jsonb_strip_nulls(jsonb_build_object(
        'external_contact_id', hubspot_contact_id,
        'external_deal_id', hubspot_deal_id,
        'was_synced', hubspot_synced
      ))
    FROM public.applications
    WHERE hubspot_contact_id IS NOT NULL
       OR hubspot_deal_id IS NOT NULL
       OR hubspot_synced IS TRUE
  )
  SELECT COUNT(*) INTO source_count FROM current_mappings;

  WITH current_mappings AS (
    SELECT
      'leads'::TEXT AS source_table,
      id AS source_id,
      jsonb_strip_nulls(jsonb_build_object(
        'external_contact_id', hubspot_contact_id,
        'external_deal_id', hubspot_deal_id
      )) AS mapping
    FROM public.leads
    WHERE hubspot_contact_id IS NOT NULL OR hubspot_deal_id IS NOT NULL

    UNION ALL

    SELECT
      'bookings',
      id,
      jsonb_build_object('external_deal_id', hubspot_deal_id)
    FROM public.bookings
    WHERE hubspot_deal_id IS NOT NULL

    UNION ALL

    SELECT
      'applications',
      id,
      jsonb_strip_nulls(jsonb_build_object(
        'external_contact_id', hubspot_contact_id,
        'external_deal_id', hubspot_deal_id,
        'was_synced', hubspot_synced
      ))
    FROM public.applications
    WHERE hubspot_contact_id IS NOT NULL
       OR hubspot_deal_id IS NOT NULL
       OR hubspot_synced IS TRUE
  )
  SELECT COUNT(*)
  INTO preserved_count
  FROM current_mappings current
  JOIN private.legacy_crm_mappings archived
    ON archived.source_table = current.source_table
   AND archived.source_id = current.source_id
   AND archived.mapping = current.mapping;

  IF source_count <> preserved_count THEN
    RAISE EXCEPTION
      'Legacy CRM archive verification failed: expected %, preserved %',
      source_count,
      preserved_count;
  END IF;
END;
$$;

DROP INDEX IF EXISTS public.idx_bookings_hubspot_deal_id;

ALTER TABLE public.leads
  DROP COLUMN IF EXISTS hubspot_contact_id,
  DROP COLUMN IF EXISTS hubspot_deal_id;

ALTER TABLE public.bookings
  DROP COLUMN IF EXISTS hubspot_deal_id;

ALTER TABLE public.applications
  DROP COLUMN IF EXISTS hubspot_contact_id,
  DROP COLUMN IF EXISTS hubspot_deal_id,
  DROP COLUMN IF EXISTS hubspot_synced;
