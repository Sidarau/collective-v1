-- Real Roca Llisa inventory: the estate tracks 9 numbered rooms (Room 1-9,
-- single/double mix per the Mastery Estate rentals sheet). Preserve the three
-- existing rows (they carry booking/availability FKs) by renaming them, then
-- add Rooms 4-9. Copy/photos are placeholders to refine in the console.
-- Applied to project iudicmvyihswhvgmyvcf on 2026-07-02 via Supabase MCP.
DO $$
DECLARE
  v_id UUID;
BEGIN
  SELECT id INTO v_id FROM public.villas WHERE slug = 'roca-llisa' LIMIT 1;
  IF v_id IS NULL THEN RETURN; END IF;

  UPDATE public.rooms SET name = 'Room 1 — Master Suite', slug = 'room-1', room_type = 'master',
    bed_type = 'King', max_guests = 2, base_price_per_night = 45000,
    description = COALESCE(description, 'Spacious master with ensuite and terrace.')
    WHERE villa_id = v_id AND slug = 'master-suite';

  UPDATE public.rooms SET name = 'Room 2 — Garden Double', slug = 'room-2', room_type = 'double',
    bed_type = 'Queen', max_guests = 2, base_price_per_night = 35000
    WHERE villa_id = v_id AND slug = 'double-room';

  UPDATE public.rooms SET name = 'Room 3 — Pine Twin', slug = 'room-3', room_type = 'single',
    bed_type = 'Twin', max_guests = 2, base_price_per_night = 28000
    WHERE villa_id = v_id AND slug = 'twin-room';

  INSERT INTO public.rooms (villa_id, name, slug, description, room_type, max_guests, bed_type, base_price_per_night, currency, amenities, images)
  VALUES
    (v_id, 'Room 4 — Sea Double', 'room-4', 'East-facing double with morning light. Details from the house soon.', 'double', 2, 'Queen', 35000, 'EUR', ARRAY['Sea view'], ARRAY['https://images.unsplash.com/photo-1595576508898-0ad5c879a061?q=80&w=1800&auto=format&fit=crop']),
    (v_id, 'Room 5 — Terrace Double', 'room-5', 'Opens onto the upper terrace. Details from the house soon.', 'double', 2, 'Queen', 35000, 'EUR', ARRAY['Terrace'], ARRAY['https://images.unsplash.com/photo-1590490360182-c33d57733427?q=80&w=1800&auto=format&fit=crop']),
    (v_id, 'Room 6 — Olive Double', 'room-6', 'Quiet double over the olive garden. Details from the house soon.', 'double', 2, 'Queen', 32000, 'EUR', ARRAY['Garden view'], ARRAY['https://images.unsplash.com/photo-1611892440504-42a792e24d32?q=80&w=1800&auto=format&fit=crop']),
    (v_id, 'Room 7 — Studio Twin', 'room-7', 'Flexible twin near the studio. Details from the house soon.', 'single', 2, 'Twin', 28000, 'EUR', ARRAY['Pool view'], ARRAY['https://images.unsplash.com/photo-1595576508898-0ad5c879a061?q=80&w=1800&auto=format&fit=crop']),
    (v_id, 'Room 8 — Court Twin', 'room-8', 'Twin beside the inner court. Details from the house soon.', 'single', 2, 'Twin', 28000, 'EUR', ARRAY['Courtyard'], ARRAY['https://images.unsplash.com/photo-1590490360182-c33d57733427?q=80&w=1800&auto=format&fit=crop']),
    (v_id, 'Room 9 — West Twin', 'room-9', 'Sunset-side twin. Details from the house soon.', 'single', 2, 'Twin', 28000, 'EUR', ARRAY['Sunset view'], ARRAY['https://images.unsplash.com/photo-1611892440504-42a792e24d32?q=80&w=1800&auto=format&fit=crop'])
  ON CONFLICT (villa_id, slug) DO NOTHING;

  UPDATE public.villas SET max_guests = 18 WHERE id = v_id;
END $$;
