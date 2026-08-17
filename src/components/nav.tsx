import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/actions/auth";
import { getPlanStatus, daysUntil } from "@/lib/plan";
import { todayISO } from "@/lib/dates";

export async function Nav() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isAdmin = false;
  let planWarningDays: number | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin, plan_end_date")
      .eq("id", user.id)
      .single();
    isAdmin = profile?.is_admin ?? false;

    if (profile?.plan_end_date) {
      const today = todayISO();
      if (getPlanStatus(profile.plan_end_date, today) === "full") {
        const days = daysUntil(profile.plan_end_date, today);
        if (days <= 5) planWarningDays = days;
      }
    }
  }

  const linkClass =
    "relative py-1 text-charcoal/70 transition-colors hover:text-charcoal after:absolute after:-bottom-1 after:left-0 after:h-px after:w-0 after:bg-gold after:transition-all hover:after:w-full";

  const links = user ? (
    <>
      <Link href="/book" className={linkClass}>
        Reservar
      </Link>
      <Link href="/my-bookings" className={linkClass}>
        Mis reservas
      </Link>
      <Link href="/profile" className={linkClass}>
        Perfil
      </Link>
      {isAdmin && (
        <Link href="/admin" className={linkClass}>
          Admin
        </Link>
      )}
      <form action={signOut}>
        <button type="submit" className={`text-left ${linkClass}`}>
          Cerrar sesión
        </button>
      </form>
    </>
  ) : (
    <>
      <Link href="/login" className={linkClass}>
        Iniciar sesión
      </Link>
      <Link
        href="/signup"
        className="rounded-full bg-charcoal px-4 py-1.5 text-white transition-colors hover:bg-gold hover:text-charcoal"
      >
        Registrarse
      </Link>
    </>
  );

  return (
    <header className="border-b border-charcoal/10">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
        <Link href="/" className="group flex items-baseline gap-2">
          <span className="font-serif text-2xl font-semibold tracking-wide text-charcoal">
            Estudio
          </span>
          <span className="h-1.5 w-1.5 rounded-full bg-gold" />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-6 text-sm sm:flex">{links}</nav>

        {/* Mobile nav */}
        <details className="relative sm:hidden [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-lg text-xl leading-none text-charcoal hover:bg-charcoal/5">
            ☰
          </summary>
          <nav className="absolute right-0 top-full z-10 mt-2 flex w-44 flex-col gap-1 rounded-lg border border-charcoal/10 bg-white p-2 text-sm shadow-lg [&_a]:rounded [&_a]:px-3 [&_a]:py-2 [&_a]:text-charcoal [&_a]:no-underline [&_a]:after:hidden [&_a]:hover:bg-gold/10 [&_button]:rounded [&_button]:px-3 [&_button]:py-2 [&_button]:text-charcoal [&_button]:after:hidden [&_button]:hover:bg-gold/10">
            {links}
          </nav>
        </details>
      </div>

      {planWarningDays !== null && (
        <div className="border-t border-gold/30 bg-gold/10 px-4 py-2 text-center text-sm text-charcoal">
          Tu Plan Full{" "}
          {planWarningDays === 0
            ? "termina hoy"
            : `termina en ${planWarningDays} día${planWarningDays === 1 ? "" : "s"}`}
          . Contacta al estudio para renovarlo.
        </div>
      )}
    </header>
  );
}
