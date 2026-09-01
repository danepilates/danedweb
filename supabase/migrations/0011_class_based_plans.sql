-- Replaces the Free/Full-Plan binary system with 4 tiers, each with a
-- class quota that's decremented on booking and refunded on cancel.
-- Business rules enforced at the DB level (trigger), not just in app
-- code, so a crafted direct REST API call can't bypass them:
--
--   free   — no purchased quota; only 1 upcoming reservation at a time,
--            can't book the next until the current one's time has passed
--   silver — 12 classes / 30 days, max 1 class/day
--   gold   — 20 classes / 30 days, max 1 class/day, max 5/calendar week
--   vip    — 60 classes / 90 days, max 1 class/day, max 5/calendar week
--
-- Existing plan_start_date/plan_end_date columns are reused for the
-- paid-plan period. Unused classes are lost when the period ends (no
-- rollover) — the effective plan is computed as "free" once
-- plan_end_date passes, same read-time pattern as before (no cron job).

alter table public.profiles
  add column plan_type text not null default 'free'
    check (plan_type in ('free', 'silver', 'gold', 'vip')),
  add column plan_classes_total integer,
  add column plan_classes_remaining integer,
  add constraint profiles_plan_classes_range check (
    plan_classes_remaining is null
    or (plan_classes_remaining >= 0
        and (plan_classes_total is null or plan_classes_remaining <= plan_classes_total))
  );

-- Existing profiles had no class-based plan concept — reset everyone to
-- Free rather than guess a mapping from the old date-range "Full Plan".
update public.profiles
set plan_type = 'free', plan_start_date = null, plan_end_date = null,
    plan_classes_total = null, plan_classes_remaining = null;

-- Re-protect privileged profile fields, now including the new plan
-- columns, so a non-admin can't grant themselves a paid plan via a
-- direct REST PATCH. Includes a transaction-local bypass flag so the
-- trigger below (SECURITY DEFINER, runs as the booking user) can still
-- legitimately decrement/refund the class balance as a side effect of
-- booking/cancelling — auth.uid() inside SECURITY DEFINER still
-- resolves to the real caller, so without this bypass the protection
-- trigger would silently undo our own balance updates.
create or replace function public.protect_privileged_profile_fields()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if current_setting('app.bypass_profile_protection', true) = 'true' then
    return new;
  end if;

  if not public.is_admin() then
    new.is_admin := old.is_admin;
    new.plan_start_date := old.plan_start_date;
    new.plan_end_date := old.plan_end_date;
    new.plan_type := old.plan_type;
    new.plan_classes_total := old.plan_classes_total;
    new.plan_classes_remaining := old.plan_classes_remaining;
  end if;
  return new;
end;
$$;

-- Trigger execution order matters here: Postgres fires same-kind
-- triggers in alphabetical order by name. We need the immutable-fields
-- guard to run BEFORE the capacity/plan-rules checks on UPDATE, so a
-- crafted update can't get session_date/schedule_slot_id evaluated
-- against attacker-supplied values that then get silently reset after
-- the checks already ran. Renaming with numeric prefixes makes the
-- order explicit rather than relying on incidental alphabetization.
alter trigger protect_booking_immutable_fields_trigger on public.bookings
  rename to trg_10_protect_booking_immutable_fields;
alter trigger enforce_booking_capacity on public.bookings
  rename to trg_20_enforce_booking_capacity;

-- Enforces plan booking rules and decrements the class balance.
create function public.check_plan_booking_rules()
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
  v_has_pending boolean;
begin
  if new.status <> 'booked' then
    return new;
  end if;

  v_today := (now() at time zone 'America/Guayaquil')::date;
  v_now_time := (now() at time zone 'America/Guayaquil')::time;

  select plan_type, plan_end_date, plan_classes_remaining
    into v_plan_type, v_plan_end_date, v_classes_remaining
  from public.profiles
  where id = new.user_id
  for update;

  -- Expired paid plan behaves as free (mirrors the app's read-time
  -- getEffectivePlanType — no cron needed to "revert" the stored value).
  if v_plan_end_date is null or v_plan_end_date < v_today then
    v_plan_type := 'free';
  end if;

  if v_plan_type = 'free' then
    select exists (
      select 1 from public.bookings
      where user_id = new.user_id
        and status = 'booked'
        and id <> new.id
        and (session_date > v_today
             or (session_date = v_today and start_time > v_now_time))
    ) into v_has_pending;

    if v_has_pending then
      raise exception 'Debes esperar a que pase tu clase reservada antes de reservar otra';
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

create trigger trg_20_enforce_plan_booking_rules
  before insert or update on public.bookings
  for each row execute function public.check_plan_booking_rules();

-- Refunds a class back to the balance when a paid-plan booking is
-- cancelled — but only while the plan is still active; if it already
-- expired, the classes were already lost per the no-rollover rule.
create function public.refund_plan_class_on_cancel()
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

    if v_plan_type in ('silver', 'gold', 'vip')
       and v_plan_end_date is not null and v_plan_end_date >= v_today then
      perform set_config('app.bypass_profile_protection', 'true', true);
      update public.profiles
      set plan_classes_remaining = plan_classes_remaining + 1
      where id = new.user_id;
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_30_refund_plan_class_on_cancel
  before update on public.bookings
  for each row execute function public.refund_plan_class_on_cancel();
