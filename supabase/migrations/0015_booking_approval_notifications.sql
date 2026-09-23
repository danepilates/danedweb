-- Lets the client see a "your booking was approved" notification (red
-- dot on the nav bar + on the booking card in Mis Reservas) without any
-- realtime/push infra — same read-time-computed pattern used elsewhere
-- in this app (e.g. expired plan detection, the admin pending sweep).
--
-- approval_seen_at is null exactly while a status = 'booked' row
-- represents an approval the client hasn't looked at yet:
--   - Paid-plan bookings insert straight into 'booked' and are seen
--     immediately on /book, so the app sets approval_seen_at = now()
--     on insert for those.
--   - Diario/free-plan bookings insert as 'pending' with
--     approval_seen_at left null. When an admin approves one
--     (pending -> booked), approval_seen_at stays null — that's the
--     notification signal. Visiting /my-bookings clears it.

alter table public.bookings
  add column approval_seen_at timestamptz;

-- check_plan_booking_rules and check_booking_capacity fire on "before
-- insert OR UPDATE" but never checked whether status actually changed,
-- so any column-only update to an already-booked row (e.g. the
-- approval_seen_at backfill below, or the app touching it whenever a
-- client opens Mis Reservas) re-ran the full "new booking" validation:
-- re-decrementing plan_classes_remaining and re-checking slot capacity
-- for a reservation that was already validated when it was created.
-- That's what raised "No te quedan clases disponibles en tu plan" when
-- backfilling below. Both triggers now no-op on an UPDATE that doesn't
-- change status — they only need to run on INSERT (a new row) or on a
-- genuine status transition (e.g. admin approving pending -> booked).
create or replace function public.check_plan_booking_rules()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_plan_type text;
  v_plan_end_date date;
  v_classes_remaining integer;
  v_today date;
  v_now_time time;
  v_daily_count integer;
  v_has_active boolean;
begin
  if TG_OP = 'UPDATE' and old.status = new.status then
    return new;
  end if;

  if new.status not in ('booked', 'pending') then
    return new;
  end if;

  v_today := (now() at time zone 'America/Guayaquil')::date;
  v_now_time := (now() at time zone 'America/Guayaquil')::time;

  select plan_type, plan_end_date, plan_classes_remaining
    into v_plan_type, v_plan_end_date, v_classes_remaining
  from public.profiles
  where id = new.user_id
  for update;

  if v_plan_type <> 'custom' and (v_plan_end_date is null or v_plan_end_date < v_today) then
    v_plan_type := 'free';
  end if;

  if new.status = 'pending' and v_plan_type <> 'free' then
    raise exception 'Solo los clientes del plan Diario crean solicitudes de pago';
  end if;

  if v_plan_type = 'free' then
    select exists (
      select 1 from public.bookings
      where user_id = new.user_id
        and id <> new.id
        and status in ('booked', 'pending')
        and not (status = 'pending' and created_at < now() - interval '15 minutes')
        and (session_date > v_today
             or (session_date = v_today and start_time > v_now_time))
    ) into v_has_active;

    if v_has_active then
      raise exception 'Ya tienes una reserva o solicitud activa. Espera a que se confirme o pase la fecha antes de solicitar otra';
    end if;

    return new;
  end if;

  if v_classes_remaining is null or v_classes_remaining <= 0 then
    raise exception 'No te quedan clases disponibles en tu plan';
  end if;

  select count(*) into v_daily_count
  from public.bookings
  where user_id = new.user_id
    and status = 'booked'
    and session_date = new.session_date
    and id <> new.id;

  if v_daily_count >= 1 then
    raise exception 'Ya tienes una clase reservada ese día';
  end if;

  perform set_config('app.bypass_profile_protection', 'true', true);
  update public.profiles
  set plan_classes_remaining = plan_classes_remaining - 1
  where id = new.user_id;

  return new;
end;
$$;

create or replace function public.check_booking_capacity()
returns trigger
language plpgsql
as $$
declare
  slot_capacity integer;
  current_count integer;
begin
  if TG_OP = 'UPDATE' and old.status = new.status then
    return new;
  end if;

  select capacity into slot_capacity
  from public.schedule_slots
  where id = new.schedule_slot_id
  for update;

  select count(*) into current_count
  from public.bookings
  where schedule_slot_id = new.schedule_slot_id
    and session_date = new.session_date
    and status = 'booked'
    and id <> new.id;

  if new.status = 'booked' and current_count >= slot_capacity then
    raise exception 'Esta sesión ya no tiene cupos disponibles';
  end if;

  return new;
end;
$$;

-- Existing booked rows predate this feature — mark them already seen so
-- the migration doesn't surface a false notification for every client's
-- pre-existing confirmed sessions. Safe now that the triggers above skip
-- no-op status updates.
update public.bookings
set approval_seen_at = now()
where status = 'booked';
