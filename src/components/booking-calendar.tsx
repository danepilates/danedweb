import Link from "next/link";
import {
  addMonthsISO,
  daysInMonth,
  dayOfWeekFromISO,
  formatMonthHuman,
  mondayIndexedWeekday,
} from "@/lib/dates";

const WEEKDAY_HEADERS = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];

export function BookingCalendar({
  service,
  month,
  selectedDate,
  today,
  maxDate,
  blockedDates,
  availableWeekdays,
}: {
  service: string;
  month: string;
  selectedDate: string | null;
  today: string;
  maxDate: string;
  blockedDates: string[];
  availableWeekdays: Set<number>;
}) {
  const monthStart = `${month}-01`;
  const numDays = daysInMonth(month);
  const leadingBlanks = mondayIndexedWeekday(monthStart);
  const cells: (string | null)[] = [
    ...Array(leadingBlanks).fill(null),
    ...Array.from({ length: numDays }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const prevMonth = addMonthsISO(month, -1);
  const nextMonth = addMonthsISO(month, 1);
  const canGoBack = prevMonth >= today.slice(0, 7);
  const canGoForward = `${nextMonth}-01` <= maxDate;
  const blocked = new Set(blockedDates);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        {canGoBack ? (
          <Link
            href={`/book?service=${service}&month=${prevMonth}`}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-charcoal/20 text-charcoal hover:border-gold hover:bg-gold/10"
          >
            ‹
          </Link>
        ) : (
          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-charcoal/10 text-charcoal/20">
            ‹
          </span>
        )}
        <h2 className="font-serif text-xl font-semibold capitalize text-charcoal">
          {formatMonthHuman(month)}
        </h2>
        {canGoForward ? (
          <Link
            href={`/book?service=${service}&month=${nextMonth}`}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-charcoal/20 text-charcoal hover:border-gold hover:bg-gold/10"
          >
            ›
          </Link>
        ) : (
          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-charcoal/10 text-charcoal/20">
            ›
          </span>
        )}
      </div>

      <div className="mb-1 grid grid-cols-7 gap-1 text-center text-xs text-charcoal/40">
        {WEEKDAY_HEADERS.map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((date, i) => {
          if (!date) return <div key={i} />;

          const isPast = date < today;
          const isBeyondRange = date > maxDate;
          const isBlocked = blocked.has(date);
          const hasSessions = availableWeekdays.has(dayOfWeekFromISO(date));
          const isDisabled = isPast || isBeyondRange || isBlocked || !hasSessions;
          const isSelected = date === selectedDate;
          const isToday = date === today;
          const dayNum = Number(date.slice(8, 10));

          if (isDisabled) {
            return (
              <div
                key={date}
                className="flex aspect-square flex-col items-center justify-center rounded-lg text-sm text-charcoal/20"
              >
                <span className={isBlocked ? "line-through" : ""}>{dayNum}</span>
              </div>
            );
          }

          return (
            <Link
              key={date}
              href={`/book?service=${service}&month=${month}&date=${date}`}
              className={`flex aspect-square flex-col items-center justify-center gap-0.5 rounded-lg border text-sm transition-colors ${
                isSelected
                  ? "border-charcoal bg-charcoal text-white"
                  : isToday
                    ? "border-gold text-charcoal hover:bg-gold/10"
                    : "border-charcoal/10 text-charcoal hover:border-gold/40 hover:bg-gold/5"
              }`}
            >
              <span>{dayNum}</span>
              <span className="h-1.5 w-1.5 rounded-full bg-gold" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
