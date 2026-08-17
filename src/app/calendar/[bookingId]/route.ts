import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildICS } from "@/lib/ical";

type BookingRow = {
  id: string;
  session_date: string;
  start_time: string;
  services: { name: string } | null;
  schedule_slots: { duration_minutes: number } | null;
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  const { bookingId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { data } = await supabase
    .from("bookings")
    .select("id, session_date, start_time, services(name), schedule_slots(duration_minutes)")
    .eq("id", bookingId)
    .eq("user_id", user.id)
    .single();

  const booking = data as unknown as BookingRow | null;
  if (!booking) {
    return new NextResponse("No encontrado", { status: 404 });
  }

  const serviceName = booking.services?.name ?? "Sesión";
  const ics = buildICS({
    uid: booking.id,
    title: `${serviceName} — Estudio de Pilates`,
    description: "Reservado a través de la app del estudio",
    sessionDate: booking.session_date,
    startTime: booking.start_time,
    durationMinutes: booking.schedule_slots?.duration_minutes ?? 60,
  });

  return new NextResponse(ics, {
    headers: {
      // "inline" (not "attachment") is required for iOS Safari to open the
      // native "Add Event" calendar sheet — "attachment" just saves the
      // raw file to the Files app instead.
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="session-${booking.session_date}.ics"`,
    },
  });
}
