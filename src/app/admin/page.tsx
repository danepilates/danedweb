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
import { getEffectivePlanType, type PlanType } from "@/lib/plan";

const MORNING_START_HOUR = 6;
const MORNING_END_HOUR = 11; // exclusive — 6am through 10am inclusive

const WEEKDAY_HEADERS = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];

// Free/"diario" clients intentionally get no badge — only paid tiers are
// flagged so admins can spot who's on a plan at a glance.
const PLAN_BADGES: Partial<Record<PlanType, { color: string; textColor: string; label: string }>> = {
  silver: { color: "#C0C0C0", textColor: "#373737", label: "Silver" },
  gold: { color: "#E0AB20", textColor: "#373737", label: "Gold" },
  vip: { color: "#8B5CF6", textColor: "#FFFFFF", label: "VIP" },
};

type BookingRow = {
  id: string;
  session_date: string;
  start_time: string;
  services: { name: string } | null;
  profiles: {
    full_name: string | null;
    phone: string | null;
    plan_type: string | null;
    plan_end_date: string | null;
  } | null;
  effectivePlan: PlanType;
};

type HourGroup = { hour: number; bookings: BookingRow[] };

function groupByHour(list: BookingRow[]): HourGroup[] {
  const byHour = new Map<number, BookingRow[]>();
  for (const b of list) {
    const hour = Number(b.start_time.slice(0, 2));
    const group = byHour.get(hour) ?? [];
    group.push(b);
    byHour.set(hour, group);
  }
  return Array.from(byHour.entries())
    .sort(([a], [b]) => a - b)
    .map(([hour, bookings]) => ({ hour, bookings }));
}

function isMorningHour(hour: number) {
  return hour >= MORNING_START_HOUR && hour < MORNING_END_HOUR;
}

function HourScheduleSection({
  title,
  groups,
  cardColor,
}: {
  title: string;
  groups: HourGroup[];
  cardColor: string;
}) {
  return (
    <div>
      <h4 className="mb-2 font-serif text-lg font-semibold text-charcoal">{title}</h4>
      {groups.length === 0 ? (
        <p className="text-sm text-charcoal/40">Sin reservas.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {groups.map(({ hour, bookings }) => (
            <div
              key={hour}
              className="rounded-lg px-4 py-3"
              style={{ backgroundColor: cardColor }}
            >
              <p className="mb-1 font-medium text-charcoal">
                {formatTime(`${String(hour).padStart(2, "0")}:00`)}
              </p>
              <div className="flex flex-col gap-1 text-sm text-charcoal/70">
                {bookings.map((b) => {
                  const badge = PLAN_BADGES[b.effectivePlan];
                  return (
                    <span key={b.id} className="flex items-center gap-1.5">
                      {b.profiles?.full_name ?? "Desconocido"}
                      {badge && (
                        <span className="inline-flex items-center gap-1">
                          <span style={{ color: badge.color }}>★</span>
                          <span
                            className="rounded-full px-2 py-0.5 text-xs font-medium"
                            style={{ backgroundColor: badge.color, color: badge.textColor }}
                          >
                            {badge.label}
                          </span>
                        </span>
                      )}
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default async function AdminPage({
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
    .select(
      "id, session_date, start_time, services(name), profiles(full_name, phone, plan_type, plan_end_date)",
    )
    .eq("status", "booked")
    .gte("session_date", monthStart)
    .lte("session_date", monthEnd)
    .order("start_time");

  const bookings = ((data ?? []) as unknown as Omit<BookingRow, "effectivePlan">[]).map((b) => ({
    ...b,
    effectivePlan: getEffectivePlanType(b.profiles?.plan_type, b.profiles?.plan_end_date ?? null, today),
  }));

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
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-serif text-3xl font-semibold text-charcoal">
          Próximas reservas
        </h1>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <Link href="/admin/clients" className="text-charcoal/70 underline decoration-gold decoration-2 underline-offset-2 hover:text-charcoal">
            Clientes
          </Link>
          <Link href="/admin/schedule" className="text-charcoal/70 underline decoration-gold decoration-2 underline-offset-2 hover:text-charcoal">
            Horarios
          </Link>
          <Link href="/admin/custom-fields" className="text-charcoal/70 underline decoration-gold decoration-2 underline-offset-2 hover:text-charcoal">
            Campos de perfil
          </Link>
          <Link href="/admin/blocked-dates" className="text-charcoal/70 underline decoration-gold decoration-2 underline-offset-2 hover:text-charcoal">
            Fechas bloqueadas
          </Link>
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <Link
          href={`/admin?month=${prevMonth}`}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-charcoal/20 text-charcoal hover:border-gold hover:bg-gold/10"
        >
          ‹
        </Link>
        <h2 className="font-serif text-xl font-semibold capitalize text-charcoal">
          {formatMonthHuman(month)}
        </h2>
        <Link
          href={`/admin?month=${nextMonth}`}
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
              href={`/admin?month=${month}&date=${date}`}
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

        {selectedDate && selectedList.length > 0 && (
          <div className="flex flex-col gap-6">
            <HourScheduleSection
              title="Mañana"
              groups={groupByHour(selectedList.filter((b) => isMorningHour(Number(b.start_time.slice(0, 2)))))}
              cardColor="#FCECFF"
            />
            <HourScheduleSection
              title="Tarde"
              groups={groupByHour(selectedList.filter((b) => !isMorningHour(Number(b.start_time.slice(0, 2)))))}
              cardColor="#DAE2FF"
            />
          </div>
        )}
      </section>
    </div>
  );
}
