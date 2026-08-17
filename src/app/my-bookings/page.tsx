import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { cancelBooking } from "@/lib/actions/bookings";
import { formatTime, todayISO } from "@/lib/dates";

type BookingRow = {
  id: string;
  session_date: string;
  start_time: string;
  status: string;
  services: { name: string } | null;
};

export default async function MyBookingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: bookings } = await supabase
    .from("bookings")
    .select("id, session_date, start_time, status, services(name)")
    .eq("user_id", user.id)
    .order("session_date", { ascending: true })
    .order("start_time", { ascending: true });

  const today = todayISO();
  const rows = (bookings ?? []) as unknown as BookingRow[];
  const upcoming = rows.filter(
    (b) => b.status === "booked" && b.session_date >= today,
  );
  const past = rows.filter(
    (b) => b.status === "cancelled" || b.session_date < today,
  );

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="mb-6 font-serif text-3xl font-semibold text-charcoal">
        Mis reservas
      </h1>

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
                <p className="font-medium text-charcoal">
                  {b.services?.name} — {b.session_date}
                </p>
                <p className="text-sm text-charcoal/50">
                  {formatTime(b.start_time)}
                </p>
              </div>
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
                  {b.services?.name} — {b.session_date}
                </p>
                <p className="text-sm">{formatTime(b.start_time)}</p>
              </div>
              <span className="text-sm capitalize">
                {b.status === "cancelled" ? "cancelada" : "reservada"}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
