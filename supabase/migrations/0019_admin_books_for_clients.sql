-- Lets an admin book sessions on behalf of a client with an account
-- (e.g. a client who doesn't know how to use the app asks the studio to
-- book three classes for them). The bookings are the client's own rows
-- (user_id = the client), so they show up in the client's Mis Reservas
-- and under their name in the attendee list.
--
-- Paid plans are unaffected: the admin's booking deducts a session and
-- keeps the one-class-per-day rule, exactly like a booking the client
-- makes themselves.
--
-- Diario/free-plan clients normally get one active reservation at a time
-- and go through the payment-verification request. When an admin books
-- for them, the studio has already taken payment in person, so the app
-- inserts straight into 'booked' and this trigger now skips the
-- "one active reservation" limit — but only when an admin is booking for
-- someone else (auth.uid() <> user_id), never for the admin's own
-- bookings or for a client booking themselves.
--
-- Same body as 0018 otherwise.
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

  if new.user_id is null then
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
    if public.is_admin() and auth.uid() is distinct from new.user_id then
      return new;
    end if;

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
