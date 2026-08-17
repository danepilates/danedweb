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

  return (
    <div className="mx-auto max-w-xl px-4 py-6">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-serif text-3xl font-semibold text-charcoal">
          Custom profile fields
        </h1>
        <Link href="/admin" className="text-sm text-charcoal/70 underline decoration-gold decoration-2 underline-offset-2 hover:text-charcoal">
          Back to schedule
        </Link>
      </div>
      <p className="mb-6 text-sm text-charcoal/50">
        Extra questions clients must answer on their profile, in addition to
        age, height, weight, medical conditions, injuries, and allergies.
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
                ({field.field_type}
                {field.required ? ", required" : ""})
              </span>
            </div>
            <form action={deleteCustomField}>
              <input type="hidden" name="id" value={field.id} />
              <button
                type="submit"
                className="min-h-9 px-2 text-red-600 underline"
              >
                Delete
              </button>
            </form>
          </div>
        ))}
        {(fields ?? []).length === 0 && (
          <p className="text-sm text-charcoal/50">No custom fields yet.</p>
        )}
      </div>

      <form
        action={addCustomField}
        className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-gold/40 bg-gold/5 p-3"
      >
        <label className="flex flex-col text-xs text-charcoal/50">
          Label
          <input
            name="label"
            required
            placeholder="e.g. Emergency contact"
            className="rounded-lg border border-charcoal/20 px-2 py-2 text-base focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
          />
        </label>
        <label className="flex flex-col text-xs text-charcoal/50">
          Type
          <select name="fieldType" className="rounded-lg border border-charcoal/20 px-2 py-2 text-base focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold">
            <option value="text">Text</option>
            <option value="number">Number</option>
            <option value="boolean">Yes/No</option>
          </select>
        </label>
        <label className="flex items-center gap-1 pb-2 text-sm text-charcoal">
          <input type="checkbox" name="required" className="h-4 w-4" />
          Required
        </label>
        <button
          type="submit"
          className="min-h-10 rounded-full bg-charcoal px-4 text-sm text-white transition-colors hover:bg-gold hover:text-charcoal"
        >
          Add field
        </button>
      </form>
    </div>
  );
}
