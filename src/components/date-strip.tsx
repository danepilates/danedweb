import Link from "next/link";
import { addDaysISO, formatDayLabel, todayISO } from "@/lib/dates";

export function DateStrip({
  service,
  selectedDate,
  blockedDates = [],
  days = 14,
}: {
  service: string;
  selectedDate: string;
  blockedDates?: string[];
  days?: number;
}) {
  const start = todayISO();
  const dates = Array.from({ length: days }, (_, i) => addDaysISO(start, i));
  const blocked = new Set(blockedDates);

  return (
    <div className="flex gap-2 overflow-x-auto pb-2">
      {dates.map((date) => {
        const isSelected = date === selectedDate;
        const isBlocked = blocked.has(date);
        const dayNum = Number(date.slice(8, 10));
        return (
          <Link
            key={date}
            href={`/book?service=${service}&date=${date}`}
            className={`flex min-w-14 flex-col items-center rounded-lg border px-3 py-2 text-sm transition-colors ${
              isSelected
                ? "border-charcoal bg-charcoal text-white"
                : isBlocked
                  ? "border-charcoal/10 bg-charcoal/5 text-charcoal/30"
                  : "border-charcoal/15 text-charcoal hover:border-gold hover:bg-gold/10"
            }`}
          >
            <span className="text-xs opacity-70">{formatDayLabel(date)}</span>
            <span className={`font-medium ${isBlocked && !isSelected ? "line-through" : ""}`}>
              {dayNum}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
