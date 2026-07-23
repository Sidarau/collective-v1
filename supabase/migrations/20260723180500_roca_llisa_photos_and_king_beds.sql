-- Roca Llisa owner-supplied media from "Mastery Estate - Villa RocaLlisa.pdf".
-- The PDF contains five distinct bedroom photo sets but does not label them
-- with the operating Room 1-9 numbers. Owner approved mapping the sets to
-- Rooms 1-5 in document order. Rooms 6-9 intentionally have no substitute
-- image: the member UI renders an honest "Photo coming soon" state instead.
DO $$
DECLARE
  roca_llisa_id UUID;
BEGIN
  SELECT id
  INTO roca_llisa_id
  FROM public.villas
  WHERE slug = 'roca-llisa'
  LIMIT 1;

  IF roca_llisa_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.villas
  SET
    hero_image = '/villa/roca-llisa/hero-pool-sea.webp',
    images = ARRAY[
      '/villa/roca-llisa/gallery-pool-wide.webp',
      '/villa/roca-llisa/gallery-lap-pool.webp',
      '/villa/roca-llisa/gallery-pool-garden.webp',
      '/villa/roca-llisa/gallery-open-plan.webp',
      '/villa/roca-llisa/gallery-white-lounge.webp',
      '/villa/roca-llisa/gallery-living-room.webp',
      '/villa/roca-llisa/gallery-cinema-lounge.webp',
      '/villa/roca-llisa/gallery-sea-terrace.webp',
      '/villa/roca-llisa/gallery-architecture.webp'
    ]::TEXT[],
    max_guests = 18
  WHERE id = roca_llisa_id;

  -- Every bedroom has a king-size bed and private ensuite bathroom.
  UPDATE public.rooms
  SET
    bed_type = 'King',
    max_guests = 2,
    room_type = CASE WHEN slug = 'room-1' THEN 'master' ELSE 'double' END,
    name = CASE slug
      WHEN 'room-1' THEN 'Room 1 — Master Suite'
      WHEN 'room-2' THEN 'Room 2 — Garden King'
      WHEN 'room-3' THEN 'Room 3 — Pine King'
      WHEN 'room-4' THEN 'Room 4 — Sea King'
      WHEN 'room-5' THEN 'Room 5 — Terrace King'
      WHEN 'room-6' THEN 'Room 6 — Olive King'
      WHEN 'room-7' THEN 'Room 7 — Studio King'
      WHEN 'room-8' THEN 'Room 8 — Court King'
      WHEN 'room-9' THEN 'Room 9 — West King'
      ELSE name
    END,
    description = CASE
      WHEN slug = 'room-1'
        THEN 'King master suite with private ensuite bathroom and sea-facing terrace.'
      ELSE 'King bedroom with private ensuite bathroom.'
    END,
    images = CASE slug
      WHEN 'room-1' THEN ARRAY[
        '/villa/roca-llisa/room-1-cover.webp',
        '/villa/roca-llisa/room-1-terrace.webp'
      ]::TEXT[]
      WHEN 'room-2' THEN ARRAY[
        '/villa/roca-llisa/room-2-cover.webp',
        '/villa/roca-llisa/room-2-bath.webp',
        '/villa/roca-llisa/room-2-dressing.webp'
      ]::TEXT[]
      WHEN 'room-3' THEN ARRAY[
        '/villa/roca-llisa/room-3-cover.webp'
      ]::TEXT[]
      WHEN 'room-4' THEN ARRAY[
        '/villa/roca-llisa/room-4-cover.webp',
        '/villa/roca-llisa/room-4-bath.webp'
      ]::TEXT[]
      WHEN 'room-5' THEN ARRAY[
        '/villa/roca-llisa/room-5-cover.webp',
        '/villa/roca-llisa/room-5-bath.webp'
      ]::TEXT[]
      ELSE ARRAY[]::TEXT[]
    END
  WHERE villa_id = roca_llisa_id
    AND slug IN (
      'room-1',
      'room-2',
      'room-3',
      'room-4',
      'room-5',
      'room-6',
      'room-7',
      'room-8',
      'room-9'
    );
END $$;
