import { NextResponse, type NextRequest } from "next/server"

import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")
  const requested = requestUrl.searchParams.get("next") ?? "/"
  const next = requested.startsWith("/") && !requested.startsWith("//") && !requested.includes("\\") ? requested : "/"

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      return NextResponse.redirect(new URL(next, requestUrl.origin))
    }
  }

  const loginUrl = new URL("/login", requestUrl.origin)
  loginUrl.searchParams.set("error", "Could not complete sign in.")
  return NextResponse.redirect(loginUrl)
}
