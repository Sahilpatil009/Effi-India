import Link from "next/link"
import { ArrowUpRight, Mic, MapPin, CheckCircle2, Trash2, Construction, Zap } from "lucide-react"
import { CitizenShell } from "@/components/citizen/shell"

const categories = [
  { id: "POWER_OUTAGE", title: "Power outage", text: "Report a power cut or an electricity supply issue.", icon: Zap, tag: "Location required" },
  { id: "POTHOLE", title: "Road damage", text: "Flag a pothole or damaged road in your neighbourhood.", icon: Construction, tag: "Location + photo" },
  { id: "SANITATION", title: "Sanitation", text: "Report overflowing bins, waste or missed garbage collection.", icon: Trash2, tag: "Location + photo" },
]
export default function Home() {
  return <CitizenShell>
    <section className="max-w-3xl">
      <p className="mb-5 text-xs font-bold uppercase tracking-[0.2em] text-[#185079]">Your voice. Your neighbourhood.</p>
      <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">A better neighbourhood<br /><span className="text-[#185079]">starts with your voice.</span></h1>
      <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-600">Tell Effi what happened. Share your location, add evidence, and track your complaint from one place.</p>
    </section>
    <section className="mt-12" aria-labelledby="categories">
      <h2 id="categories" className="mb-5 text-lg font-semibold">What would you like to report?</h2>
      <div className="grid gap-5 md:grid-cols-3">{categories.map(({ id, title, text, icon: Icon, tag }) =>
        <Link key={id} href={`/report?category=${id}`} className="group rounded-2xl border border-slate-200 bg-white p-7 transition hover:-translate-y-1 hover:border-[#185079] hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-4">
          <div className="mb-8 flex items-center justify-between"><span className="rounded-xl bg-sky-50 p-3 text-[#185079]"><Icon className="size-6" /></span><ArrowUpRight className="size-5 text-slate-400 group-hover:text-[#185079]" /></div>
          <h3 className="text-xl font-semibold">{title}</h3><p className="mt-3 min-h-14 text-sm leading-relaxed text-slate-500">{text}</p><p className="mt-6 text-xs font-medium text-[#185079]">{tag}</p>
        </Link>)}</div>
    </section>
    <section className="mt-12 grid gap-6 rounded-2xl bg-[#e8f0f5] p-7 sm:grid-cols-3" aria-label="How it works">
      {[{ icon: Mic, title: "01 · Tell your story", text: "Speak naturally in English or Hindi." }, { icon: MapPin, title: "02 · Share the details", text: "Use device location and a supporting photo." }, { icon: CheckCircle2, title: "03 · Follow your request", text: "Get a ticket and see status updates." }].map(({ icon: Icon, title, text }) => <div key={title}><Icon className="mb-3 size-5 text-[#185079]" /><h3 className="font-semibold">{title}</h3><p className="mt-2 text-sm text-slate-600">{text}</p></div>)}
    </section>
  </CitizenShell>
}
