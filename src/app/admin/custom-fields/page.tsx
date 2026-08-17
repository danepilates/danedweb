import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { addCustomField, deleteCustomField } from "@/lib/actions/admin";

export default async function AdminCustomFieldsPage() {
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

  const { data: fields } = await supabase
    .from("custom_fields")
    .select("id, label, field_type, required")
    .order("created_at");

  const fieldTypeLabels: Record<string, string> = {
    text: "texto",
    number: "número",
    boolean: "sí/no",
  };

  return (
    <div className="mx-auto max-w-xl px-4 py-6">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-serif text-3xl font-semibold text-charcoal">
          Campos personalizados de perfil
        </h1>
        <Link href="/admin" className="text-sm text-charcoal/70 underline decoration-gold decoration-2 underline-offset-2 hover:text-charcoal">
          Volver al horario
        </Link>
      </div>
      <p className="mb-6 text-sm text-charcoal/50">
        Preguntas adicionales que los clientes deben responder en su perfil,
        además de edad, estatura, peso, condiciones médicas, lesiones y
        alergias.
      </p>

      <div className="mb-6 flex flex-col gap-2">
        {(fields ?? []).map((field) => (
          <div
            key={field.id}
            className="flex items-center justify-between rounded-lg border border-charcoal/10 px-4 py-3 text-sm"
          >
            <div>
              <span className="font-medium text-charcoal">{field.label}</span>{" "}
              <span className="text-charcoal/50">
                ({fieldTypeLabels[field.field_type] ?? field.field_type}
                {field.required ? ", obligatorio" : ""})
              </span>
            </div>
            <form action={deleteCustomField}>
              <input type="hidden" name="id" value={field.id} />
              <button
                type="submit"
                className="min-h-9 px-2 text-red-600 underline"
              >
                Eliminar
              </button>
            </form>
          </div>
        ))}
        {(fields ?? []).length === 0 && (
          <p className="text-sm text-charcoal/50">Aún no hay campos personalizados.</p>
        )}
      </div>

      <form
        action={addCustomField}
        className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-gold/40 bg-gold/5 p-3"
      >
        <label className="flex flex-col text-xs text-charcoal/50">
          Etiqueta
          <input
            name="label"
            required
            placeholder="ej. Contacto de emergencia"
            className="rounded-lg border border-charcoal/20 px-2 py-2 text-base focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
          />
        </label>
        <label className="flex flex-col text-xs text-charcoal/50">
          Tipo
          <select name="fieldType" className="rounded-lg border border-charcoal/20 px-2 py-2 text-base focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold">
            <option value="text">Texto</option>
            <option value="number">Número</option>
            <option value="boolean">Sí/No</option>
          </select>
        </label>
        <label className="flex items-center gap-1 pb-2 text-sm text-charcoal">
          <input type="checkbox" name="required" className="h-4 w-4" />
          Obligatorio
        </label>
        <button
          type="submit"
          className="min-h-10 rounded-full bg-charcoal px-4 text-sm text-white transition-colors hover:bg-gold hover:text-charcoal"
        >
          Agregar campo
        </button>
      </form>
    </div>
  );
}
