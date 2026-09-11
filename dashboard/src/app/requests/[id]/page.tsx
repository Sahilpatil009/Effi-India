import Link from "next/link"
import Image from "next/image"
import { notFound, redirect } from "next/navigation"
import { CitizenShell } from "@/components/citizen/shell"
import { LiveRequests } from "@/components/citizen/live-requests"
import { createClient } from "@/lib/supabase/server"

export default async function RequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  const { data: complaint, error } = await supabase.from("complaints").select("id,ticket_number,summary,description,status,created_at,category").eq("id", id).eq("user_id", user.id).maybeSingle()
  if (error) throw new Error("Unable to load this request. Please retry.")
  if (!complaint) notFound()
  const [{ data: evidence, error: evidenceError }, { data: location, error: locationError }] = await Promise.all([
    supabase.from("complaint_evidence").select("id,public_url").eq("complaint_id", id),
    supabase.from("complaint_locations").select("latitude,longitude,accuracy").eq("complaint_id", id).maybeSingle(),
  ])
  return <CitizenShell><Link href="/requests" className="text-sm text-[#185079]">← My requests</Link><h1 className="mt-5 text-3xl font-semibold">{complaint.summary}</h1><p className="mt-3 break-all font-mono text-sm text-slate-500">{complaint.ticket_number}</p><LiveRequests userId={user.id} />
    <section className="rounded-2xl border bg-white p-7"><h2 className="font-semibold">Current progress</h2><ol className="mt-5 grid gap-3 sm:grid-cols-3">{["open", "in_progress", "resolved"].map((status) => <li aria-current={status === complaint.status ? "step" : undefined} key={status} className={`rounded-xl p-4 text-sm capitalize ${status === complaint.status ? "bg-[#185079] font-semibold text-white" : "bg-slate-100 text-slate-500"}`}>{status.replaceAll("_", " ")}</li>)}</ol><p className="mt-7 leading-relaxed">{complaint.description}</p>
      {location && <p className="mt-5 text-sm text-slate-500">Device location: {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}{location.accuracy != null ? ` · accuracy ±${Math.round(location.accuracy)} m` : ""}</p>}
      {(evidenceError || locationError) && <p className="mt-5 text-sm text-red-700">Some supporting details could not be loaded. Please refresh.</p>}
      {evidence?.map((item) => <Image key={item.id} src={item.public_url} alt="Photo evidence submitted with this complaint" width={800} height={600} unoptimized className="mt-6 max-h-80 w-full rounded-xl object-contain" />)}
    </section>
  </CitizenShell>
}
