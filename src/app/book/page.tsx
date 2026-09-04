import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createBooking, cancelBooking } from "@/lib/actions/bookings";
import { BookingCalendar } from "@/components/booking-calendar";
import {
  addDaysISO,
  currentMonthISO,
  daysInMonth,
  dayOfWeekFromISO,
  formatDateHuman,
  formatTime,
  isSlotInPast,
  todayISO,
} from "@/lib/dates";
import { isProfileComplete, type CustomField, type CustomValue, type Profile } from "@/lib/profile";
import { getEffectivePlanType, planLabel } from "@/lib/plan";

const BOOKING_WINDOW_DAYS = 60;

type ConfirmedBooking = {
  id: string;
  session_date: string;
  start_time: string;
  services: { name: string } | null;
};

export default async function BookPage({
  searchParams,
}: {
  searchParams: Promise<{
    service?: string;
    month?: string;
    date?: string;
    error?: string;
    confirmed?: string;
  }>;
}) {
  const {
    service: serviceParam,
    month: monthParam,
    date: dateParam,
    error,
    confirmed: confirmedId,
  } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();

  const { data: customFields } = await supabase
    .from("custom_fields")
    .select("id, label, field_type, required")
    .returns<CustomField[]>();

  const { data: customValues } = await supabase
    .from("profile_custom_values")
    .select("field_id, value")
    .eq("profile_id", user.id)
    .returns<CustomValue[]>();

  if (!isProfileComplete(profile, customFields ?? [], customValues ?? [])) {
    redirect("/profile?required=1");
  }

  const today = todayISO();
  const effectivePlan = getEffectivePlanType(profile?.plan_type, profile?.plan_end_date ?? null, today);

  const { data: services } = await supabase
    .from("services")
    .select("id, slug, name")
    .order("created_at");

  const selectedService =
    services?.find((s) => s.slug === serviceParam) ?? services?.[0];

  const maxDate = addDaysISO(today, BOOKING_WINDOW_DAYS);
  const month = monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : currentMonthISO();

  const selectedDate =
    dateParam !== undefined ? dateParam : month === currentMonthISO() ? today : null;

  const monthEnd = `${month}-${String(daysInMonth(month)).padStart(2, "0")}`;
  const { data: monthBlockedDates } = await supabase
    .from("blocked_dates")
    .select("date, reason")
    .gte("date", `${month}-01`)
    .lte("date", monthEnd)
    .order("date");

  const blockedDate = monthBlockedDates?.find((b) => b.date === selectedDate);

  let availableWeekdays = new Set<number>();
  if (selectedService) {
    const { data: activeSlotDays } = await supabase
      .from("schedule_slots")
      .select("day_of_week")
      .eq("service_id", selectedService.id)
      .eq("is_active", true);
    availableWeekdays = new Set((activeSlotDays ?? []).map((s) => s.day_of_week));
  }

  let slots: {
    id: string;
    start_time: string;
    duration_minutes: number;
    capacity: number;
  }[] = [];

  if (selectedService && selectedDate && !blockedDate) {
    const { data } = await supabase
      .from("schedule_slots")
      .select("id, start_time, duration_minutes, capacity")
      .eq("service_id", selectedService.id)
      .eq("day_of_week", dayOfWeekFromISO(selectedDate))
      .eq("is_active", true)
      .order("start_time");
    slots = data ?? [];
  }

  const slotIds = slots.map((s) => s.id);

  // RLS on bookings only lets a user see their own rows, so counting
  // spots taken needs the service-role client to see everyone's
  // bookings for this slot/day — only aggregate counts and each row's
  // own user_id (checked against the current user, never displayed for
  // anyone else) are used below, no other user's data is exposed.
  const { data: bookingsForDay } =
    slotIds.length > 0 && selectedDate
      ? await createAdminClient()
          .from("bookings")
          .select("id, schedule_slot_id, user_id, status")
          .in("schedule_slot_id", slotIds)
          .eq("session_date", selectedDate)
          .eq("status", "booked")
      : { data: [] };

  let confirmedBooking: ConfirmedBooking | null = null;
  if (confirmedId) {
    const { data } = await supabase
      .from("bookings")
      .select("id, session_date, start_time, services(name)")
      .eq("id", confirmedId)
      .eq("user_id", user.id)
      .single();
    confirmedBooking = data as unknown as ConfirmedBooking | null;
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="mb-4 font-serif text-3xl font-semibold text-charcoal">
        Reservar una sesión
      </h1>

      <div className="mb-6 rounded-lg border border-charcoal/10 px-4 py-3 text-sm">
        <span className="font-medium text-charcoal">Plan {planLabel(effectivePlan)}</span>
        {effectivePlan === "free" ? (
          <span className="text-charcoal/50"> — solo puedes tener una reserva a la vez</span>
        ) : (
          <span className="text-charcoal/50">
            {" "}
            — {profile!.plan_classes_remaining} de {profile!.plan_classes_total} clases restantes
          </span>
        )}
      </div>

      {confirmedBooking && (
        <div className="mb-6 rounded-lg border border-gold/40 bg-gold/10 px-4 py-3">
          <p className="mb-1 font-medium text-charcoal">¡Sesión reservada!</p>
          <p className="mb-3 text-sm text-charcoal/70">
            {confirmedBooking.services?.name} —{" "}
            {formatDateHuman(confirmedBooking.session_date)} a las{" "}
            {formatTime(confirmedBooking.start_time)}
          </p>
          <div className="flex flex-wrap gap-2">
            <a
              href={`/calendar/${confirmedBooking.id}`}
              className="rounded-full border border-gold bg-white px-3 py-1.5 text-sm font-medium text-charcoal hover:bg-gold/10"
            >
              Agregar al calendario
            </a>
          </div>
        </div>
      )}

      <div className="mb-6 flex gap-2 border-b border-charcoal/10">
        {services?.map((s) => (
          <Link
            key={s.id}
            href={`/book?service=${s.slug}`}
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

      <BookingCalendar
        service={selectedService?.slug ?? ""}
        month={month}
        selectedDate={selectedDate}
        today={today}
        maxDate={maxDate}
        blockedDates={(monthBlockedDates ?? []).map((b) => b.date)}
        availableWeekdays={availableWeekdays}
      />

      {error && (
        <p className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mt-6 flex flex-col gap-2">
        {!selectedDate && (
          <p className="text-sm text-charcoal/50">
            Selecciona una fecha para ver los horarios disponibles.
          </p>
        )}

        {selectedDate && blockedDate && (
          <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            El estudio está cerrado el {formatDateHuman(selectedDate)}
            {blockedDate.reason ? ` — ${blockedDate.reason}` : ""}.
          </p>
        )}

        {selectedDate && !blockedDate && slots.length === 0 && (
          <p className="text-sm text-charcoal/50">
            No hay sesiones programadas para este día.
          </p>
        )}

        {selectedDate &&
          slots.map((slot) => {
            const bookedForSlot =
              bookingsForDay?.filter((b) => b.schedule_slot_id === slot.id) ?? [];
            const spotsLeft = slot.capacity - bookedForSlot.length;
            const myBooking = bookedForSlot.find((b) => b.user_id === user.id);
            const inPast = isSlotInPast(selectedDate, slot.start_time);

            let statusLabel = spotsLeft > 0 ? `${spotsLeft} cupo${spotsLeft === 1 ? "" : "s"} disponible${spotsLeft === 1 ? "" : "s"}` : "Sin cupos";
            if (inPast && !myBooking) statusLabel = "Ya comenzó";

            return (
              <div
                key={slot.id}
                className="flex items-center justify-between rounded-lg border border-charcoal/10 px-4 py-3 transition-colors hover:border-gold/40"
              >
                <div>
                  <p className="font-medium text-charcoal">{formatTime(slot.start_time)}</p>
                  <p className="text-sm text-charcoal/50">
                    {slot.duration_minutes} min · {statusLabel}
                  </p>
                </div>

                {myBooking ? (
                  <form action={cancelBooking}>
                    <input type="hidden" name="bookingId" value={myBooking.id} />
                    <input type="hidden" name="serviceSlug" value={selectedService?.slug} />
                    <input type="hidden" name="sessionDate" value={selectedDate} />
                    <button
                      type="submit"
                      className="min-h-11 rounded-full border border-charcoal/20 px-4 text-sm text-charcoal hover:border-charcoal hover:bg-charcoal/5"
                    >
                      Cancelar
                    </button>
                  </form>
                ) : (
                  <form action={createBooking}>
                    <input type="hidden" name="scheduleSlotId" value={slot.id} />
                    <input type="hidden" name="serviceId" value={selectedService?.id} />
                    <input type="hidden" name="serviceSlug" value={selectedService?.slug} />
                    <input type="hidden" name="sessionDate" value={selectedDate} />
                    <input type="hidden" name="startTime" value={slot.start_time} />
                    <button
                      type="submit"
                      disabled={spotsLeft <= 0 || inPast}
                      className="min-h-11 rounded-full bg-charcoal px-4 text-sm text-white transition-colors hover:bg-gold hover:text-charcoal disabled:cursor-not-allowed disabled:bg-charcoal/20 disabled:hover:text-white"
                    >
                      Reservar
                    </button>
                  </form>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
}
