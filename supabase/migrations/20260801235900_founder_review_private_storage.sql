-- Private founder-review evidence. No object policies are created: only the
-- server-side service client may read or sign these files.
INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'founder-review',
  'founder-review',
  false,
  52428800,
  ARRAY[
    'application/pdf',
    'application/zip',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/png',
    'text/html',
    'text/markdown'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
