-- Fixes: "duplicate key value violates unique constraint
-- bookings_user_id_schedule_slot_id_session_date_key" when rebooking a
-- session after cancelling it.
--
-- Cancelling a booking sets status = 'cancelled' but keeps the row (so
-- booking history is preserved). The original unique constraint applied to
-- ALL rows regardless of status, so a cancelled row permanently blocked
-- rebooking the same user/slot/date. Replace it with a partial unique index
-- that only applies to active ('booked') rows.

alter table public.bookings
  drop constraint bookings_user_id_schedule_slot_id_session_date_key;

create unique index bookings_unique_active_booking
  on public.bookings (user_id, schedule_slot_id, session_date)
  where status = 'booked';
