import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { addBlockedDate, deleteBlockedDate } from "@/lib/actions/admin";
import { formatDateHuman, todayISO } from "@/lib/dates";

export default async function AdminBlockedDatesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

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

  const { data: blockedDates } = await supabase
    .from("blocked_dates")
    .select("id, date, reason")
    .gte("date", todayISO())
    .order("date");

  return (
    <div className="mx-auto max-w-xl px-4 py-6">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-serif text-3xl font-semibold text-charcoal">
          Fechas bloqueadas
        </h1>
        <Link href="/admin" className="text-sm text-charcoal/70 underline decoration-gold decoration-2 underline-offset-2 hover:text-charcoal">
          Volver al horario
        </Link>
      </div>
      <p className="mb-6 text-sm text-charcoal/50">
        Cierra el estudio en una fecha específica — feriados, mantenimiento,
        etc. Bloquea las reservas de todos los servicios ese día, sin
        importar el horario semanal habitual.
      </p>

      {error && (
        <p className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <form
        action={addBlockedDate}
        className="mb-6 flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-gold/40 bg-gold/5 p-3"
      >
        <label className="flex flex-col text-xs text-charcoal/50">
          Fecha
          <input
            type="date"
            name="date"
            min={todayISO()}
            required
            className="rounded-lg border border-charcoal/20 px-2 py-2 text-base focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
          />
        </label>
        <label className="flex flex-col text-xs text-charcoal/50">
          Motivo (opcional)
          <input
            type="text"
            name="reason"
            placeholder="ej. Feriado"
            className="rounded-lg border border-charcoal/20 px-2 py-2 text-base focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
          />
        </label>
        <button
          type="submit"
          className="min-h-10 rounded-full bg-charcoal px-4 text-sm text-white transition-colors hover:bg-gold hover:text-charcoal"
        >
          Bloquear fecha
        </button>
      </form>

      <div className="flex flex-col gap-2">
        {(blockedDates ?? []).map((b) => (
          <div
            key={b.id}
            className="flex items-center justify-between rounded-lg border border-charcoal/10 px-4 py-3 text-sm"
          >
            <div>
              <span className="font-medium text-charcoal">{formatDateHuman(b.date)}</span>
              {b.reason && <span className="text-charcoal/50"> — {b.reason}</span>}
            </div>
            <form action={deleteBlockedDate}>
              <input type="hidden" name="id" value={b.id} />
              <button
                type="submit"
                className="min-h-9 px-2 text-red-600 underline"
              >
                Desbloquear
              </button>
            </form>
          </div>
        ))}
        {(blockedDates ?? []).length === 0 && (
          <p className="text-sm text-charcoal/50">No hay fechas bloqueadas.</p>
        )}
      </div>
    </div>
  );
}
