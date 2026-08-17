"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidUsername, normalizeUsername } from "@/lib/username";

async function uploadAvatarIfPresent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  formData: FormData,
): Promise<string | undefined> {
  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) return undefined;

  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${userId}/avatar.${ext}`;

  const { error } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) return undefined;

  const {
    data: { publicUrl },
  } = supabase.storage.from("avatars").getPublicUrl(path);
  // Cache-bust so the new photo shows immediately.
  return `${publicUrl}?t=${Date.now()}`;
}

function parseCoreFields(formData: FormData) {
  const numberOrNull = (v: FormDataEntryValue | null) =>
    v && String(v).trim() !== "" ? Number(v) : null;

  return {
    full_name: String(formData.get("fullName") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim(),
    age: numberOrNull(formData.get("age")),
    height_cm: numberOrNull(formData.get("heightCm")),
    weight_kg: numberOrNull(formData.get("weightKg")),
    medical_conditions: String(formData.get("medicalConditions") ?? "").trim(),
    injuries: String(formData.get("injuries") ?? "").trim(),
    allergies: String(formData.get("allergies") ?? "").trim(),
  };
}

async function saveCustomValues(
  supabase: Awaited<ReturnType<typeof createClient>>,
  profileId: string,
  formData: FormData,
) {
  const { data: fields } = await supabase.from("custom_fields").select("id");
  for (const field of fields ?? []) {
    const raw = formData.get(`custom_${field.id}`);
    if (raw === null) continue;
    await supabase.from("profile_custom_values").upsert(
      { profile_id: profileId, field_id: field.id, value: String(raw) },
      { onConflict: "profile_id,field_id" },
    );
  }
}

export async function updateOwnProfile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const username = normalizeUsername(String(formData.get("username") ?? ""));
  if (!isValidUsername(username)) {
    redirect(
      `/profile?error=${encodeURIComponent("El usuario debe tener 3-20 caracteres: solo letras y números")}`,
    );
  }

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .ilike("username", username)
    .neq("id", user.id)
    .maybeSingle();

  if (existing) {
    redirect(`/profile?error=${encodeURIComponent("Ese usuario ya está en uso")}`);
  }

  const avatarUrl = await uploadAvatarIfPresent(supabase, user.id, formData);
  const updates: Record<string, unknown> = { ...parseCoreFields(formData), username };
  if (avatarUrl) updates.avatar_url = avatarUrl;

  await supabase.from("profiles").update(updates).eq("id", user.id);
  await saveCustomValues(supabase, user.id, formData);

  revalidatePath("/profile");
  revalidatePath("/book");
  redirect("/profile?saved=1");
}
