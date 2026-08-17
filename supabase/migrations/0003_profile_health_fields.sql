-- Adds health/personal fields to profiles, an avatar upload bucket, and an
-- admin-extensible custom-field system for the client profile.

-- ============================================================
-- profiles — health fields (age, height, weight, medical notes)
-- ============================================================
alter table public.profiles
  add column avatar_url text,
  add column age integer check (age is null or age > 0),
  add column height_cm numeric check (height_cm is null or height_cm > 0),
  add column weight_kg numeric check (weight_kg is null or weight_kg > 0),
  add column medical_conditions text,
  add column injuries text,
  add column allergies text;

-- Admins need to edit client profiles (e.g. correcting health info), not
-- just view them.
create policy "Admins can update any profile"
  on public.profiles for update
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================
-- custom_fields — admin-defined extra profile questions
-- ============================================================
create table public.custom_fields (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  field_type text not null default 'text' check (field_type in ('text', 'number', 'boolean')),
  required boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.custom_fields enable row level security;

create policy "Anyone can view custom fields"
  on public.custom_fields for select
  using (true);

create policy "Admins can manage custom fields"
  on public.custom_fields for all
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================
-- profile_custom_values — each client's answers to custom fields
-- ============================================================
create table public.profile_custom_values (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  field_id uuid not null references public.custom_fields (id) on delete cascade,
  value text,
  updated_at timestamptz not null default now(),
  unique (profile_id, field_id)
);

alter table public.profile_custom_values enable row level security;

create policy "Users can view own custom values"
  on public.profile_custom_values for select
  using (auth.uid() = profile_id);

create policy "Users can upsert own custom values"
  on public.profile_custom_values for insert
  with check (auth.uid() = profile_id);

create policy "Users can update own custom values"
  on public.profile_custom_values for update
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

create policy "Admins can view all custom values"
  on public.profile_custom_values for select
  using (public.is_admin());

create policy "Admins can manage all custom values"
  on public.profile_custom_values for all
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================
-- avatars — public storage bucket for profile pictures, one
-- folder per user (<user_id>/filename), user manages own folder
-- ============================================================
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "Avatar images are publicly readable"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "Users can upload their own avatar"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can update their own avatar"
  on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can delete their own avatar"
  on storage.objects for delete
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
