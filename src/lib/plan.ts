export type PlanStatus = "free" | "full";

// A profile is on Plan Full exactly when plan_end_date is set and hasn't
// passed yet. Once it passes, this returns "free" automatically — no
// batch job needed to "revert" anyone.
export function getPlanStatus(planEndDate: string | null, today: string): PlanStatus {
  if (!planEndDate) return "free";
  return planEndDate >= today ? "full" : "free";
}

export function daysUntil(dateStr: string, today: string): number {
  const [y1, m1, d1] = today.split("-").map(Number);
  const [y2, m2, d2] = dateStr.split("-").map(Number);
  const a = Date.UTC(y1, m1 - 1, d1);
  const b = Date.UTC(y2, m2 - 1, d2);
  return Math.round((b - a) / 86400000);
}
