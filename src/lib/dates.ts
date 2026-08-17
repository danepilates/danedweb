const DAY_LABELS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

function studioNowParts(): { date: string; time: string } {
  const timeZone = process.env.STUDIO_TIMEZONE || "UTC";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return {
    date: `${map.year}-${map.month}-${map.day}`,
    time: `${map.hour}:${map.minute}:${map.second}`,
  };
}

// "Today" in the studio's own timezone, not the server's — a UTC-based
// "today" would be wrong near midnight for a studio outside UTC.
export function todayISO(): string {
  return studioNowParts().date;
}

// A session is no longer bookable once its start time has arrived, for
// today's date specifically (future dates are never "in the past").
export function isSlotInPast(sessionDate: string, startTime: string): boolean {
  const now = studioNowParts();
  if (sessionDate !== now.date) return sessionDate < now.date;
  return startTime <= now.time;
}

export function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Calendar day-of-week (0 = Sunday) for a "YYYY-MM-DD" string, independent
// of server timezone.
export function dayOfWeekFromISO(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function addDaysISO(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return toISODate(date);
}

export function formatDayLabel(dateStr: string): string {
  return DAY_LABELS[dayOfWeekFromISO(dateStr)];
}

const MONTH_LABELS = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

export function formatDateHuman(dateStr: string): string {
  const [, m, d] = dateStr.split("-").map(Number);
  return `${formatDayLabel(dateStr)}, ${d} de ${MONTH_LABELS[m - 1]}`;
}

export function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "p. m." : "a. m.";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hour12} ${period}` : `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}
