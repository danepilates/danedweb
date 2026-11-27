-- Clients can only cancel a booking up to 1 hour before the session
-- starts; after that the reservation is locked in (the studio has
-- already planned for that spot). Admins are exempt and can cancel at
-- any time (e.g. guest bookings, or a client calling the studio).
--
-- Enforced here rather than only by hiding the button, since a client
-- could otherwise PATCH status = 'cancelled' directly via the REST API.
-- Session times are in the studio's local time (America/Guayaquil), so
-- "now" is converted to the same zone before comparing.
--
-- Named trg_05_ so it runs before the other BEFORE UPDATE triggers
-- (they fire alphabetically) — the refund trigger in particular should
-- never get to return a class for a cancellation that's then refused.
-- The exception aborts the whole statement either way.

create function public.enforce_cancel_window()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if old.status = 'booked'
     and new.status = 'cancelled'
     and not public.is_admin()
     and old.session_date + old.start_time - interval '1 hour'
         <= (now() at time zone 'America/Guayaquil')
  then
    raise exception 'Ya no puedes cancelar esta reserva: solo se puede cancelar hasta 1 hora antes de la sesión';
  end if;

  return new;
end;
$$;

create trigger trg_05_enforce_cancel_window
  before update on public.bookings
  for each row execute function public.enforce_cancel_window();
