import Link from "next/link";

// day_of_week values stay 0=Sunday..6=Saturday (matches the DB and
// Date.getUTCDay()) — only the display order changes to start on Monday.
const DAY_LABELS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function WeekdayStrip({
  service,
  selectedDay,
  countByDay,
}: {
  service: string;
  selectedDay: number;
  countByDay: number[];
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2">
      {WEEK_ORDER.map((day) => {
        const label = DAY_LABELS[day];
        const isSelected = day === selectedDay;
        const count = countByDay[day] ?? 0;
        return (
          <Link
            key={day}
            href={`/admin?service=${service}&day=${day}`}
            className={`flex min-w-16 flex-col items-center rounded-lg border px-3 py-2 text-sm transition-colors ${
              isSelected
                ? "border-charcoal bg-charcoal text-white"
                : "border-charcoal/15 text-charcoal hover:border-gold hover:bg-gold/10"
            }`}
          >
            <span className="font-medium">{label}</span>
            <span className={`text-xs ${isSelected ? "opacity-80" : "text-charcoal/40"}`}>
              {count > 0 ? `${count} sesión${count === 1 ? "" : "es"}` : "—"}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
