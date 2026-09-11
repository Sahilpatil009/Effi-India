import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/dashboard/auth"
import { CitizenShell } from "@/components/citizen/shell"
import { VoiceReport } from "@/components/citizen/voice-report"
import type { ComplaintCategory } from "@/lib/dashboard/types"

export default async function ReportPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const user = await getCurrentUser()
  if (!user) redirect("/login")
  const { category } = await searchParams
  if (!["POWER_OUTAGE", "POTHOLE", "SANITATION"].includes(category ?? "")) redirect("/")
  return <CitizenShell><VoiceReport category={category as ComplaintCategory} /></CitizenShell>
}
