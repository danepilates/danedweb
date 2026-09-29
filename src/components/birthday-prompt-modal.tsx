"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export function BirthdayPromptModal() {
  const pathname = usePathname();
  const [open, setOpen] = useState(true);

  if (!open || pathname === "/profile") return null;

  const onClose = () => setOpen(false);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/50 px-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="birthday-prompt-title"
        className="w-full max-w-sm rounded-lg bg-white p-6 text-center shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="mb-2 text-3xl" aria-hidden="true">
          🎂
        </p>
        <h2
          id="birthday-prompt-title"
          className="mb-2 font-serif text-xl font-semibold text-charcoal"
        >
          Completa tu fecha de nacimiento
        </h2>
        <p className="mb-5 text-sm text-charcoal/70">
          Necesitamos tu fecha de nacimiento para mantener tu perfil al día.
          Es obligatoria para poder reservar tus próximas sesiones.
        </p>

        <Link
          href="/profile?required=1"
          onClick={onClose}
          className="block rounded-full bg-charcoal px-4 py-3 text-sm text-white transition-colors hover:bg-gold hover:text-charcoal"
        >
          Completar ahora
        </Link>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 text-sm text-charcoal/50 underline decoration-gold decoration-2 underline-offset-2 hover:text-charcoal"
        >
          Más tarde
        </button>
      </div>
    </div>
  );
}
