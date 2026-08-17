import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  addScheduleSlot,
  toggleScheduleSlot,
  updateScheduleSlotCapacity,
} from "@/lib/actions/admin";
import { WeekdayStrip } from "@/components/weekday-strip";
import { dayOfWeekFromISO, formatTime, todayISO } from "@/lib/dates";

const DAY_LABELS = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];

type Slot = {
  id: string;
  day_of_week: number;
  start_time: string;
  duration_minutes: number;
  capacity: number;
  is_active: boolean;
  service_id: string;
};

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ service?: string; day?: string }>;
}) {
  const { service: serviceParam, day: dayParam } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (!profile?.is_admin) redirect("/book");

  const { data: services } = await supabase
    .from("services")
    .select("id, name, slug")
    .order("created_at");

  const selectedService =
    services?.find((s) => s.slug === serviceParam) ?? services?.[0];

  const parsedDay = Number(dayParam);
  const selectedDay =
    Number.isInteger(parsedDay) && parsedDay >= 0 && parsedDay <= 6
      ? parsedDay
      : dayOfWeekFromISO(todayISO());

  const { data: allSlots } = selectedService
    ? await supabase
        .from("schedule_slots")
        .select("id, day_of_week, start_time, duration_minutes, capacity, is_active, service_id")
        .eq("service_id", selectedService.id)
        .order("start_time")
    : { data: [] };

  const slots = (allSlots ?? []) as Slot[];
  const countByDay = [0, 0, 0, 0, 0, 0, 0];
  for (const slot of slots) countByDay[slot.day_of_week]++;

  const daySlots = slots.filter((s) => s.day_of_week === selectedDay);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-serif text-3xl font-semibold text-charcoal">
          Admin — Horario
        </h1>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <Link href="/admin/clients" className="text-charcoal/70 underline decoration-gold decoration-2 underline-offset-2 hover:text-charcoal">
            Clientes
          </Link>
          <Link href="/admin/custom-fields" className="text-charcoal/70 underline decoration-gold decoration-2 underline-offset-2 hover:text-charcoal">
            Campos de perfil
          </Link>
          <Link href="/admin/bookings" className="text-charcoal/70 underline decoration-gold decoration-2 underline-offset-2 hover:text-charcoal">
            Ver todas las reservas
          </Link>
          <Link href="/admin/blocked-dates" className="text-charcoal/70 underline decoration-gold decoration-2 underline-offset-2 hover:text-charcoal">
            Fechas bloqueadas
          </Link>
        </div>
      </div>

      <div className="mb-6 flex gap-2 border-b border-charcoal/10">
        {services?.map((s) => (
          <Link
            key={s.id}
            href={`/admin?service=${s.slug}&day=${selectedDay}`}
            className={`px-3 py-2 text-sm font-medium ${
              s.id === selectedService?.id
                ? "border-b-2 border-gold text-charcoal"
                : "text-charcoal/50 hover:text-charcoal"
            }`}
          >
            {s.name}
          </Link>
        ))}
      </div>

      <WeekdayStrip
        service={selectedService?.slug ?? ""}
        selectedDay={selectedDay}
        countByDay={countByDay}
      />

      <section className="mt-6">
        <h2 className="mb-3 font-serif text-xl font-semibold text-charcoal">
          {DAY_LABELS[selectedDay]}
        </h2>

        <div className="mb-4 flex flex-col gap-2">
          {daySlots.map((slot) => (
            <div
              key={slot.id}
              className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border border-charcoal/10 px-4 py-3 ${
                slot.is_active ? "" : "opacity-40"
              }`}
            >
              <div className="text-sm font-medium text-charcoal">
                {formatTime(slot.start_time)} · {slot.duration_minutes} min
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <form action={updateScheduleSlotCapacity} className="flex items-center gap-1">
                  <input type="hidden" name="id" value={slot.id} />
                  <label className="text-xs text-charcoal/50">Capacidad</label>
                  <input
                    type="number"
                    name="capacity"
                    defaultValue={slot.capacity}
                    min={1}
                    className="w-20 rounded-lg border border-charcoal/20 px-2 py-1.5 text-base focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
                  />
                  <button
                    type="submit"
                    className="min-h-9 rounded-full border border-charcoal/20 px-3 text-sm text-charcoal hover:border-charcoal hover:bg-charcoal/5"
                  >
                    Guardar
                  </button>
                </form>

                <form action={toggleScheduleSlot}>
                  <input type="hidden" name="id" value={slot.id} />
                  <input type="hidden" name="isActive" value={String(slot.is_active)} />
                  <button
                    type="submit"
                    className="min-h-9 rounded-full border border-charcoal/20 px-3 text-sm text-charcoal hover:border-charcoal hover:bg-charcoal/5"
                  >
                    {slot.is_active ? "Desactivar" : "Activar"}
                  </button>
                </form>
              </div>
            </div>
          ))}
          {daySlots.length === 0 && (
            <p className="text-sm text-charcoal/50">
              Aún no hay horarios para {DAY_LABELS[selectedDay]}.
            </p>
          )}
        </div>

        {selectedService && (
          <form
            action={addScheduleSlot}
            className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-gold/40 bg-gold/5 p-3"
          >
            <input type="hidden" name="serviceId" value={selectedService.id} />
            <input type="hidden" name="dayOfWeek" value={selectedDay} />
            <label className="flex flex-col text-xs text-charcoal/50">
              Hora de inicio
              <input
                type="time"
                name="startTime"
                required
                className="rounded-lg border border-charcoal/20 px-2 py-2 text-base focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
              />
            </label>
            <label className="flex flex-col text-xs text-charcoal/50">
              Duración (min)
              <input
                type="number"
                name="durationMinutes"
                defaultValue={60}
                min={15}
                step={5}
                required
                className="w-28 rounded-lg border border-charcoal/20 px-2 py-2 text-base focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
              />
            </label>
            <label className="flex flex-col text-xs text-charcoal/50">
              Capacidad
              <input
                type="number"
                name="capacity"
                defaultValue={6}
                min={1}
                required
                className="w-24 rounded-lg border border-charcoal/20 px-2 py-2 text-base focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
              />
            </label>
            <button
              type="submit"
              className="min-h-10 rounded-full bg-charcoal px-4 text-sm text-white transition-colors hover:bg-gold hover:text-charcoal"
            >
              Agregar horario a {DAY_LABELS[selectedDay]}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
