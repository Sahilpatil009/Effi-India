import Link from "next/link"
import { redirect } from "next/navigation"
import { CitizenShell } from "@/components/citizen/shell"
import { LiveRequests } from "@/components/citizen/live-requests"
import { createClient } from "@/lib/supabase/server"

export default async function RequestsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  const { data, error } = await supabase.from("complaints").select("id,ticket_number,summary,status,created_at")
    .eq("user_id", user.id).order("created_at", { ascending: false }).limit(100)
  return <CitizenShell><h1 className="text-3xl font-semibold">My requests</h1><p className="mt-3 text-slate-500">Follow your recent complaints and their current status. New tickets and status changes appear live — no reload needed.</p><LiveRequests userId={user.id} />
    {error ? <p role="alert" className="rounded-xl bg-red-50 p-5 text-red-700">Could not load your requests. Try refreshing.</p> : data?.length ? <div className="grid gap-4">{data.map((row) => <Link className="rounded-xl border bg-white p-6 hover:border-[#185079]" key={row.id} href={`/requests/${row.id}`}><div className="flex flex-wrap justify-between gap-3"><h2 className="font-semibold">{row.summary}</h2><span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-medium capitalize text-[#185079]">{row.status.replaceAll("_", " ")}</span></div><p className="mt-3 break-all text-xs text-slate-500">{row.ticket_number} · {new Date(row.created_at).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}</p></Link>)}</div> : <div className="rounded-2xl border bg-white p-10"><h2 className="text-xl font-semibold">No requests yet</h2><p className="mt-3 text-slate-500">Your saved complaints will appear here.</p><Link className="mt-6 inline-block text-[#185079] underline" href="/">Report your first issue</Link></div>}
  </CitizenShell>
}
