"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

export function LiveRequests({ userId }: { userId: string }) {
  const router = useRouter()
  const [connected, setConnected] = useState(false)
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase.channel(`citizen-requests-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "complaints", filter: `user_id=eq.${userId}` }, () => router.refresh())
      .subscribe((status) => setConnected(status === "SUBSCRIBED"))
    const refresh = () => router.refresh()
    window.addEventListener("focus", refresh)
    return () => { void supabase.removeChannel(channel); window.removeEventListener("focus", refresh) }
  }, [router, userId])
  return <div className="my-5 flex items-center gap-4 text-sm text-slate-500"><span>{connected ? "Live updates connected" : "Connecting to live updates…"}</span><button className="text-[#185079] underline" onClick={() => router.refresh()}>Refresh</button></div>
}
