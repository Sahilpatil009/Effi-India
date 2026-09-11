import { createClient } from "@/lib/supabase/server"

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: "Please sign in before starting a call." }, { status: 401 })
  const endpoint = process.env.TOKEN_SERVER_URL
  if (!endpoint) return Response.json({ error: "Voice service is not configured yet." }, { status: 503 })
  let body: { category?: string; language?: string }
  try { body = await request.json() } catch { return Response.json({ error: "Invalid request." }, { status: 400 }) }
  if (!body || !["POWER_OUTAGE", "POTHOLE", "SANITATION"].includes(body.category ?? "") || !["en", "hi"].includes(body.language ?? "")) {
    return Response.json({ error: "Choose a supported category and language." }, { status: 400 })
  }
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return Response.json({ error: "Your session expired. Please sign in again." }, { status: 401 })
  try {
    const upstream = await fetch(endpoint, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ category: body.category, language: body.language }), cache: "no-store", signal: AbortSignal.timeout(15000),
    })
    if (!upstream.ok) return Response.json({ error: "Could not start voice service. Please retry." }, { status: upstream.status === 401 ? 401 : 503 })
    const data = await upstream.json()
    if (typeof data.token !== "string" || typeof data.serverUrl !== "string") throw new Error("Invalid response")
    return Response.json(data, { headers: { "Cache-Control": "no-store" } })
  } catch { return Response.json({ error: "Voice service is unavailable. Please try again." }, { status: 503 }) }
}
