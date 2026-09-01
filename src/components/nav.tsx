import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/actions/auth";
import { getEffectivePlanType, planLabel, daysUntil } from "@/lib/plan";
import { todayISO } from "@/lib/dates";

export async function Nav() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isAdmin = false;
  let planWarningDays: number | null = null;
  let planWarningLabel = "";
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin, plan_type, plan_end_date")
      .eq("id", user.id)
      .single();
    isAdmin = profile?.is_admin ?? false;

    if (profile?.plan_end_date) {
      const today = todayISO();
      const effectivePlan = getEffectivePlanType(profile.plan_type, profile.plan_end_date, today);
      if (effectivePlan !== "free") {
        const days = daysUntil(profile.plan_end_date, today);
        if (days <= 5) {
          planWarningDays = days;
          planWarningLabel = planLabel(effectivePlan);
        }
      }
    }
  }

  const linkClass =
    "relative py-1 text-charcoal/70 transition-colors hover:text-charcoal after:absolute after:-bottom-1 after:left-0 after:h-px after:w-0 after:bg-gold after:transition-all hover:after:w-full";

  // Plain text links — styled by the mobile dropdown's blanket [&_a]
  // overrides below. Kept separate from authButton, which has its own
  // fully-custom solid-pill styling that must never be touched by those
  // overrides (they match any <a> at any depth inside that wrapper).
  const navLinks = user ? (
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
    <Link href="/login" className={linkClass}>
      Iniciar sesión
    </Link>
  );

  const authButton = !user && (
    <Link
      href="/signup"
      className="block w-full rounded-full bg-charcoal px-4 py-1.5 text-center text-white transition-colors hover:bg-gold hover:text-charcoal sm:w-auto"
    >
      Registrarse
    </Link>
  );

  return (
    <header className="border-b border-charcoal/10">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/logoDaned.png"
            alt="DANED Pilates"
            width={1152}
            height={923}
            priority
            className="h-12 w-auto"
          />
          <span className="font-serif text-2xl font-semibold tracking-wide text-charcoal">
            DANED Studio
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-6 text-sm sm:flex">
          {navLinks}
          {authButton}
        </nav>

        {/* Mobile nav */}
        <details className="relative sm:hidden [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-lg text-xl leading-none text-charcoal hover:bg-charcoal/5">
            ☰
          </summary>
          <div className="absolute right-0 top-full z-10 mt-2 w-44 rounded-lg  border-charcoal/10 bg-white p-2 shadow-lg">
            <nav className="flex flex-col gap-2 text-sm [&_a]:block [&_a]:w-full [&_a]:rounded [&_a]:px-3 [&_a]:py-2 [&_a]:text-left [&_a]:text-charcoal [&_a]:no-underline [&_a]:after:hidden [&_a]:hover:bg-gold/10 [&_button]:block [&_button]:w-full [&_button]:rounded [&_button]:px-3 [&_button]:py-2 [&_button]:text-left [&_button]:text-charcoal [&_button]:after:hidden [&_button]:hover:bg-gold/10">
              {navLinks}
            </nav>
            {authButton && (
              <div className="mt-1 border-t border-charcoal/10 pt-1">
                {authButton}
              </div>
            )}
          </div>
        </details>
      </div>

      {planWarningDays !== null && (
        <div className="border-t border-gold/30 bg-gold/10 px-4 py-2 text-center text-sm text-charcoal">
          Tu Plan {planWarningLabel}{" "}
          {planWarningDays === 0
            ? "termina hoy"
            : `termina en ${planWarningDays} día${planWarningDays === 1 ? "" : "s"}`}
          . Contacta al estudio para renovarlo.
        </div>
      )}
    </header>
  );
}
