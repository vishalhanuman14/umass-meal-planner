import { NextResponse } from "next/server";

import { isUmassEmail } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  let next = url.searchParams.get("next") ?? "/home";

  if (!next.startsWith("/")) {
    next = "/home";
  }

  if (!code) {
    return NextResponse.redirect(new URL("/auth/error?reason=oauth", url.origin));
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(new URL("/auth/error?reason=oauth", url.origin));
  }

  const email = data.user?.email ?? data.session?.user.email ?? null;

  if (!isUmassEmail(email)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/auth/error?reason=umass", url.origin));
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
