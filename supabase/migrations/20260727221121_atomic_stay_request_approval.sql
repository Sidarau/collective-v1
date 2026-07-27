-- Atomically approve one requested/waitlisted stay.
--
-- The application authorizes the caller before invoking this function. The
-- database function is deliberately invoker-security and executable only by
-- service_role, so it cannot become a public Data API privilege escalation.
-- A room-scoped advisory lock closes the race where two overlapping requests
-- could otherwise both pass availability checks before either update lands.

create or replace function public.approve_stay_request(
  p_booking_id uuid,
  p_expected_status text,
  p_note text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
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

  -- Serialize decisions for one room, then re-read under a row lock so every
  -- availability check below is based on the latest committed state.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_booking.room_id::text, 0)
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
      'user_id', v_booking.user_id
    );
  end if;

  if v_booking.status <> p_expected_status
     or v_booking.status not in ('requested', 'waitlisted') then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Stay request status changed: expected %s, found %s',
        p_expected_status,
        v_booking.status
      );
  end if;

  if exists (
    select 1
      from public.closure_periods c
     where c.villa_id = v_booking.villa_id
       and (c.room_id is null or c.room_id = v_booking.room_id)
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
     where b.room_id = v_booking.room_id
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
     where other.room_id = v_booking.room_id
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
    'user_id', v_booking.user_id
  );
end;
$$;

revoke execute on function public.approve_stay_request(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.approve_stay_request(uuid, text, text)
  to service_role;
