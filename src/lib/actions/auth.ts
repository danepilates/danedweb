"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidUsername, normalizeUsername } from "@/lib/username";

export async function login(formData: FormData) {
  const username = normalizeUsername(String(formData.get("username") ?? ""));
  const password = String(formData.get("password") ?? "");

  const genericError = "Usuario o contraseña inválidos";

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .ilike("username", username)
    .maybeSingle();

  if (!profile) {
    redirect(`/login?error=${encodeURIComponent(genericError)}`);
  }

  const { data: userData, error: lookupError } =
    await admin.auth.admin.getUserById(profile.id);

  if (lookupError || !userData.user?.email) {
    redirect(`/login?error=${encodeURIComponent(genericError)}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: userData.user.email,
    password,
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(genericError)}`);
  }

  revalidatePath("/", "layout");
  redirect("/book");
}

export async function signup(formData: FormData) {
  const supabase = await createClient();
  const admin = createAdminClient();

  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("fullName") ?? "");
  const phone = String(formData.get("phone") ?? "");
  const username = normalizeUsername(String(formData.get("username") ?? ""));
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  if (!isValidUsername(username)) {
    redirect(
      `/signup?error=${encodeURIComponent("El usuario debe tener 3-20 caracteres: solo letras y números")}`,
    );
  }

  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .ilike("username", username)
    .maybeSingle();

  if (existing) {
    redirect(`/signup?error=${encodeURIComponent("Ese usuario ya está en uso")}`);
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${origin}/auth/confirm`,
    },
  });

  if (error) {
    redirect(`/signup?error=${encodeURIComponent(error.message)}`);
  }

  // The DB trigger creates the profile row with full_name; add the phone
  // number and username the trigger doesn't know about. Use the admin
  // client here: when email confirmation is required, signUp() doesn't
  // establish a session, so the regular session-bound client has no
  // auth.uid() and RLS would silently block this write.
  if (data.user) {
    const { error: profileError } = await admin
      .from("profiles")
      .update({ phone, username })
      .eq("id", data.user.id);

    if (profileError) {
      // Someone else grabbed the same username in the moment between our
      // check above and now — roll back the auth account rather than
      // leave it stuck with no usable username.
      await admin.auth.admin.deleteUser(data.user.id);
      redirect(`/signup?error=${encodeURIComponent("Ese usuario ya está en uso")}`);
    }
  }

  redirect("/signup/check-email");
}

export async function updatePassword(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const password = String(formData.get("password") ?? "");
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    redirect(`/update-password?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/book");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
