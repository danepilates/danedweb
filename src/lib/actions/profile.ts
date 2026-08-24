"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidUsername, normalizeUsername } from "@/lib/username";
import { checkRateLimit } from "@/lib/rate-limit";

const ALLOWED_AVATAR_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};
const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5 MB

async function uploadAvatarIfPresent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  formData: FormData,
): Promise<{ avatarUrl?: string; error?: string }> {
  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) return {};

  // The <input accept="image/*"> is only a browser hint, not a
  // guarantee — validate the real MIME type and size server-side.
  const ext = ALLOWED_AVATAR_TYPES[file.type];
  if (!ext) {
    return { error: "La foto debe ser JPG, PNG, WEBP o GIF" };
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return { error: "La foto no puede superar 5 MB" };
  }

  const path = `${userId}/avatar.${ext}`;

  const { error } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) return { error: "No se pudo subir la foto" };

  const {
    data: { publicUrl },
  } = supabase.storage.from("avatars").getPublicUrl(path);
  // Cache-bust so the new photo shows immediately.
  return { avatarUrl: `${publicUrl}?t=${Date.now()}` };
}

function parseCoreFields(formData: FormData) {
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
      { profile_id: profileId, field_id: field.id, value: String(raw).slice(0, 2000) },
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

  const allowed = await checkRateLimit(`update-profile:${user.id}`, 20, 60 * 60);
  if (!allowed) {
    redirect(
      `/profile?error=${encodeURIComponent("Demasiados intentos. Espera un momento e inténtalo de nuevo.")}`,
    );
  }

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

  const avatarResult = await uploadAvatarIfPresent(supabase, user.id, formData);
  if (avatarResult.error) {
    redirect(`/profile?error=${encodeURIComponent(avatarResult.error)}`);
  }

  const updates: Record<string, unknown> = { ...parseCoreFields(formData), username };
  if (avatarResult.avatarUrl) updates.avatar_url = avatarResult.avatarUrl;

  await supabase.from("profiles").update(updates).eq("id", user.id);
  await saveCustomValues(supabase, user.id, formData);

  revalidatePath("/profile");
  revalidatePath("/book");
  redirect("/profile?saved=1");
}
