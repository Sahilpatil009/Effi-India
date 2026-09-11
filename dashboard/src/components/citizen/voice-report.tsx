"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Room, RoomEvent, Track, type RpcInvocationData } from "livekit-client"
import { Mic, MapPin, CheckCircle2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type { ComplaintCategory } from "@/lib/dashboard/types"

type Action = { id: string; kind: "location" | "photo"; prompt: string; finish: (result: object) => void }
type Line = { id: string; text: string; speaker: string }
const labels = { POWER_OUTAGE: "Power outage", POTHOLE: "Road damage", SANITATION: "Sanitation" }
const button = "rounded-xl bg-[#185079] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"

export function VoiceReport({ category }: { category: ComplaintCategory }) {
  const [language, setLanguage] = useState("en")
  const [status, setStatus] = useState("Ready to start")
  const [active, setActive] = useState(false)
  const [error, setError] = useState("")
  const [lines, setLines] = useState<Line[]>([])
  const [action, setAction] = useState<Action | null>(null)
  const [busy, setBusy] = useState(false)
  const [receipt, setReceipt] = useState<{ complaintId: string; ticketNumber: string } | null>(null)
  const [muted, setMuted] = useState(false)
  const roomRef = useRef<Room | null>(null)
  const actionRef = useRef<Action | null>(null)
  const audioRef = useRef<HTMLDivElement>(null)
  const generation = useRef(0)

  useEffect(() => () => {
    generation.current++
    actionRef.current?.finish({ status: "cancelled", message: "Call ended." })
    void roomRef.current?.disconnect()
    roomRef.current = null
  }, [])

  function end() {
    generation.current++
    actionRef.current?.finish({ status: "cancelled", message: "Call ended." })
    const room = roomRef.current
    roomRef.current = null
    void room?.disconnect()
    audioRef.current?.replaceChildren()
    setActive(false)
    setStatus("Call ended")
  }

  async function start() {
    if (roomRef.current) return
    const run = ++generation.current
    const room = new Room()
    roomRef.current = room
    setError(""); setReceipt(null); setLines([]); setActive(true); setMuted(false)
    setStatus("Connecting…")
    const isCurrent = () => generation.current === run && roomRef.current === room
    function requestAction(kind: Action["kind"], data: RpcInvocationData) {
      if (!isCurrent()) return Promise.resolve(JSON.stringify({ status: "cancelled" }))
      actionRef.current?.finish({ status: "cancelled", message: "Replaced by a new request." })
      return new Promise<string>((resolve) => {
        let prompt = kind === "location" ? "Share your current device location." : "Add a photo of the issue."
        try { const payload = JSON.parse(data.payload); if (typeof payload.prompt === "string") prompt = payload.prompt } catch { /* Use the default prompt. */ }
        let settled = false
        const pending: Action = { id: data.requestId, kind, prompt, finish(result) {
          if (settled) return
          settled = true
          clearTimeout(timer)
          if (actionRef.current === pending) { actionRef.current = null; setAction(null); setBusy(false) }
          resolve(JSON.stringify(result))
        } }
        const timer = setTimeout(() => {
          pending.finish({ status: "error", message: "The action timed out. Ask the citizen to retry." })
          if (isCurrent()) setError("That request expired. Ask Effi to request it again.")
        }, Math.max(1, data.responseTimeout - 500))
        actionRef.current = pending; setAction(pending)
      })
    }
    room.localParticipant.registerRpcMethod("effi.provide_location", (data) => requestAction("location", data))
    room.localParticipant.registerRpcMethod("effi.provide_photo", (data) => requestAction("photo", data))
    room.on(RoomEvent.TrackSubscribed, (track) => {
      if (track.kind === Track.Kind.Audio && isCurrent()) audioRef.current?.appendChild(track.attach())
    })
    room.on(RoomEvent.TrackUnsubscribed, (track) => track.detach().forEach((element) => element.remove()))
    room.on(RoomEvent.TranscriptionReceived, (segments, participant) => {
      if (!isCurrent()) return
      setLines((previous) => {
        const next = [...previous]
        for (const segment of segments) {
          const line = { id: `${participant?.identity}-${segment.id}`, text: segment.text, speaker: participant?.identity === room.localParticipant.identity ? "You" : "Effi" }
          const index = next.findIndex((item) => item.id === line.id)
          if (index < 0) next.push(line); else next[index] = line
        }
        return next
      })
    })
    room.on(RoomEvent.ParticipantAttributesChanged, (_, participant) => {
      if (isCurrent() && participant.attributes["lk.agent.state"]) setStatus(participant.attributes["lk.agent.state"])
    })
    room.on(RoomEvent.DataReceived, (payload, participant, _, topic) => {
      if (!isCurrent() || topic !== "effi.complaint" || !participant?.isAgent) return
      try {
        const result = JSON.parse(new TextDecoder().decode(payload))
        if (result.type === "complaint_registered" && typeof result.complaintId === "string" && typeof result.ticketNumber === "string") setReceipt(result)
      } catch { /* Ignore unrelated or malformed data. */ }
    })
    room.on(RoomEvent.Reconnecting, () => { if (isCurrent()) setStatus("Reconnecting…") })
    room.on(RoomEvent.Reconnected, () => { if (isCurrent()) setStatus("Connected") })
    room.on(RoomEvent.Disconnected, () => {
      if (isCurrent()) end()
    })
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Microphone access needs HTTPS or localhost and a supported browser.")
      // Ask permission before allocating a paid voice session.
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach((track) => track.stop())
      if (!isCurrent()) return
      const response = await fetch("/api/voice/token", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ category, language }), signal: AbortSignal.timeout(20000) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? "Unable to start the call.")
      if (!isCurrent()) return
      await room.connect(result.serverUrl, result.token)
      if (!isCurrent()) { await room.disconnect(); return }
      await room.localParticipant.setMicrophoneEnabled(true)
      if (!isCurrent()) { await room.disconnect(); return }
      await room.startAudio()
      setStatus("Connected · waiting for Effi")
    } catch (cause) {
      if (isCurrent()) { end(); setError(cause instanceof Error ? cause.message : "Unable to start. Check microphone permission and retry.") }
    }
  }

  function shareLocation() {
    const pending = actionRef.current
    if (!pending || busy) return
    if (!navigator.geolocation) { pending.finish({ status: "error", message: "Geolocation unavailable." }); setError("Device location is unavailable in this browser."); return }
    setBusy(true); setError("")
    navigator.geolocation.getCurrentPosition(({ coords, timestamp }) => {
      if (actionRef.current !== pending) return
      pending.finish({ status: "ok", location: { coords: { latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy, altitude: coords.altitude, altitudeAccuracy: coords.altitudeAccuracy, heading: coords.heading, speed: coords.speed }, timestamp } })
    }, (failure) => {
      if (actionRef.current !== pending) return
      pending.finish({ status: failure.code === 1 ? "denied" : "error", message: failure.message })
      setError("Location could not be shared. Check browser permission and ask Effi to retry.")
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 })
  }

  async function upload(file?: File) {
    const pending = actionRef.current
    const room = roomRef.current
    if (!pending || !room || !file) return
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) { setError("Choose a JPG, PNG or WebP image smaller than 5 MB."); return }
    setBusy(true); setError("")
    const extension = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[file.type]
    const path = `${category.toLowerCase()}/${room.name}/${crypto.randomUUID()}.${extension}`
    try {
      const supabase = createClient()
      const { error: failure } = await supabase.storage.from("complaint-evidence").upload(path, file, { contentType: file.type, upsert: false })
      if (failure) throw failure
      if (actionRef.current !== pending) return
      const { data } = supabase.storage.from("complaint-evidence").getPublicUrl(path)
      pending.finish({ status: "ok", photoUrl: data.publicUrl })
    } catch {
      if (actionRef.current === pending) { pending.finish({ status: "error", message: "Photo upload failed." }); setError("Photo upload failed. Ask Effi to request it again.") }
    }
  }

  return <div className="mx-auto max-w-3xl">
    <Link href="/" className="text-sm text-[#185079]">← All categories</Link>
    <h1 className="mt-5 text-3xl font-semibold">Report {labels[category].toLowerCase()}</h1>
    <p className="mt-3 text-slate-500">Describe the issue in your own words. Effi will guide you through the details.</p>
    <div className="mt-8 rounded-2xl border bg-white p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4"><div className="flex items-center gap-3"><span className="rounded-full bg-sky-50 p-4 text-[#185079]"><Mic /></span><div><p className="font-semibold">Effi voice assistant</p><p role="status" className="text-sm capitalize text-slate-500">{status}</p></div></div>
        <label className="text-sm">Language<select className="ml-2 rounded-lg border p-2" disabled={active} value={language} onChange={(event) => setLanguage(event.target.value)}><option value="en">English</option><option value="hi">Hindi</option></select></label>
      </div>
      <div role="log" aria-label="Conversation transcript" className="my-6 max-h-80 min-h-40 space-y-4 overflow-y-auto rounded-xl bg-slate-50 p-5">
        {lines.length ? lines.map((line) => <div key={line.id}><p className="text-xs font-semibold text-[#185079]">{line.speaker}</p><p className="mt-1 leading-relaxed">{line.text}</p></div>) : <p className="text-sm text-slate-500">Your conversation will appear here after you start. You can end the call at any time.</p>}
      </div>
      {action && <section className="mb-5 rounded-xl border border-sky-200 bg-sky-50 p-5"><p className="mb-4 font-medium">{action.prompt}</p>
        {action.kind === "location" ? <button className={button} disabled={busy} onClick={shareLocation}><MapPin className="mr-2 inline size-4" />{busy ? "Finding location…" : "Share device location"}</button> : <label className="block text-sm font-medium">{busy ? "Uploading photo…" : "Choose an evidence photo (up to 5 MB)"}<input aria-label="Evidence photo" type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} className="mt-3 block w-full text-sm" onChange={(event) => void upload(event.target.files?.[0])} /></label>}
        <button className="ml-4 text-sm underline" onClick={() => action.finish({ status: "cancelled", message: "Citizen cancelled." })}>Cancel</button>
      </section>}
      {error && <p role="alert" className="mb-5 rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      {receipt && <section className="mb-5 rounded-xl bg-emerald-50 p-5 text-emerald-900"><CheckCircle2 className="mb-2" /><h2 className="font-semibold">Complaint registered</h2><p className="mt-2 break-all font-mono text-sm">{receipt.ticketNumber}</p><Link className="mt-3 inline-block underline" href={`/requests/${receipt.complaintId}`}>View your ticket</Link></section>}
      <div className="flex flex-wrap gap-3">{active ? <>
        <button className="rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white" onClick={end}>End call</button>
        <button className="rounded-xl border px-5 py-3 text-sm" onClick={async () => { try { await roomRef.current?.localParticipant.setMicrophoneEnabled(muted); setMuted(!muted) } catch { setError("Could not change microphone. Check browser permissions.") } }}>{muted ? "Unmute" : "Mute"}</button>
        <button className="rounded-xl border px-5 py-3 text-sm" onClick={() => void roomRef.current?.startAudio().catch(() => setError("Browser blocked audio. Check site sound permissions."))}>Enable sound</button>
      </> : <button className={button} onClick={() => void start()}>Start voice report</button>}<Link href="/requests" className="px-4 py-3 text-sm text-[#185079]">My requests →</Link></div>
      <div ref={audioRef} className="hidden" />
    </div>
  </div>
}
