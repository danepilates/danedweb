import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  addMonthsISO,
  currentMonthISO,
  daysInMonth,
  formatDateHuman,
  formatMonthHuman,
  formatTime,
  mondayIndexedWeekday,
  todayISO,
} from "@/lib/dates";

const WEEKDAY_HEADERS = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];

type BookingRow = {
  id: string;
  session_date: string;
  start_time: string;
  services: { name: string } | null;
  profiles: { full_name: string | null; phone: string | null } | null;
};

export default async function AdminBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; date?: string }>;
}) {
  const { month: monthParam, date: dateParam } = await searchParams;

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

  const today = todayISO();
  const month = monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : currentMonthISO();
  const numDays = daysInMonth(month);
  const monthStart = `${month}-01`;
  const monthEnd = `${month}-${String(numDays).padStart(2, "0")}`;

  const { data } = await supabase
    .from("bookings")
    .select("id, session_date, start_time, services(name), profiles(full_name, phone)")
    .eq("status", "booked")
    .gte("session_date", monthStart)
    .lte("session_date", monthEnd)
    .order("start_time");

  const bookings = (data ?? []) as unknown as BookingRow[];

  const byDate = new Map<string, BookingRow[]>();
  for (const b of bookings) {
    const list = byDate.get(b.session_date) ?? [];
    list.push(b);
    byDate.set(b.session_date, list);
  }

  const selectedDate =
    dateParam !== undefined ? dateParam : month === today.slice(0, 7) ? today : null;

  const leadingBlanks = mondayIndexedWeekday(monthStart);
  const cells: (string | null)[] = [
    ...Array(leadingBlanks).fill(null),
    ...Array.from({ length: numDays }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const prevMonth = addMonthsISO(month, -1);
  const nextMonth = addMonthsISO(month, 1);
  const selectedList = selectedDate ? (byDate.get(selectedDate) ?? []) : [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-serif text-3xl font-semibold text-charcoal">
          Próximas reservas
        </h1>
        <Link href="/admin" className="text-sm text-charcoal/70 underline decoration-gold decoration-2 underline-offset-2 hover:text-charcoal">
          Volver al horario
        </Link>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <Link
          href={`/admin/bookings?month=${prevMonth}`}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-charcoal/20 text-charcoal hover:border-gold hover:bg-gold/10"
        >
          ‹
        </Link>
        <h2 className="font-serif text-xl font-semibold capitalize text-charcoal">
          {formatMonthHuman(month)}
        </h2>
        <Link
          href={`/admin/bookings?month=${nextMonth}`}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-charcoal/20 text-charcoal hover:border-gold hover:bg-gold/10"
        >
          ›
        </Link>
      </div>

      <div className="mb-1 grid grid-cols-7 gap-1 text-center text-xs text-charcoal/40">
        {WEEKDAY_HEADERS.map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>

      <div className="mb-6 grid grid-cols-7 gap-1">
        {cells.map((date, i) => {
          if (!date) return <div key={i} />;
          const count = byDate.get(date)?.length ?? 0;
          const isSelected = date === selectedDate;
          const isToday = date === today;
          const dayNum = Number(date.slice(8, 10));

          return (
            <Link
              key={date}
              href={`/admin/bookings?month=${month}&date=${date}`}
              className={`flex aspect-square flex-col items-center justify-center gap-0.5 rounded-lg border text-sm transition-colors ${
                isSelected
                  ? "border-charcoal bg-charcoal text-white"
                  : isToday
                    ? "border-gold text-charcoal hover:bg-gold/10"
                    : "border-charcoal/10 text-charcoal hover:border-gold/40 hover:bg-gold/5"
              }`}
            >
              <span>{dayNum}</span>
              {count > 0 && (
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-gold" />
                  {count > 1 && (
                    <span className={`text-[10px] ${isSelected ? "text-white/70" : "text-charcoal/50"}`}>
                      +{count}
                    </span>
                  )}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      <section>
        <h3 className="mb-3 text-sm font-medium text-charcoal/50">
          {selectedDate ? formatDateHuman(selectedDate) : "Selecciona una fecha"}
        </h3>

        {selectedDate && selectedList.length === 0 && (
          <p className="text-sm text-charcoal/50">No hay reservas ese día.</p>
        )}

        <div className="flex flex-col gap-2">
          {selectedList.map((b) => (
            <div key={b.id} className="rounded-lg border border-charcoal/10 px-4 py-3 text-sm">
              <p className="font-medium text-charcoal">
                {formatTime(b.start_time)} · {b.services?.name}
              </p>
              <p className="text-charcoal/50">
                {b.profiles?.full_name ?? "Desconocido"}
                {b.profiles?.phone ? ` · ${b.profiles.phone}` : ""}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
