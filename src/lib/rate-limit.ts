import "server-only";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

export async function getClientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return h.get("x-real-ip") ?? "unknown";
}

// Fixed-window rate limit backed by Postgres (already provisioned — no
// extra service needed for this app's traffic volume). Returns true if
// the request is allowed, false if the caller is over the limit. Fails
// open (allows the request) on any unexpected error — e.g. migration
// 0010 not applied yet — so a rate-limit hiccup never blocks login,
// signup, or booking outright.
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const windowStart = new Date(Date.now() - windowSeconds * 1000).toISOString();

    // Best-effort housekeeping so the table doesn't grow unbounded.
    await admin.from("rate_limit_hits").delete().eq("key", key).lt("created_at", windowStart);

    const { count, error } = await admin
      .from("rate_limit_hits")
      .select("id", { count: "exact", head: true })
      .eq("key", key)
      .gte("created_at", windowStart);

    if (error) return true;
    if ((count ?? 0) >= limit) return false;

    await admin.from("rate_limit_hits").insert({ key });
    return true;
  } catch {
    return true;
  }
}
