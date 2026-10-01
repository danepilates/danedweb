-- Lets an admin register attendance for a paid-plan client who came to a
-- session without booking it (common with older clients who don't use
-- the app). The admin creates a real 'booked' row on the client's
-- behalf, so the existing triggers apply exactly as for a normal
-- booking: check_plan_booking_rules decrements plan_classes_remaining
-- (and enforces the 1-class-per-day and remaining-balance rules), and
-- check_booking_capacity counts it against the slot's capacity. It then
-- shows up in the client's session history and that hour's attendee
-- list like any other booking.
--
-- Until now the only INSERT policy was "Users can create own bookings"
-- (auth.uid() = user_id), so an admin couldn't insert a row for another
-- user.

create policy "Admins can create any booking"
  on public.bookings for insert
  with check (public.is_admin());
