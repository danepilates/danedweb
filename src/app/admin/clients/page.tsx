import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPlanStatus } from "@/lib/plan";
import { todayISO } from "@/lib/dates";

export default async function AdminClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ deleted?: string; plan?: string }>;
}) {
  const { deleted, plan: planFilter } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (!profile?.is_admin) redirect("/book");

  const { data: clients } = await supabase
    .from("profiles")
    .select("id, username, full_name, phone, age, is_admin, plan_end_date")
    .order("full_name");

  const today = todayISO();
  const nonAdminClients = (clients ?? [])
    .filter((c) => !c.is_admin)
    .map((c) => ({ ...c, planStatus: getPlanStatus(c.plan_end_date, today) }));

  const filtered = nonAdminClients.filter((c) =>
    planFilter === "free" || planFilter === "full" ? c.planStatus === planFilter : true,
  );

  const filters = [
    { value: undefined, label: "All" },
    { value: "free", label: "Free" },
    { value: "full", label: "Full Plan" },
  ];

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-serif text-3xl font-semibold text-charcoal">Clients</h1>
        <Link href="/admin" className="text-sm text-charcoal/70 underline decoration-gold decoration-2 underline-offset-2 hover:text-charcoal">
          Back to schedule
        </Link>
      </div>

      {deleted && (
        <p className="mb-4 rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
          Client deleted.
        </p>
      )}

      <div className="mb-4 flex gap-2 border-b border-charcoal/10">
        {filters.map((f) => {
          const isSelected = (planFilter ?? undefined) === f.value;
          return (
            <Link
              key={f.label}
              href={f.value ? `/admin/clients?plan=${f.value}` : "/admin/clients"}
              className={`px-3 py-2 text-sm font-medium ${
                isSelected
                  ? "border-b-2 border-gold text-charcoal"
                  : "text-charcoal/50 hover:text-charcoal"
              }`}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      <div className="flex flex-col gap-2">
        {filtered.map((c) => (
          <Link
            key={c.id}
            href={`/admin/clients/${c.id}`}
            className="flex items-center justify-between rounded-lg border border-charcoal/10 px-4 py-3 text-sm transition-colors hover:border-gold/40"
          >
            <span className="flex items-center gap-2 text-charcoal">
              {c.full_name || "(no name yet)"}
              {c.planStatus === "full" && (
                <span className="rounded-full bg-gold px-2 py-0.5 text-xs font-medium text-charcoal">
                  Full Plan
                </span>
              )}
            </span>
            <span className="text-charcoal/50">@{c.username}</span>
          </Link>
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-charcoal/50">No clients in this view.</p>
        )}
      </div>
    </div>
  );
}
