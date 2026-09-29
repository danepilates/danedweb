-- Replaces the manually-entered age with a birth date, so age is always
-- computed (never goes stale) and the admin bookings view can flag a
-- client's birthday with a cake icon on that day's sessions.
--
-- birth_date is required in the app (profile completeness check, same
-- as the other health fields), so existing clients get sent to their
-- profile to fill it in before their next booking. It's nullable here
-- because existing rows have no value yet.
--
-- The old age column is left in place (not dropped) to avoid losing
-- existing data; the app no longer reads or writes it.

alter table public.profiles
  add column birth_date date,
  add constraint profiles_birth_date_range
    check (birth_date is null or birth_date >= date '1900-01-01');
