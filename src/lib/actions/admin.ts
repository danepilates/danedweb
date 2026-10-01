"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidUsername, normalizeUsername } from "@/lib/username";
import { addDaysISO, dayOfWeekFromISO, parseBirthDate, todayISO } from "@/lib/dates";
import { translateAuthError } from "@/lib/supabase-error";
import { getEffectivePlanType, PLAN_CONFIG, type PlanType } from "@/lib/plan";

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

  revalidatePath("/admin/schedule");
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

  revalidatePath("/admin/schedule");
  revalidatePath("/book");
}

export async function updateScheduleSlotCapacity(formData: FormData) {
  const supabase = await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const capacity = Number(formData.get("capacity"));

  if (capacity > 0) {
    await supabase.from("schedule_slots").update({ capacity }).eq("id", id);
  }

  revalidatePath("/admin/schedule");
  revalidatePath("/book");
}

export async function deleteScheduleSlot(formData: FormData) {
  const supabase = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  // schedule_slots.id cascades to bookings.schedule_slot_id — deleting a
  // slot also removes every booking (past and future) tied to it.
  await supabase.from("schedule_slots").delete().eq("id", id);

  revalidatePath("/admin/schedule");
  revalidatePath("/admin");
  revalidatePath("/book");
}

export async function approveBookingRequest(formData: FormData) {
  const supabase = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  // The capacity trigger still fires on this update, so approving past
  // a slot that filled up in the meantime correctly fails here.
  const { error } = await supabase
    .from("bookings")
    .update({ status: "booked" })
    .eq("id", id)
    .eq("status", "pending");

  revalidatePath("/admin");
  revalidatePath("/book");

  if (error) {
    redirect(`/admin?error=${encodeURIComponent(error.message)}`);
  }
}

export async function rejectBookingRequest(formData: FormData) {
  const supabase = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await supabase
    .from("bookings")
    .update({ status: "rejected" })
    .eq("id", id)
    .eq("status", "pending");

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
    birth_date: parseBirthDate(formData.get("birthDate")),
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

  const config = PLAN_CONFIG[planType as "silver" | "gold" | "vip"];
  const requestedStart = String(formData.get("startDate") ?? "");
  const startDate = /^\d{4}-\d{2}-\d{2}$/.test(requestedStart) ? requestedStart : todayISO();
  // "El usuario empezó hoy" — the client already booked a session today
  // (e.g. under their old free/Diario plan) before this new plan was
  // assigned. That booking's own trigger never touched the fresh
  // balance being set below, so this lets the admin manually account
  // for it by starting one class short instead of a full reset.
  const startedToday = formData.get("startedToday") === "on";
  const classesRemaining = startedToday ? Math.max(config.classes - 1, 0) : config.classes;

  await supabase
    .from("profiles")
    .update({
      plan_type: planType,
      plan_start_date: startDate,
      plan_end_date: addDaysISO(startDate, config.periodDays),
      plan_classes_total: config.classes,
      plan_classes_remaining: classesRemaining,
    })
    .eq("id", clientId);

  revalidateClientPlan(clientId);
  redirect(`/admin/clients/${clientId}?saved=1`);
}

// For Diario clients who want to pay for more than one session but
// don't want Gold/VIP — the admin picks the number of sessions directly.
// Unlike the fixed tiers, a custom plan never expires by date; it only
// runs out when plan_classes_remaining hits 0.
export async function assignCustomPlan(formData: FormData) {
  const supabase = await requireAdmin();
  const clientId = String(formData.get("clientId") ?? "");
  const classes = Number(formData.get("classes"));
  if (!clientId || !Number.isInteger(classes) || classes <= 0) return;

  // See assignClientPlan for why this exists.
  const startedToday = formData.get("startedToday") === "on";
  const classesRemaining = startedToday ? Math.max(classes - 1, 0) : classes;

  await supabase
    .from("profiles")
    .update({
      plan_type: "custom",
      plan_start_date: todayISO(),
      plan_end_date: null,
      plan_classes_total: classes,
      plan_classes_remaining: classesRemaining,
    })
    .eq("id", clientId);

  revalidateClientPlan(clientId);
  redirect(`/admin/clients/${clientId}?saved=1`);
}

// For paid-plan clients who attended a session without booking it. Creates
// a real 'booked' row on their behalf (see migration 0017) so the DB
// triggers deduct the class, enforce the plan rules, and count capacity.
export async function registerAttendance(formData: FormData) {
  const supabase = await requireAdmin();
  const clientId = String(formData.get("clientId") ?? "");
  const scheduleSlotId = String(formData.get("scheduleSlotId") ?? "");
  const sessionDate = String(formData.get("sessionDate") ?? "");
  if (!clientId) return;

  const fail = (message: string) =>
    redirect(`/admin/clients/${clientId}?error=${encodeURIComponent(message)}`);

  if (!scheduleSlotId || !/^\d{4}-\d{2}-\d{2}$/.test(sessionDate)) {
    fail("Selecciona la fecha y el horario de la sesión");
  }
  if (sessionDate > todayISO()) {
    fail("Solo puedes registrar asistencia de hoy o de días anteriores");
  }

  const { data: client } = await supabase
    .from("profiles")
    .select("plan_type, plan_end_date")
    .eq("id", clientId)
    .single();
  if (getEffectivePlanType(client?.plan_type, client?.plan_end_date ?? null, todayISO()) === "free") {
    fail("Solo se puede registrar asistencia a clientes con un plan activo");
  }

  const { data: slot } = await supabase
    .from("schedule_slots")
    .select("id, service_id, start_time, day_of_week")
    .eq("id", scheduleSlotId)
    .single();
  if (!slot || slot.day_of_week !== dayOfWeekFromISO(sessionDate)) {
    fail("Ese horario no corresponde a la fecha seleccionada");
  }

  const { error } = await supabase.from("bookings").insert({
    user_id: clientId,
    schedule_slot_id: slot!.id,
    service_id: slot!.service_id,
    session_date: sessionDate,
    start_time: slot!.start_time,
    status: "booked",
    // Registered by the admin — nothing for the client to be notified of.
    approval_seen_at: new Date().toISOString(),
  });

  if (error) {
    // Plan/capacity trigger messages are already in Spanish; the unique
    // index on active bookings is the one raw Postgres error to translate.
    fail(error.code === "23505" ? "El cliente ya tiene registrada esa sesión" : error.message);
  }

  revalidateClientPlan(clientId);
  revalidatePath("/admin");
  revalidatePath("/my-bookings");
  redirect(`/admin/clients/${clientId}?attended=1`);
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
