-- Security hardening pass.
--
-- 1) profiles: "Users can update own profile" has no WITH CHECK beyond
--    id = auth.uid(), so a non-admin could PATCH is_admin / plan dates
--    directly via the REST API (our UI never exposes those fields, but
--    RLS — not the UI — is the real security boundary). A BEFORE UPDATE
--    trigger resets those columns to their prior value unless the actor
--    is already an admin.
create function public.protect_privileged_profile_fields()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    new.is_admin := old.is_admin;
    new.plan_start_date := old.plan_start_date;
    new.plan_end_date := old.plan_end_date;
  end if;
  return new;
end;
$$;

create trigger protect_privileged_profile_fields_trigger
  before update on public.profiles
  for each row execute function public.protect_privileged_profile_fields();

-- 2) bookings: "Users can cancel own bookings" only checks user_id,
-- so a user could change schedule_slot_id/session_date/start_time on
-- their own row via UPDATE to move into a different (possibly full)
-- session, bypassing the capacity trigger (INSERT-only) entirely.
-- Lock every column except status for non-admins.
create function public.protect_booking_immutable_fields()
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
  end if;
  return new;
end;
$$;

create trigger protect_booking_immutable_fields_trigger
  before update on public.bookings
  for each row execute function public.protect_booking_immutable_fields();

-- Capacity trigger was INSERT-only, so re-activating a cancelled booking
-- (status: cancelled -> booked) via UPDATE skipped the capacity check.
-- Also excludes the row's own id from the count so a legitimate UPDATE
-- to an already-booked row (e.g. by an admin) doesn't count itself
-- against capacity.
create or replace function public.check_booking_capacity()
returns trigger
language plpgsql
as $$
declare
  slot_capacity integer;
  current_count integer;
begin
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

drop trigger enforce_booking_capacity on public.bookings;
create trigger enforce_booking_capacity
  before insert or update on public.bookings
  for each row execute function public.check_booking_capacity();

-- 3) Bound free-text fields against abusive oversized payloads (defense
-- in depth alongside app-level trimming/validation).
alter table public.profiles
  add constraint profiles_full_name_len check (char_length(full_name) <= 200),
  add constraint profiles_phone_len check (char_length(phone) <= 30),
  add constraint profiles_medical_conditions_len check (char_length(medical_conditions) <= 2000),
  add constraint profiles_injuries_len check (char_length(injuries) <= 2000),
  add constraint profiles_allergies_len check (char_length(allergies) <= 2000);

-- 4) Rate limiting store — a generic (key, timestamp) hit log the app
-- queries/purges from server actions using the service-role client.
-- RLS is enabled with NO policies, so anon/authenticated roles have zero
-- access; only service_role (which bypasses RLS) can touch it.
create table public.rate_limit_hits (
  id bigint generated always as identity primary key,
  key text not null,
  created_at timestamptz not null default now()
);

create index rate_limit_hits_key_created_idx on public.rate_limit_hits (key, created_at);

alter table public.rate_limit_hits enable row level security;
