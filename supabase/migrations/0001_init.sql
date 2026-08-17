-- Pilates studio booking system — initial schema
-- Run this once in the Supabase SQL Editor (Dashboard → SQL Editor → New query).

-- ============================================================
-- profiles — one row per auth user, extra app-level fields
-- ============================================================
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  phone text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Admins can view all profiles"
  on public.profiles for select
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
  );

-- Auto-create a profile row whenever someone signs up via Supabase Auth
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- services — the two booking sections: Pilates / Nutrition
-- ============================================================
create table public.services (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

alter table public.services enable row level security;

create policy "Anyone can view services"
  on public.services for select
  using (true);

create policy "Admins can manage services"
  on public.services for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

insert into public.services (slug, name, description) values
  ('pilates', 'Pilates', 'Pilates sessions'),
  ('nutrition', 'Nutrition Assistant', 'Nutrition consultation sessions');

-- ============================================================
-- schedule_slots — recurring weekly template: which hours are
-- offered per service, and how many spots (vacancy) each has.
-- day_of_week: 0 = Sunday ... 6 = Saturday
-- ============================================================
create table public.schedule_slots (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services (id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  start_time time not null,
  duration_minutes integer not null default 60 check (duration_minutes > 0),
  capacity integer not null default 1 check (capacity > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.schedule_slots enable row level security;

create policy "Anyone can view active schedule slots"
  on public.schedule_slots for select
  using (true);

create policy "Admins can manage schedule slots"
  on public.schedule_slots for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

-- ============================================================
-- bookings — a user reserving a specific date's occurrence of
-- a schedule_slot. session_date + schedule_slot_id identify the
-- exact class occurrence; capacity is enforced by trigger below.
-- ============================================================
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  schedule_slot_id uuid not null references public.schedule_slots (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete cascade,
  session_date date not null,
  start_time time not null,
  status text not null default 'booked' check (status in ('booked', 'cancelled')),
  created_at timestamptz not null default now(),
  unique (user_id, schedule_slot_id, session_date)
);

alter table public.bookings enable row level security;

create policy "Users can view own bookings"
  on public.bookings for select
  using (auth.uid() = user_id);

create policy "Admins can view all bookings"
  on public.bookings for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

create policy "Users can create own bookings"
  on public.bookings for insert
  with check (auth.uid() = user_id);

create policy "Users can cancel own bookings"
  on public.bookings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Enforce per-slot capacity (vacancy) at the database level so
-- concurrent bookings can never overbook a session.
create function public.check_booking_capacity()
returns trigger
language plpgsql
as $$
declare
  slot_capacity integer;
  current_count integer;
begin
  -- Lock the slot row so concurrent inserts serialize on this check.
  select capacity into slot_capacity
  from public.schedule_slots
  where id = new.schedule_slot_id
  for update;

  select count(*) into current_count
  from public.bookings
  where schedule_slot_id = new.schedule_slot_id
    and session_date = new.session_date
    and status = 'booked';

  if new.status = 'booked' and current_count >= slot_capacity then
    raise exception 'This session is fully booked';
  end if;

  return new;
end;
$$;

create trigger enforce_booking_capacity
  before insert on public.bookings
  for each row execute function public.check_booking_capacity();
