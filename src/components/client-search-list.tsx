"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { planLabel, type PlanType } from "@/lib/plan";

type ClientListItem = {
  id: string;
  username: string | null;
  full_name: string | null;
  effectivePlan: PlanType;
};

export function ClientSearchList({ clients }: { clients: ClientListItem[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(
      (c) =>
        (c.full_name ?? "").toLowerCase().includes(q) ||
        (c.username ?? "").toLowerCase().includes(q),
    );
  }, [clients, query]);

  return (
    <div>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar por nombre o usuario…"
        className="mb-4 w-full rounded-lg border border-charcoal/20 px-3 py-2 text-base focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
      />

      <div className="flex flex-col gap-2">
        {filtered.map((c) => (
          <Link
            key={c.id}
            href={`/admin/clients/${c.id}`}
            className="flex items-center justify-between rounded-lg border border-charcoal/10 px-4 py-3 text-sm transition-colors hover:border-gold/40"
          >
            <span className="flex items-center gap-2 text-charcoal">
              {c.full_name || "(sin nombre aún)"}
              {c.effectivePlan !== "free" && (
                <span className="rounded-full bg-gold px-2 py-0.5 text-xs font-medium text-charcoal">
                  {planLabel(c.effectivePlan)}
                </span>
              )}
            </span>
            <span className="text-charcoal/50">@{c.username}</span>
          </Link>
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-charcoal/50">No se encontraron clientes.</p>
        )}
      </div>
    </div>
  );
}
