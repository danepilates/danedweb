-- Client subscription plans: Free (default) or Plan Full, assigned only
-- by admins with a start/end date. There's no separate "plan type"
-- column — a profile is on Plan Full exactly when plan_end_date is set
-- and hasn't passed yet; once it passes, the app treats them as Free
-- automatically (computed at read time, no cron job needed).

alter table public.profiles
  add column plan_start_date date,
  add column plan_end_date date;
