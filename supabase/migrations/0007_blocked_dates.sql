-- Lets the admin close the studio on specific calendar dates (holidays,
-- maintenance, etc.), independent of the recurring weekly schedule.
-- Applies to all services — a blocked date closes the whole studio.

create table public.blocked_dates (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  reason text,
  created_at timestamptz not null default now()
);

alter table public.blocked_dates enable row level security;

create policy "Anyone can view blocked dates"
  on public.blocked_dates for select
  using (true);

create policy "Admins can manage blocked dates"
  on public.blocked_dates for all
  using (public.is_admin())
  with check (public.is_admin());
