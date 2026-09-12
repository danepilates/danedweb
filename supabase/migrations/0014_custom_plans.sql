-- Custom plans: the admin sets an arbitrary number of paid sessions for
-- a client who wants more than one class but doesn't want Gold/VIP.
-- Unlike Silver/Gold/VIP, a custom plan never carries a plan_end_date —
-- it only ends when the class balance (plan_classes_remaining) hits 0,
-- so the usual "expired once plan_end_date passes" check is skipped for
-- this type both here and in lib/plan.ts's getEffectivePlanType.

do $$
declare
  v_conname text;
begin
  select conname into v_conname
  from pg_constraint
  where conrelid = 'public.profiles'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%plan_type%';

  if v_conname is not null then
    execute format('alter table public.profiles drop constraint %I', v_conname);
  end if;
end $$;

alter table public.profiles
  add constraint profiles_plan_type_check
  check (plan_type in ('free', 'silver', 'gold', 'vip', 'custom'));

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

-- Refund on cancel also needs to recognize 'custom' and skip its
-- (always-null) plan_end_date check.
create or replace function public.refund_plan_class_on_cancel()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_plan_type text;
  v_plan_end_date date;
  v_today date;
begin
  if old.status = 'booked' and new.status = 'cancelled' then
    v_today := (now() at time zone 'America/Guayaquil')::date;

    select plan_type, plan_end_date into v_plan_type, v_plan_end_date
    from public.profiles
    where id = new.user_id;

    if v_plan_type = 'custom'
       or (v_plan_type in ('silver', 'gold', 'vip')
           and v_plan_end_date is not null and v_plan_end_date >= v_today) then
      perform set_config('app.bypass_profile_protection', 'true', true);
      update public.profiles
      set plan_classes_remaining = plan_classes_remaining + 1
      where id = new.user_id;
    end if;
  end if;

  return new;
end;
$$;
