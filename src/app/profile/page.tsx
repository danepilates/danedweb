import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateOwnProfile } from "@/lib/actions/profile";
import type { CustomField, CustomValue, Profile } from "@/lib/profile";
import { USERNAME_PATTERN } from "@/lib/username";
import { getPlanStatus } from "@/lib/plan";
import { formatDateHuman, todayISO } from "@/lib/dates";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; required?: string; error?: string }>;
}) {
  const { saved, required, error } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();

  const planStatus = getPlanStatus(profile?.plan_end_date ?? null, todayISO());

  const { data: customFields } = await supabase
    .from("custom_fields")
    .select("id, label, field_type, required")
    .order("created_at")
    .returns<CustomField[]>();

  const { data: customValues } = await supabase
    .from("profile_custom_values")
    .select("field_id, value")
    .eq("profile_id", user.id)
    .returns<CustomValue[]>();

  const valueByField = new Map(
    (customValues ?? []).map((v) => [v.field_id, v.value ?? ""]),
  );

  return (
    <div className="mx-auto max-w-xl px-4 py-6">
      <h1 className="mb-2 font-serif text-3xl font-semibold text-charcoal">
        Tu perfil
      </h1>
      <p className="mb-6 text-sm text-charcoal/50">
        Esta información ayuda a tu instructor a planificar las sesiones de
        forma segura.
      </p>

      {required && (
        <p className="mb-4 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Completa tu perfil antes de reservar una sesión.
        </p>
      )}
      {saved && (
        <p className="mb-4 rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
          Perfil guardado.
        </p>
      )}
      {error && (
        <p className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <section
        className={`mb-6 flex items-center justify-between rounded-lg border p-4 ${
          planStatus === "full" ? "border-gold/40 bg-gold/10" : "border-charcoal/10"
        }`}
      >
        <div>
          <p className="text-sm text-charcoal/50">Membresía</p>
          <p className="font-serif text-lg font-semibold text-charcoal">
            {planStatus === "full" ? "Plan Full" : "Gratis"}
          </p>
        </div>
        {profile?.plan_end_date && (
          <p className="text-sm text-charcoal/50">
            {planStatus === "full" ? "Activo hasta" : "Expiró el"}{" "}
            {formatDateHuman(profile.plan_end_date)}
          </p>
        )}
      </section>

      <form action={updateOwnProfile} className="flex flex-col gap-5">
        <div className="flex items-center gap-4">
          {profile?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatar_url}
              alt="Foto de perfil"
              className="h-16 w-16 rounded-full border-2 border-gold object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed border-charcoal/20 text-xs text-charcoal/40">
              Sin foto
            </div>
          )}
          <label className="text-sm">
            <span className="mb-1 block text-charcoal/50">Foto de perfil</span>
            <input type="file" name="avatar" accept="image/*" className="text-sm" />
          </label>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          Usuario
          <input
            name="username"
            type="text"
            defaultValue={profile?.username ?? ""}
            pattern={USERNAME_PATTERN}
            title="3-20 caracteres: solo letras y números"
            autoCapitalize="off"
            autoCorrect="off"
            required
            className="rounded-lg border border-charcoal/20 px-3 py-2 text-base focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
          />
          <span className="text-xs font-normal text-charcoal/50">
            Se usa para iniciar sesión en lugar de tu correo.
          </span>
        </label>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            Nombre completo
            <input
              name="fullName"
              defaultValue={profile?.full_name ?? ""}
              required
              className="rounded-lg border border-charcoal/20 px-3 py-2 text-base focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Teléfono
            <input
              name="phone"
              type="tel"
              defaultValue={profile?.phone ?? ""}
              required
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
              min={1}
              defaultValue={profile?.age ?? ""}
              required
              className="rounded-lg border border-charcoal/20 px-3 py-2 text-base focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Estatura (cm)
            <input
              name="heightCm"
              type="number"
              min={1}
              step="0.1"
              defaultValue={profile?.height_cm ?? ""}
              required
              className="rounded-lg border border-charcoal/20 px-3 py-2 text-base focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Peso (kg)
            <input
              name="weightKg"
              type="number"
              min={1}
              step="0.1"
              defaultValue={profile?.weight_kg ?? ""}
              required
              className="rounded-lg border border-charcoal/20 px-3 py-2 text-base focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          Condiciones médicas / enfermedades
          <textarea
            name="medicalConditions"
            defaultValue={profile?.medical_conditions ?? ""}
            required
            placeholder="Escribe 'Ninguna' si no aplica"
            className="rounded-lg border border-charcoal/20 px-3 py-2 text-base focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
            rows={2}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Lesiones o fracturas
          <textarea
            name="injuries"
            defaultValue={profile?.injuries ?? ""}
            required
            placeholder="Escribe 'Ninguna' si no aplica"
            className="rounded-lg border border-charcoal/20 px-3 py-2 text-base focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
            rows={2}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Alergias
          <textarea
            name="allergies"
            defaultValue={profile?.allergies ?? ""}
            required
            placeholder="Escribe 'Ninguna' si no aplica"
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
                    required={field.required}
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
                    required={field.required}
                    className="rounded-lg border border-charcoal/20 px-3 py-2 text-base focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
                  />
                )}
              </label>
            ))}
          </div>
        )}

        <button
          type="submit"
          className="mt-2 rounded-full bg-charcoal px-4 py-3 text-base text-white transition-colors hover:bg-gold hover:text-charcoal"
        >
          Guardar perfil
        </button>
      </form>
    </div>
  );
}
