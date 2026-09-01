import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  updateClientProfile,
  sendClientPasswordReset,
  deleteClient,
  assignClientPlan,
  revertClientToFree,
} from "@/lib/actions/admin";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import type { CustomField, CustomValue, Profile } from "@/lib/profile";
import { USERNAME_PATTERN } from "@/lib/username";
import { getEffectivePlanType, planLabel, PLAN_CONFIG, type PlanType } from "@/lib/plan";
import { formatDateHuman, todayISO } from "@/lib/dates";

export default async function AdminClientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; reset?: string; error?: string }>;
}) {
  const { id } = await params;
  const { saved, reset, error } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (!adminProfile?.is_admin) redirect("/book");

  const { data: client } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .single<Profile>();

  if (!client) redirect("/admin/clients");

  const today = todayISO();
  const effectivePlan = getEffectivePlanType(client.plan_type, client.plan_end_date, today);

  const { data: customFields } = await supabase
    .from("custom_fields")
    .select("id, label, field_type, required")
    .order("created_at")
    .returns<CustomField[]>();

  const { data: customValues } = await supabase
    .from("profile_custom_values")
    .select("field_id, value")
    .eq("profile_id", id)
    .returns<CustomValue[]>();

  const valueByField = new Map(
    (customValues ?? []).map((v) => [v.field_id, v.value ?? ""]),
  );

  return (
    <div className="mx-auto max-w-xl px-4 py-6">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-serif text-3xl font-semibold text-charcoal">
          {client.full_name || "Cliente"}
        </h1>
        <Link href="/admin/clients" className="text-sm text-charcoal/70 underline decoration-gold decoration-2 underline-offset-2 hover:text-charcoal">
          Volver a clientes
        </Link>
      </div>

      {saved && (
        <p className="mb-4 rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
          Guardado.
        </p>
      )}
      {reset && (
        <p className="mb-4 rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
          Correo de restablecimiento enviado.
        </p>
      )}
      {error && (
        <p className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mb-6 flex flex-wrap gap-2">
        <form action={sendClientPasswordReset}>
          <input type="hidden" name="clientId" value={client.id} />
          <button
            type="submit"
            className="min-h-11 rounded-full border border-charcoal/20 px-4 text-sm text-charcoal hover:border-charcoal hover:bg-charcoal/5"
          >
            Enviar restablecimiento de contraseña
          </button>
        </form>
        <form action={deleteClient}>
          <input type="hidden" name="clientId" value={client.id} />
          <ConfirmSubmitButton
            confirmMessage={`¿Eliminar a ${client.full_name || "este cliente"}? Esto elimina permanentemente su cuenta, perfil y reservas.`}
            className="min-h-11 rounded-full border border-red-300 px-4 text-sm text-red-600 hover:bg-red-50"
          >
            Eliminar cliente
          </ConfirmSubmitButton>
        </form>
      </div>

      <section
        className={`mb-8 rounded-lg border p-4 ${
          effectivePlan !== "free" ? "border-gold/40 bg-gold/5" : "border-charcoal/10"
        }`}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-serif text-lg font-semibold text-charcoal">Plan</h2>
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
              effectivePlan !== "free"
                ? "bg-gold text-charcoal"
                : "bg-charcoal/10 text-charcoal/60"
            }`}
          >
            {planLabel(effectivePlan)}
          </span>
        </div>

        {effectivePlan !== "free" && (
          <p className="mb-3 text-sm text-charcoal/50">
            {client.plan_classes_remaining} de {client.plan_classes_total} clases restantes ·
            vence el {formatDateHuman(client.plan_end_date!)}
          </p>
        )}
        {effectivePlan === "free" && client.plan_end_date && (
          <p className="mb-3 text-sm text-charcoal/50">
            Su último plan expiró el {formatDateHuman(client.plan_end_date)}
          </p>
        )}

        <div className="mb-3 flex flex-wrap gap-2">
          {(Object.keys(PLAN_CONFIG) as Exclude<PlanType, "free">[]).map((type) => (
            <form key={type} action={assignClientPlan}>
              <input type="hidden" name="clientId" value={client.id} />
              <input type="hidden" name="planType" value={type} />
              <ConfirmSubmitButton
                confirmMessage={`¿Asignar Plan ${PLAN_CONFIG[type].label}? Esto reinicia el saldo a ${PLAN_CONFIG[type].classes} clases y el período a ${PLAN_CONFIG[type].periodDays} días desde hoy.`}
                className="min-h-10 rounded-full border border-charcoal/20 px-3 text-sm text-charcoal hover:border-gold hover:bg-gold/10"
              >
                Asignar {PLAN_CONFIG[type].label}
              </ConfirmSubmitButton>
            </form>
          ))}
          {effectivePlan !== "free" && (
            <form action={revertClientToFree}>
              <input type="hidden" name="clientId" value={client.id} />
              <button
                type="submit"
                className="min-h-10 rounded-full border border-red-300 px-3 text-sm text-red-600 hover:bg-red-50"
              >
                Volver a Gratis
              </button>
            </form>
          )}
        </div>
      </section>

      <form action={updateClientProfile} className="flex flex-col gap-5">
        <input type="hidden" name="clientId" value={client.id} />

        <label className="flex flex-col gap-1 text-sm">
          Usuario
          <input
            name="username"
            type="text"
            defaultValue={client.username ?? ""}
            pattern={USERNAME_PATTERN}
            title="3-20 caracteres: solo letras y números"
            autoCapitalize="off"
            autoCorrect="off"
            required
            className="rounded-lg border border-charcoal/20 px-3 py-2 text-base focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
          />
        </label>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            Nombre completo
            <input
              name="fullName"
              defaultValue={client.full_name ?? ""}
              className="rounded-lg border border-charcoal/20 px-3 py-2 text-base focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Teléfono
            <input
              name="phone"
              defaultValue={client.phone ?? ""}
              className="rounded-lg border border-charcoal/20 px-3 py-2 text-base focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
            />
          </label>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm">
            Edad
            <input
              name="age"
              type="number"
              defaultValue={client.age ?? ""}
              className="rounded-lg border border-charcoal/20 px-3 py-2 text-base focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Estatura (cm)
            <input
              name="heightCm"
              type="number"
              step="0.1"
              defaultValue={client.height_cm ?? ""}
              className="rounded-lg border border-charcoal/20 px-3 py-2 text-base focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Peso (kg)
            <input
              name="weightKg"
              type="number"
              step="0.1"
              defaultValue={client.weight_kg ?? ""}
              className="rounded-lg border border-charcoal/20 px-3 py-2 text-base focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          Condiciones médicas / enfermedades
          <textarea
            name="medicalConditions"
            defaultValue={client.medical_conditions ?? ""}
            className="rounded-lg border border-charcoal/20 px-3 py-2 text-base focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
            rows={2}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Lesiones o fracturas
          <textarea
            name="injuries"
            defaultValue={client.injuries ?? ""}
            className="rounded-lg border border-charcoal/20 px-3 py-2 text-base focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
            rows={2}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Alergias
          <textarea
            name="allergies"
            defaultValue={client.allergies ?? ""}
            className="rounded-lg border border-charcoal/20 px-3 py-2 text-base focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
            rows={2}
          />
        </label>

        {(customFields ?? []).length > 0 && (
          <div className="flex flex-col gap-4 border-t border-charcoal/10 pt-4">
            {customFields!.map((field) => (
              <label key={field.id} className="flex flex-col gap-1 text-sm">
                {field.label}
                {field.field_type === "boolean" ? (
                  <select
                    name={`custom_${field.id}`}
                    defaultValue={valueByField.get(field.id) ?? ""}
                    className="rounded-lg border border-charcoal/20 px-3 py-2 text-base focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
                  >
                    <option value="">Selecciona…</option>
                    <option value="true">Sí</option>
                    <option value="false">No</option>
                  </select>
                ) : (
                  <input
                    name={`custom_${field.id}`}
                    type={field.field_type === "number" ? "number" : "text"}
                    defaultValue={valueByField.get(field.id) ?? ""}
                    className="rounded-lg border border-charcoal/20 px-3 py-2 text-base focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
                  />
                )}
              </label>
            ))}
          </div>
        )}

        <button
          type="submit"
          className="mt-2 min-h-11 rounded-full bg-charcoal px-4 text-base text-white transition-colors hover:bg-gold hover:text-charcoal"
        >
          Guardar
        </button>
      </form>
    </div>
  );
}
