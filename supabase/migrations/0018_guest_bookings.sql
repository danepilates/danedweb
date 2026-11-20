-- Lets an admin book a session on behalf of someone without an account
-- (older clients, people without internet access). A guest booking has
-- no user_id, just the name the admin typed (guest_name) and which admin
-- created it (created_by).
--
-- Guest bookings skip every plan rule (no class deduction, no Diario
-- payment request, no "one active reservation" limit) since there's no
-- profile/plan behind them, but they still count against the slot's
-- capacity like any other 'booked' row (check_booking_capacity doesn't
-- look at user_id), so clients in the app never see spots that are
-- actually taken.
--
-- Only admins can create them: the client INSERT policy requires
-- auth.uid() = user_id, which can never hold for a null user_id, so the
-- "Admins can create any booking" policy (0017) is the only way in. The
-- check constraint keeps each row either an account booking or a guest
-- booking, never both or neither.

alter table public.bookings
  alter column user_id drop not null,
  add column guest_name text,
  -- Deliberately no foreign key: a second bookings -> profiles relation
  -- would make the existing profiles(...) embeds in PostgREST queries
  -- ambiguous and break them.
  add column created_by uuid,
  add constraint bookings_account_or_guest check (
    (user_id is not null and guest_name is null)
    or (user_id is null and guest_name is not null
        and char_length(btrim(guest_name)) between 1 and 100)
  );

-- Same body as 0015, plus the guest early-return: there's no profile to
-- read a plan from, and guest bookings are exempt from plan rules.
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
