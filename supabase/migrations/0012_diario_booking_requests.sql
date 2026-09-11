-- Free/"Diario"-plan bookings now go through a payment-verification
-- request instead of confirming instantly:
--
--   1. A Diario user "reserves" -> a booking row is created with
--      status = 'pending' (does NOT count toward slot capacity, since
--      every capacity/attendee query already filters status = 'booked').
--   2. The user has 15 minutes to send a WhatsApp payment receipt and
--      may mark "Ya realicé el pago" (sets payment_reported_at, purely
--      informational for the admin).
--   3. An admin approves (-> 'booked', now counts toward capacity) or
--      rejects (-> 'rejected') from the same "Próximas reservas" view.
--   4. If nobody approves within 15 minutes, the request is treated as
--      expired: excluded from the "only one active reservation" check
--      at read-time (no cron needed), and lazily flipped to 'rejected'
--      the next time the admin view loads so the record isn't stuck
--      showing as an actionable pending request forever.
--
-- Paid plans (silver/gold/vip) are completely unaffected — their
-- bookings still insert straight into 'booked' as before.

alter table public.bookings
  add column payment_reported_at timestamptz;

-- Loosen the status check constraint to allow the two new values,
-- regardless of what Postgres auto-named it in 0001.
do $$
declare
  v_conname text;
begin
  select conname into v_conname
  from pg_constraint
  where conrelid = 'public.bookings'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%status%';

  if v_conname is not null then
    execute format('alter table public.bookings drop constraint %I', v_conname);
  end if;
end $$;

alter table public.bookings
  add constraint bookings_status_check
  check (status in ('booked', 'cancelled', 'pending', 'rejected'));

-- Admins need to update OTHER users' booking rows to approve/reject
-- requests (and to sweep expired ones) — previously the only UPDATE
-- policy was "Users can cancel own bookings", scoped to auth.uid().
create policy "Admins can update any booking"
  on public.bookings for update
  using (public.is_admin())
  with check (public.is_admin());

-- Close a self-approval hole: without this, a non-admin could PATCH
-- their own pending row's status straight to 'booked' via a raw REST
-- call, skipping the payment-verification gate entirely (the existing
-- immutable-fields trigger only locked which slot/date/service a
-- booking points at, never the status transition itself). A non-admin
-- can still cancel a genuinely 'booked' reservation as before — this
-- only freezes status once a row is 'pending', since only an admin
-- (or the expiry sweep, which also runs as an admin) may move it out
-- of that state.
create or replace function public.protect_booking_immutable_fields()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    new.user_id := old.user_id;
    new.schedule_slot_id := old.schedule_slot_id;
    new.service_id := old.service_id;
    new.session_date := old.session_date;
    new.start_time := old.start_time;

    if old.status = 'pending' then
      new.status := old.status;
    end if;
  end if;
  return new;
end;
$$;

-- Extends the plan-rules trigger to also validate 'pending' inserts
-- (previously anything other than 'booked' skipped all rule checking,
-- which would have let a Diario user's pending request bypass the
-- "only one active reservation" rule entirely). Only a free/Diario
-- profile may ever create a 'pending' row; paid plans always insert
-- straight into 'booked' from the app, but this guards the DB layer
-- too. A 'pending' row that's past the 15-minute window is ignored by
-- the "do you already have one" check, so an expired request never
-- permanently blocks the user even before the admin-side sweep runs.
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
  v_week_start date;
  v_week_end date;
  v_daily_count integer;
  v_weekly_count integer;
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

  if v_plan_end_date is null or v_plan_end_date < v_today then
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

  if v_plan_type in ('gold', 'vip') then
    v_week_start := new.session_date - (extract(isodow from new.session_date)::int - 1);
    v_week_end := v_week_start + 6;

    select count(*) into v_weekly_count
    from public.bookings
    where user_id = new.user_id
      and status = 'booked'
      and session_date between v_week_start and v_week_end
      and id <> new.id;

    if v_weekly_count >= 5 then
      raise exception 'Ya reservaste el máximo de 5 clases esta semana';
    end if;
  end if;

  perform set_config('app.bypass_profile_protection', 'true', true);
  update public.profiles
  set plan_classes_remaining = plan_classes_remaining - 1
  where id = new.user_id;

  return new;
end;
$$;
