-- Follow-up to atomic_stay_request_approval: waitlisted requests may share a
-- placeholder room. Allow an owner to explicitly choose another room while
-- preserving the same price already quoted on the request.

create or replace function public.approve_stay_request_with_room(
  p_booking_id uuid,
  p_expected_status text,
  p_target_room_id uuid,
  p_note text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
  v_original_room public.rooms%rowtype;
  v_room public.rooms%rowtype;
  v_target_room_id uuid;
  v_row_count integer := 0;
begin
  if p_expected_status not in ('requested', 'waitlisted') then
    raise exception using
      errcode = '22023',
      message = 'expected status must be requested or waitlisted';
  end if;

  select *
    into v_booking
    from public.bookings
   where id = p_booking_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'Stay request not found';
  end if;

  if v_booking.status = 'approved' then
    return jsonb_build_object(
      'booking_id', v_booking.id,
      'changed', false,
      'from_status', 'approved',
      'status', 'approved',
      'check_in', v_booking.check_in,
      'check_out', v_booking.check_out,
      'user_id', v_booking.user_id,
      'from_room_id', v_booking.room_id,
      'room_id', v_booking.room_id
    );
  end if;

  v_target_room_id := coalesce(p_target_room_id, v_booking.room_id);

  select *
    into v_original_room
    from public.rooms
   where id = v_booking.room_id;

  select *
    into v_room
    from public.rooms
   where id = v_target_room_id
     and villa_id = v_booking.villa_id;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'Target room does not belong to this gate';
  end if;

  if v_room.max_guests < v_booking.guests then
    raise exception using
      errcode = 'P0001',
      message = 'Target room cannot hold this guest count';
  end if;

  if v_room.base_price_per_night <> v_original_room.base_price_per_night
     or v_room.currency <> v_original_room.currency then
    raise exception using
      errcode = 'P0001',
      message = 'Target room has a different price; change pricing in the console first';
  end if;

  -- Serialize all approvals targeting this room, then lock/re-read the booking.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_target_room_id::text, 0)
  );

  select *
    into v_booking
    from public.bookings
   where id = p_booking_id
   for update;

  if v_booking.status = 'approved' then
    return jsonb_build_object(
      'booking_id', v_booking.id,
      'changed', false,
      'from_status', 'approved',
      'status', 'approved',
      'check_in', v_booking.check_in,
      'check_out', v_booking.check_out,
      'user_id', v_booking.user_id,
      'from_room_id', v_booking.room_id,
      'room_id', v_booking.room_id
    );
  end if;

  if v_booking.status <> p_expected_status
     or v_booking.status not in ('requested', 'waitlisted') then
    raise exception using
      errcode = 'P0001',
      message = pg_catalog.format(
        'Stay request status changed: expected %s, found %s',
        p_expected_status,
        v_booking.status
      );
  end if;

  if exists (
    select 1
      from public.closure_periods c
     where c.villa_id = v_booking.villa_id
       and (c.room_id is null or c.room_id = v_target_room_id)
       and c.starts_on < v_booking.check_out
       and (c.ends_on is null or c.ends_on >= v_booking.check_in)
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'The house or room is closed for part of this window';
  end if;

  if exists (
    select 1
      from public.availability_blocks b
     where b.room_id = v_target_room_id
       and b.status <> 'available'
       and b.date >= v_booking.check_in
       and b.date < v_booking.check_out
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'The room is unavailable for part of this window';
  end if;

  if exists (
    select 1
      from public.bookings other
     where other.room_id = v_target_room_id
       and other.id <> v_booking.id
       and other.status in ('approved', 'deposit_paid', 'paid', 'confirmed')
       and other.check_in < v_booking.check_out
       and other.check_out > v_booking.check_in
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'Conflict: that room is already committed for part of this window';
  end if;

  update public.bookings
     set status = 'approved',
         room_id = v_target_room_id,
         operator_notes = case
           when nullif(pg_catalog.btrim(p_note), '') is null
             then operator_notes
           when operator_notes is null or operator_notes = ''
             then pg_catalog.btrim(p_note)
           else operator_notes || E'\n' || pg_catalog.btrim(p_note)
         end
   where id = v_booking.id
     and status = p_expected_status;

  get diagnostics v_row_count = row_count;
  if v_row_count <> 1 then
    raise exception using
      errcode = '40001',
      message = 'Stay request changed during approval; retry from a fresh read';
  end if;

  return jsonb_build_object(
    'booking_id', v_booking.id,
    'changed', true,
    'from_status', v_booking.status,
    'status', 'approved',
    'check_in', v_booking.check_in,
    'check_out', v_booking.check_out,
    'user_id', v_booking.user_id,
    'from_room_id', v_booking.room_id,
    'room_id', v_target_room_id
  );
end;
$$;

revoke execute on function public.approve_stay_request_with_room(uuid, text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.approve_stay_request_with_room(uuid, text, uuid, text)
  to service_role;
