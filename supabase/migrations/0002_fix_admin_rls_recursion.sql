-- Fixes: "infinite recursion detected in policy for relation profiles"
--
-- The original "Admins can view all profiles" policy queried
-- public.profiles from within a policy defined on public.profiles itself,
-- which re-triggers RLS evaluation on profiles recursively. Same problem
-- existed (or would eventually bite) on services/schedule_slots/bookings,
-- since their admin policies also query profiles.
--
-- Fix: centralize the admin check in a SECURITY DEFINER function. It runs
-- with the function owner's privileges (table owner), which bypasses RLS,
-- so it can read is_admin without re-triggering these policies.

create function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

drop policy "Admins can view all profiles" on public.profiles;
create policy "Admins can view all profiles"
  on public.profiles for select
  using (public.is_admin());

drop policy "Admins can manage services" on public.services;
create policy "Admins can manage services"
  on public.services for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy "Admins can manage schedule slots" on public.schedule_slots;
create policy "Admins can manage schedule slots"
  on public.schedule_slots for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy "Admins can view all bookings" on public.bookings;
create policy "Admins can view all bookings"
  on public.bookings for select
  using (public.is_admin());
