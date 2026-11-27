import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { cancelBooking } from "@/lib/actions/bookings";
import { canStillCancel, formatDateDayMonth, formatTime, todayISO } from "@/lib/dates";

type BookingRow = {
  id: string;
  session_date: string;
  start_time: string;
  status: string;
  approval_seen_at: string | null;
  services: { name: string } | null;
};

export default async function MyBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: bookings } = await supabase
    .from("bookings")
    .select("id, session_date, start_time, status, approval_seen_at, services(name)")
    .eq("user_id", user.id)
    .order("session_date", { ascending: true })
    .order("start_time", { ascending: true });

  const today = todayISO();
  const rows = (bookings ?? []) as unknown as BookingRow[];

  // Notification: this load is the client "seeing" any bookings an
  // admin approved since their last visit — clear the flag now so the
  // nav bar's red dot and this card's marker don't persist past this
  // page view. See migration 0015.
  const newlyApprovedIds = rows
    .filter((b) => b.status === "booked" && b.approval_seen_at === null)
    .map((b) => b.id);
  if (newlyApprovedIds.length > 0) {
    await supabase
      .from("bookings")
      .update({ approval_seen_at: new Date().toISOString() })
      .in("id", newlyApprovedIds);
  }
  const newlyApproved = new Set(newlyApprovedIds);
  const upcoming = rows.filter(
    (b) => (b.status === "booked" || b.status === "pending") && b.session_date >= today,
  );
  const past = rows.filter(
    (b) =>
      b.status === "cancelled" ||
      b.status === "rejected" ||
      (b.session_date < today && b.status !== "pending"),
  );

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="mb-2 font-serif text-3xl font-semibold text-charcoal">
        Mis reservas
      </h1>
      <p className="mb-6 text-sm text-charcoal/50">
        Puedes cancelar una reserva hasta 1 hora antes de la sesión.
      </p>

      {error && (
        <p className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-medium text-charcoal/50">Próximas</h2>
        {upcoming.length === 0 && (
          <p className="text-sm text-charcoal/50">No tienes próximas sesiones.</p>
        )}
        <div className="flex flex-col gap-2">
          {upcoming.map((b) => (
            <div
              key={b.id}
              className="flex items-center justify-between rounded-lg border border-charcoal/10 px-4 py-3 transition-colors hover:border-gold/40"
            >
              <div>
                <p className="flex items-center gap-1.5 font-medium text-charcoal">
                  {newlyApproved.has(b.id) && (
                    <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" aria-label="Notificación" />
                  )}
                  {b.services?.name} — {formatDateDayMonth(b.session_date)}
                </p>
                <p className="text-sm text-charcoal/50">
                  {formatTime(b.start_time)}
                  {b.status === "pending" && (
                    <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                      Pendiente de pago
                    </span>
                  )}
                  {newlyApproved.has(b.id) && (
                    <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                      ¡Aprobada!
                    </span>
                  )}
                </p>
              </div>
              {b.status === "booked" &&
                (canStillCancel(b.session_date, b.start_time) ? (
                  <form action={cancelBooking}>
                    <input type="hidden" name="bookingId" value={b.id} />
                    <input type="hidden" name="redirectTo" value="/my-bookings" />
                    <button
                      type="submit"
                      className="min-h-11 rounded-full border border-charcoal/20 px-4 text-sm text-charcoal hover:border-charcoal hover:bg-charcoal/5"
                    >
                      Cancelar
                    </button>
                  </form>
                ) : (
                  <span className="max-w-32 text-right text-xs text-charcoal/40">
                    Ya no se puede cancelar
                  </span>
                ))}
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-charcoal/50">Historial</h2>
        {past.length === 0 && (
          <p className="text-sm text-charcoal/50">Aún no hay sesiones pasadas.</p>
        )}
        <div className="flex flex-col gap-2">
          {past.map((b) => (
            <div
              key={b.id}
              className="flex items-center justify-between rounded-lg border border-charcoal/10 px-4 py-3 text-charcoal/40"
            >
              <div>
                <p>
                  {b.services?.name} — {formatDateDayMonth(b.session_date)}
                </p>
                <p className="text-sm">{formatTime(b.start_time)}</p>
              </div>
              <span className="text-sm capitalize">
                {b.status === "cancelled"
                  ? "cancelada"
                  : b.status === "rejected"
                    ? "rechazada"
                    : "reservada"}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
