import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="relative flex min-h-[85vh] flex-col items-center justify-center overflow-hidden px-4 text-center">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_0%,rgba(224,171,32,0.12),transparent_60%)]" />

      <span className="mb-4 h-2 w-2 rounded-full bg-gold" />
      <h1 className="mb-4 font-serif text-5xl font-semibold tracking-tight text-charcoal sm:text-6xl">
        Move well.
        <br />
        Eat well.
      </h1>
      <p className="mb-10 max-w-md text-charcoal/60">
        Book Pilates and Nutrition Assistant sessions with your studio —
        anytime, from your phone.
      </p>

      {user ? (
        <Link
          href="/book"
          className="rounded-full bg-charcoal px-8 py-3 text-white transition-colors hover:bg-gold hover:text-charcoal"
        >
          Book a session
        </Link>
      ) : (
        <div className="flex gap-3">
          <Link
            href="/signup"
            className="rounded-full bg-charcoal px-8 py-3 text-white transition-colors hover:bg-gold hover:text-charcoal"
          >
            Sign up
          </Link>
          <Link
            href="/login"
            className="rounded-full border border-charcoal/20 px-8 py-3 text-charcoal transition-colors hover:border-gold hover:text-gold"
          >
            Log in
          </Link>
        </div>
      )}
    </div>
  );
}
