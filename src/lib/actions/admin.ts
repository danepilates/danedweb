"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidUsername, normalizeUsername } from "@/lib/username";
import { addDaysISO, todayISO } from "@/lib/dates";
import { translateAuthError } from "@/lib/supabase-error";
import { PLAN_CONFIG, type PlanType } from "@/lib/plan";

async function requireAdmin() {
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

  return supabase;
}

export async function addScheduleSlot(formData: FormData) {
  const supabase = await requireAdmin();

  const serviceId = String(formData.get("serviceId") ?? "");
  const dayOfWeek = Number(formData.get("dayOfWeek"));
  const startTime = String(formData.get("startTime") ?? "");
  const durationMinutes = Number(formData.get("durationMinutes") ?? 60);
  const capacity = Number(formData.get("capacity") ?? 1);

  await supabase.from("schedule_slots").insert({
    service_id: serviceId,
    day_of_week: dayOfWeek,
    start_time: startTime,
    duration_minutes: durationMinutes,
    capacity,
  });

  revalidatePath("/admin");
  revalidatePath("/book");
}

export async function toggleScheduleSlot(formData: FormData) {
  const supabase = await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const isActive = formData.get("isActive") === "true";

  await supabase
    .from("schedule_slots")
    .update({ is_active: !isActive })
    .eq("id", id);

  revalidatePath("/admin");
  revalidatePath("/book");
}

export async function updateScheduleSlotCapacity(formData: FormData) {
  const supabase = await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const capacity = Number(formData.get("capacity"));

  if (capacity > 0) {
    await supabase.from("schedule_slots").update({ capacity }).eq("id", id);
  }

  revalidatePath("/admin");
  revalidatePath("/book");
}

export async function addCustomField(formData: FormData) {
  const supabase = await requireAdmin();

  const label = String(formData.get("label") ?? "").trim();
  const fieldType = String(formData.get("fieldType") ?? "text");
  const required = formData.get("required") === "on";

  if (!label) return;

  await supabase.from("custom_fields").insert({
    label,
    field_type: fieldType,
    required,
  });

  revalidatePath("/admin/custom-fields");
  revalidatePath("/profile");
  revalidatePath("/book");
}

export async function deleteCustomField(formData: FormData) {
  const supabase = await requireAdmin();
  const id = String(formData.get("id") ?? "");

  await supabase.from("custom_fields").delete().eq("id", id);

  revalidatePath("/admin/custom-fields");
  revalidatePath("/profile");
  revalidatePath("/book");
}

function parseCoreProfileFields(formData: FormData) {
  const numberOrNull = (v: FormDataEntryValue | null) =>
    v && String(v).trim() !== "" ? Number(v) : null;

  return {
    full_name: String(formData.get("fullName") ?? "").trim().slice(0, 200),
    phone: String(formData.get("phone") ?? "").trim().slice(0, 30),
    age: numberOrNull(formData.get("age")),
    height_cm: numberOrNull(formData.get("heightCm")),
    weight_kg: numberOrNull(formData.get("weightKg")),
    medical_conditions: String(formData.get("medicalConditions") ?? "").trim().slice(0, 2000),
    injuries: String(formData.get("injuries") ?? "").trim().slice(0, 2000),
    allergies: String(formData.get("allergies") ?? "").trim().slice(0, 2000),
  };
}

export async function updateClientProfile(formData: FormData) {
  const supabase = await requireAdmin();
  const clientId = String(formData.get("clientId") ?? "");
  if (!clientId) return;

  const username = normalizeUsername(String(formData.get("username") ?? ""));
  if (!isValidUsername(username)) {
    redirect(
      `/admin/clients/${clientId}?error=${encodeURIComponent("El usuario debe tener 3-20 caracteres: solo letras y números")}`,
    );
  }

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .ilike("username", username)
    .neq("id", clientId)
    .maybeSingle();

  if (existing) {
    redirect(
      `/admin/clients/${clientId}?error=${encodeURIComponent("Ese usuario ya está en uso")}`,
    );
  }

  const updates = { ...parseCoreProfileFields(formData), username };
  await supabase.from("profiles").update(updates).eq("id", clientId);

  const { data: fields } = await supabase.from("custom_fields").select("id");
  for (const field of fields ?? []) {
    const raw = formData.get(`custom_${field.id}`);
    if (raw === null) continue;
    await supabase.from("profile_custom_values").upsert(
      { profile_id: clientId, field_id: field.id, value: String(raw) },
      { onConflict: "profile_id,field_id" },
    );
  }

  revalidatePath(`/admin/clients/${clientId}`);
  redirect(`/admin/clients/${clientId}?saved=1`);
}

export async function sendClientPasswordReset(formData: FormData) {
  await requireAdmin();
  const clientId = String(formData.get("clientId") ?? "");
  if (!clientId) return;

  const admin = createAdminClient();
  const { data, error: lookupError } = await admin.auth.admin.getUserById(clientId);
  if (lookupError || !data.user?.email) {
    redirect(
      `/admin/clients/${clientId}?error=${encodeURIComponent("No se encontró el correo de ese cliente")}`,
    );
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const { error } = await admin.auth.resetPasswordForEmail(data.user.email, {
    redirectTo: `${origin}/auth/confirm?next=/update-password`,
  });

  redirect(
    error
      ? `/admin/clients/${clientId}?error=${encodeURIComponent(translateAuthError(error.message))}`
      : `/admin/clients/${clientId}?reset=1`,
  );
}

export async function deleteClient(formData: FormData) {
  await requireAdmin();
  const clientId = String(formData.get("clientId") ?? "");
  if (!clientId) return;

  const admin = createAdminClient();
  await admin.auth.admin.deleteUser(clientId);

  revalidatePath("/admin/clients");
  redirect("/admin/clients?deleted=1");
}

export async function addBlockedDate(formData: FormData) {
  const supabase = await requireAdmin();

  const date = String(formData.get("date") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!date) return;

  const { error } = await supabase
    .from("blocked_dates")
    .insert({ date, reason: reason || null });

  revalidatePath("/admin/blocked-dates");
  revalidatePath("/book");

  if (error) {
    redirect(`/admin/blocked-dates?error=${encodeURIComponent(error.message)}`);
  }
}

export async function deleteBlockedDate(formData: FormData) {
  const supabase = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await supabase.from("blocked_dates").delete().eq("id", id);

  revalidatePath("/admin/blocked-dates");
  revalidatePath("/book");
}

function revalidateClientPlan(clientId: string) {
  revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath("/admin/clients");
  revalidatePath("/profile");
}

// Assigning a plan always starts a fresh full period with a full class
// balance — plans don't accumulate or extend, per the studio's rule that
// unused classes are lost at period end anyway. The start date defaults
// to today but admins can back/forward-date it for clients whose plan
// should begin on a different day.
export async function assignClientPlan(formData: FormData) {
  const supabase = await requireAdmin();
  const clientId = String(formData.get("clientId") ?? "");
  const planType = String(formData.get("planType") ?? "") as PlanType;
  if (!clientId || !(planType in PLAN_CONFIG)) return;

  const config = PLAN_CONFIG[planType as Exclude<PlanType, "free">];
  const requestedStart = String(formData.get("startDate") ?? "");
  const startDate = /^\d{4}-\d{2}-\d{2}$/.test(requestedStart) ? requestedStart : todayISO();

  await supabase
    .from("profiles")
    .update({
      plan_type: planType,
      plan_start_date: startDate,
      plan_end_date: addDaysISO(startDate, config.periodDays),
      plan_classes_total: config.classes,
      plan_classes_remaining: config.classes,
    })
    .eq("id", clientId);

  revalidateClientPlan(clientId);
  redirect(`/admin/clients/${clientId}?saved=1`);
}

export async function revertClientToFree(formData: FormData) {
  const supabase = await requireAdmin();
  const clientId = String(formData.get("clientId") ?? "");
  if (!clientId) return;

  await supabase
    .from("profiles")
    .update({
      plan_type: "free",
      plan_start_date: null,
      plan_end_date: null,
      plan_classes_total: null,
      plan_classes_remaining: null,
    })
    .eq("id", clientId);

  revalidateClientPlan(clientId);
  redirect(`/admin/clients/${clientId}?saved=1`);
}
