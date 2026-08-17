-- Adds a unique username to profiles so clients can log in with a
-- username instead of their email. Email is still stored in auth.users
-- and still used internally (password reset emails, Supabase Auth
-- itself) — login just resolves username -> email server-side first.

alter table public.profiles
  add column username text unique;

alter table public.profiles
  add constraint profiles_username_format
  check (username is null or username ~ '^[a-z0-9_.]{3,20}$');

-- Backfill existing accounts (created before usernames existed) with a
-- generated username derived from their email, so nobody gets locked
-- out of login. They can change it any time from their profile page.
update public.profiles p
set username = lower(regexp_replace(split_part(u.email, '@', 1), '[^a-z0-9_.]', '', 'g'))
  || '_' || substr(p.id::text, 1, 4)
from auth.users u
where p.id = u.id and p.username is null;
