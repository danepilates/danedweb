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

export function parseBirthDate(raw: FormDataEntryValue | null): string | null {
  const value = String(raw ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  if (value < "1900-01-01" || value > todayISO()) return null;
  return value;
}

export function ageFromBirthDate(birthDate: string, today: string): number {
  const [by, bm, bd] = birthDate.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  const hadBirthdayThisYear = tm > bm || (tm === bm && td >= bd);
  return ty - by - (hadBirthdayThisYear ? 0 : 1);
}

// Feb 29 birthdays fall on Feb 28 in non-leap years.
export function isBirthdayOn(birthDate: string, date: string): boolean {
  const birthMonthDay = birthDate.slice(5);
  const monthDay = date.slice(5);
  if (birthMonthDay === monthDay) return true;
  if (birthMonthDay !== "02-29" || monthDay !== "02-28") return false;
  const year = Number(date.slice(0, 4));
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  return !isLeap;
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

const MONTH_LABELS_FULL = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export function formatDateHuman(dateStr: string): string {
  const [, m, d] = dateStr.split("-").map(Number);
  return `${formatDayLabel(dateStr)}, ${d} de ${MONTH_LABELS[m - 1]}`;
}

// "28 de agosto" — day + full month name, no weekday or year.
export function formatDateDayMonth(dateStr: string): string {
  const [, m, d] = dateStr.split("-").map(Number);
  return `${d} de ${MONTH_LABELS_FULL[m - 1]}`;
}

// Month helpers — "yearMonth" is always "YYYY-MM".
export function currentMonthISO(): string {
  return todayISO().slice(0, 7);
}

export function addMonthsISO(yearMonth: string, months: number): string {
  const [y, m] = yearMonth.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1 + months, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function daysInMonth(yearMonth: string): number {
  const [y, m] = yearMonth.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function formatMonthHuman(yearMonth: string): string {
  const [y, m] = yearMonth.split("-").map(Number);
  return `${MONTH_LABELS_FULL[m - 1]} ${y}`;
}

// Monday-indexed weekday (0 = Monday .. 6 = Sunday) for a "YYYY-MM-DD"
// string, matching this app's Monday-first calendar convention.
export function mondayIndexedWeekday(dateStr: string): number {
  return (dayOfWeekFromISO(dateStr) + 6) % 7;
}

export function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "p. m." : "a. m.";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hour12} ${period}` : `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}
