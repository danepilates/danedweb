export type PlanType = "free" | "silver" | "gold" | "vip";

export const PLAN_CONFIG: Record<Exclude<PlanType, "free">, {
  label: string;
  classes: number;
  periodDays: number;
}> = {
  silver: { label: "Silver", classes: 12, periodDays: 30 },
  gold: { label: "Gold", classes: 20, periodDays: 30 },
  vip: { label: "VIP", classes: 60, periodDays: 90 },
};

// A stored paid plan behaves as Free once its period has passed — no
// batch job needed to "revert" anyone; this is computed at read time,
// mirroring the DB trigger's own expiry check.
export function getEffectivePlanType(
  storedType: string | null | undefined,
  planEndDate: string | null,
  today: string,
): PlanType {
  if (!storedType || storedType === "free") return "free";
  if (!planEndDate || planEndDate < today) return "free";
  return storedType as PlanType;
}

export function planLabel(type: PlanType): string {
  return type === "free" ? "Gratis" : PLAN_CONFIG[type].label;
}

export function daysUntil(dateStr: string, today: string): number {
  const [y1, m1, d1] = today.split("-").map(Number);
  const [y2, m2, d2] = dateStr.split("-").map(Number);
  const a = Date.UTC(y1, m1 - 1, d1);
  const b = Date.UTC(y2, m2 - 1, d2);
  return Math.round((b - a) / 86400000);
}
