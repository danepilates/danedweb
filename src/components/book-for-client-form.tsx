"use client";

import { useState } from "react";
import { bookForClient } from "@/lib/actions/admin";
import { dayOfWeekFromISO, formatTime } from "@/lib/dates";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";

type Slot = {
  id: string;
  day_of_week: number;
  start_time: string;
  serviceName: string;
};

export function BookForClientForm({
  clientId,
  clientName,
  slots,
  today,
  maxDate,
  deductsSession,
}: {
  clientId: string;
  clientName: string;
  slots: Slot[];
  today: string;
  maxDate: string;
  deductsSession: boolean;
}) {
  const [date, setDate] = useState(today);
  const slotsForDay = date ? slots.filter((s) => s.day_of_week === dayOfWeekFromISO(date)) : [];

  return (
    <form action={bookForClient} className="flex flex-col gap-2">
      <input type="hidden" name="clientId" value={clientId} />
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-sm text-charcoal/70">
          Fecha
          <input
            type="date"
            name="sessionDate"
            value={date}
            max={maxDate}
            onChange={(e) => setDate(e.target.value)}
            required
            className="rounded-lg border border-charcoal/20 px-2 py-1.5 text-sm focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
          />
        </label>
        <label className="flex items-center gap-1.5 text-sm text-charcoal/70">
          Horario
          <select
            key={date}
            name="scheduleSlotId"
            required
            disabled={slotsForDay.length === 0}
            className="rounded-lg border border-charcoal/20 px-2 py-1.5 text-sm focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold disabled:opacity-50"
          >
            {slotsForDay.length === 0 ? (
              <option value="">Sin horarios ese día</option>
            ) : (
              slotsForDay.map((s) => (
                <option key={s.id} value={s.id}>
                  {formatTime(s.start_time)} · {s.serviceName}
                </option>
              ))
            )}
          </select>
        </label>
      </div>
      <div>
        <ConfirmSubmitButton
          confirmMessage={
            deductsSession
              ? `¿Reservar esta sesión para ${clientName}? Se descontará 1 sesión de su plan.`
              : `¿Reservar esta sesión para ${clientName}? Quedará confirmada directamente, sin solicitud de pago.`
          }
          className="min-h-10 rounded-full border border-charcoal/20 px-3 text-sm text-charcoal hover:border-gold hover:bg-gold/10"
        >
          Reservar para este cliente
        </ConfirmSubmitButton>
      </div>
    </form>
  );
}
