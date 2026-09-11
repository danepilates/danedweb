"use client";

import { useEffect, useState } from "react";
import { markPaymentReported } from "@/lib/actions/bookings";

const WHATSAPP_URL = "https://wa.me/message/72OJH2TWNN4FH1";
const REQUEST_WINDOW_MS = 15 * 60 * 1000;

function formatCountdown(ms: number) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function PendingPaymentModal({
  bookingId,
  firstName,
  createdAt,
  initiallyReported,
}: {
  bookingId: string;
  firstName: string;
  createdAt: string;
  initiallyReported: boolean;
}) {
  const deadline = new Date(createdAt).getTime() + REQUEST_WINDOW_MS;
  const [remaining, setRemaining] = useState(() => deadline - Date.now());
  const [reported, setReported] = useState(initiallyReported);
  const [sending, setSending] = useState(false);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => setRemaining(deadline - Date.now()), 1000);
    return () => clearInterval(interval);
  }, [deadline]);

  if (!open) return null;

  const expired = remaining <= 0;
  const onClose = () => setOpen(false);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/50 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-lg bg-white p-6 text-center shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="mb-4 text-sm text-charcoal">
          {firstName}, eres parte del plan Diario, por favor confirma tu
          reservación enviando el comprobante de pago a nuestro número de
          WhatsApp en un plazo de 15 minutos. Caso contrario tu reserva
          será anulada. 💚 Gracias por tu ayuda.
        </p>

        <p className="mb-4 font-serif text-3xl font-semibold text-charcoal">
          {expired ? "00:00" : formatCountdown(remaining)}
        </p>

        <div className="flex flex-col gap-2">
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full bg-charcoal px-4 py-3 text-sm text-white transition-colors hover:bg-gold hover:text-charcoal"
          >
            Enviar comprobante
          </a>

          {reported ? (
            <p className="text-sm text-charcoal/60">
              Avisamos al estudio que ya pagaste. Espera la confirmación.
            </p>
          ) : (
            <button
              type="button"
              disabled={sending}
              onClick={async () => {
                setSending(true);
                await markPaymentReported(bookingId);
                setReported(true);
                setSending(false);
              }}
              className="rounded-full border border-charcoal/20 px-4 py-3 text-sm text-charcoal transition-colors hover:border-charcoal hover:bg-charcoal/5 disabled:opacity-50"
            >
              Ya realicé el pago
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 text-sm text-charcoal/50 underline decoration-gold decoration-2 underline-offset-2 hover:text-charcoal"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}
