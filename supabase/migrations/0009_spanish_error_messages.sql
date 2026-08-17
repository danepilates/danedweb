-- Translates the capacity-check trigger's error message to Spanish, to
-- match the rest of the UI (now fully in Spanish). Function body is
-- replaced in place; the trigger itself doesn't need to be recreated.
-- Also translates the seeded service names/descriptions.

update public.services set name = 'Pilates', description = 'Sesiones de Pilates'
  where slug = 'pilates';
update public.services set name = 'Asistencia Nutricional', description = 'Sesiones de consulta nutricional'
  where slug = 'nutrition';

create or replace function public.check_booking_capacity()
returns trigger
language plpgsql
as $$
declare
  slot_capacity integer;
  current_count integer;
begin
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
    raise exception 'Esta sesión ya no tiene cupos disponibles';
  end if;

  return new;
end;
$$;
