import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatTime, todayISO } from "@/lib/dates";

type BookingRow = {
  id: string;
  session_date: string;
  start_time: string;
  status: string;
  services: { name: string } | null;
  profiles: { full_name: string | null; phone: string | null } | null;
};

export default async function AdminBookingsPage() {
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

  const { data } = await supabase
    .from("bookings")
    .select(
      "id, session_date, start_time, status, services(name), profiles(full_name, phone)",
    )
    .eq("status", "booked")
    .gte("session_date", todayISO())
    .order("session_date")
    .order("start_time");

  const bookings = (data ?? []) as unknown as BookingRow[];

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-serif text-3xl font-semibold text-charcoal">
          Upcoming bookings
        </h1>
        <Link href="/admin" className="text-sm text-charcoal/70 underline decoration-gold decoration-2 underline-offset-2 hover:text-charcoal">
          Back to schedule
        </Link>
      </div>

      {bookings.length === 0 && (
        <p className="text-sm text-charcoal/50">No upcoming bookings.</p>
      )}

      <div className="flex flex-col gap-2">
        {bookings.map((b) => (
          <div key={b.id} className="rounded-lg border border-charcoal/10 px-4 py-3 text-sm">
            <p className="font-medium text-charcoal">
              {b.session_date} · {formatTime(b.start_time)} · {b.services?.name}
            </p>
            <p className="text-charcoal/50">
              {b.profiles?.full_name ?? "Unknown"}
              {b.profiles?.phone ? ` · ${b.profiles.phone}` : ""}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
