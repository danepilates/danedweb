// Builds a floating-time (no UTC offset) .ics event — correct for a
// single-location studio where the date/time is always the studio's own
// local wall-clock time, regardless of the viewer's device timezone.

function escapeText(value: string): string {
  return value.replace(/([,;])/g, "\\$1").replace(/\n/g, "\\n");
}

function toICSDateTime(sessionDate: string, time: string): string {
  const [y, m, d] = sessionDate.split("-");
  const [hh, mm, ss] = time.split(":");
  return `${y}${m}${d}T${hh}${mm}${ss ?? "00"}`;
}

function addMinutes(sessionDate: string, time: string, minutes: number): string {
  const [y, m, d] = sessionDate.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, hh, mm));
  date.setUTCMinutes(date.getUTCMinutes() + minutes);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}00`;
}

export function buildICS({
  uid,
  title,
  description,
  sessionDate,
  startTime,
  durationMinutes,
}: {
  uid: string;
  title: string;
  description: string;
  sessionDate: string;
  startTime: string;
  durationMinutes: number;
}): string {
  const dtStamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const dtStart = toICSDateTime(sessionDate, startTime);
  const dtEnd = addMinutes(sessionDate, startTime, durationMinutes);

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Pilates Studio//Booking//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${uid}@pilates-studio`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${escapeText(title)}`,
    `DESCRIPTION:${escapeText(description)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}
