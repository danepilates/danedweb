"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSlotInPast, todayISO } from "@/lib/dates";
import { checkRateLimit } from "@/lib/rate-limit";

export async function createBooking(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const scheduleSlotId = String(formData.get("scheduleSlotId") ?? "");
  const serviceId = String(formData.get("serviceId") ?? "");
  const sessionDate = String(formData.get("sessionDate") ?? "");
  const startTime = String(formData.get("startTime") ?? "");
  const serviceSlug = String(formData.get("serviceSlug") ?? "");

  const allowed = await checkRateLimit(`create-booking:${user.id}`, 30, 60 * 60);
  if (!allowed) {
    redirect(
      `/book?${new URLSearchParams({ service: serviceSlug, month: todayISO().slice(0, 7), date: todayISO(), error: "Demasiadas reservas en poco tiempo. Espera un momento." })}`,
    );
  }

  if (sessionDate < todayISO()) {
    redirect(
      `/book?${new URLSearchParams({ service: serviceSlug, month: todayISO().slice(0, 7), date: todayISO(), error: "No puedes reservar una fecha pasada" })}`,
    );
  }

  if (isSlotInPast(sessionDate, startTime)) {
    redirect(
      `/book?${new URLSearchParams({ service: serviceSlug, month: sessionDate.slice(0, 7), date: sessionDate, error: "Esta sesión ya comenzó" })}`,
    );
  }

  const { data: blockedDate } = await supabase
    .from("blocked_dates")
    .select("id")
    .eq("date", sessionDate)
    .maybeSingle();

  if (blockedDate) {
    redirect(
      `/book?${new URLSearchParams({ service: serviceSlug, month: sessionDate.slice(0, 7), date: sessionDate, error: "El estudio está cerrado en esta fecha" })}`,
    );
  }

  const { data: inserted, error } = await supabase
    .from("bookings")
    .insert({
      user_id: user.id,
      schedule_slot_id: scheduleSlotId,
      service_id: serviceId,
      session_date: sessionDate,
      start_time: startTime,
    })
    .select("id")
    .single();

  const params = new URLSearchParams({
    service: serviceSlug,
    month: sessionDate.slice(0, 7),
    date: sessionDate,
  });
  if (error) {
    params.set("error", error.message);
  } else if (inserted) {
    params.set("confirmed", inserted.id);
  }

  revalidatePath("/book");
  redirect(`/book?${params.toString()}`);
}

export async function cancelBooking(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const bookingId = String(formData.get("bookingId") ?? "");
  const serviceSlug = String(formData.get("serviceSlug") ?? "");
  const sessionDate = String(formData.get("sessionDate") ?? "");
  const redirectTo = String(formData.get("redirectTo") ?? "/book");

  await supabase
    .from("bookings")
    .update({ status: "cancelled" })
    .eq("id", bookingId)
    .eq("user_id", user.id);

  revalidatePath("/book");
  revalidatePath("/my-bookings");

  if (redirectTo === "/my-bookings") {
    redirect("/my-bookings");
  }
  const params = new URLSearchParams({
    service: serviceSlug,
    month: sessionDate.slice(0, 7),
    date: sessionDate,
  });
  redirect(`/book?${params.toString()}`);
}
