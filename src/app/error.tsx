"use client";

import Link from "next/link";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-sm flex-col items-center justify-center px-4 text-center">
      <h1 className="mb-2 font-serif text-2xl font-semibold text-charcoal">
        Algo salió mal
      </h1>
      <p className="mb-6 text-sm text-charcoal/60">
        Ocurrió un error inesperado. Intenta de nuevo — si el problema
        persiste, contacta al estudio.
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-full bg-charcoal px-4 py-2 text-sm text-white transition-colors hover:bg-gold hover:text-charcoal"
        >
          Intentar de nuevo
        </button>
        <Link
          href="/book"
          className="rounded-full border border-charcoal/20 px-4 py-2 text-sm text-charcoal hover:border-charcoal hover:bg-charcoal/5"
        >
          Ir al inicio
        </Link>
      </div>
    </div>
  );
}
