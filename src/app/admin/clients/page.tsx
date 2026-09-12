import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getEffectivePlanType, type PlanType } from "@/lib/plan";
import { todayISO } from "@/lib/dates";
import { ClientSearchList } from "@/components/client-search-list";

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
    .select("id, username, full_name, phone, age, is_admin, plan_type, plan_end_date")
    .order("full_name");

  const today = todayISO();
  const nonAdminClients = (clients ?? [])
    .filter((c) => !c.is_admin)
    .map((c) => ({
      ...c,
      effectivePlan: getEffectivePlanType(c.plan_type, c.plan_end_date, today),
    }));

  const validFilters: PlanType[] = ["free", "silver", "gold", "vip", "custom"];
  const filtered = nonAdminClients.filter((c) =>
    planFilter && validFilters.includes(planFilter as PlanType)
      ? c.effectivePlan === planFilter
      : true,
  );

  const filters: { value?: PlanType; label: string }[] = [
    { value: undefined, label: "Todos" },
    { value: "free", label: "Gratis" },
    { value: "silver", label: "Silver" },
    { value: "gold", label: "Gold" },
    { value: "vip", label: "VIP" },
    { value: "custom", label: "Personalizado" },
  ];

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-serif text-3xl font-semibold text-charcoal">Clientes</h1>
        <Link href="/admin" className="text-sm text-charcoal/70 underline decoration-gold decoration-2 underline-offset-2 hover:text-charcoal">
          Volver a reservas
        </Link>
      </div>

      {deleted && (
        <p className="mb-4 rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
          Cliente eliminado.
        </p>
      )}

      <div className="mb-4 flex flex-wrap gap-2 border-b border-charcoal/10">
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

      <ClientSearchList clients={filtered} />
    </div>
  );
}
