import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/book";

  const supabase = await createClient();

  // Supabase can send either link format depending on the project's Auth
  // flow setting: PKCE links carry just "code" (exchanged for a session),
  // while the older OTP-style links carry "token_hash" + "type". Handle
  // both so this route doesn't silently break if that setting changes.
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url));
    }
  } else if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url));
    }
  }

  // Link expired/already used/invalid — send them home to sign in again
  // rather than stranding them on an error page. If their email is
  // already confirmed from an earlier valid click, login just works.
  return NextResponse.redirect(new URL("/", request.url));
}
