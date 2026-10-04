"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { LiveKitRoom, VideoConference, RoomAudioRenderer, useDataChannel, useParticipants } from "@livekit/components-react"
import "@livekit/components-styles"
import { BadgeCheck, Clock, Loader2, UserCheck, X, XCircle } from "lucide-react"
import { TRIAL_DURATION_MIN } from "@/lib/trial"
import { formatDuration } from "@/lib/live-chat"

interface TrialData {
  roomUrl: string
  token: string
  role: "candidate" | "reviewer"
  teacher: { id: string; name: string | null; trialNote: string | null }
}

type Decision = { type: "APPROVED" | "REJECTED"; note?: string } | null

const roleOf = (metadata?: string) => {
  try {
    return JSON.parse(metadata || "{}").role as string | undefined
  } catch {
    return undefined
  }
}

/** Private trial room: the teacher candidate and the admin reviewing them. */
export default function TrialRoom({ teacherId }: { teacherId: string }) {
  const router = useRouter()
  const [data, setData] = useState<TrialData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/room/trial", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ teacherId }) })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}))
        if (r.status === 403 && d.code === "TERMS_REQUIRED") return router.replace(`/accept-terms?next=/room/trial/${teacherId}`)
        if (!r.ok) throw new Error(d.error || "Odaya girilemedi.")
        setData(d)
      })
      .catch((e) => setError(e.message))
  }, [teacherId, router])

  if (error) {
    return (
      <div className="min-h-screen bg-stage text-white flex flex-col items-center justify-center gap-5 px-6 text-center">
        <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center"><X size={28} /></div>
        <h1 className="font-display text-3xl">Odaya girilemedi</h1>
        <p className="text-white/60 max-w-md" data-testid="trial-error">{error}</p>
        <Link href="/dashboard" className="bg-accent hover:bg-accent-dark px-6 py-2.5 rounded-md text-sm font-semibold">Panele dön</Link>
      </div>
    )
  }
  if (!data) {
    return <div className="min-h-screen bg-stage flex items-center justify-center text-white/70"><Loader2 className="animate-spin" /></div>
  }

  return (
    <div className="h-screen w-screen bg-stage text-white flex flex-col overflow-hidden" data-lk-theme="default">
      <header className="h-14 shrink-0 flex items-center gap-3 px-5 border-b border-white/10 bg-stage-2">
        <span className="font-display text-xl tracking-[0.25em]">AYA</span>
        <span className="text-white/30">/</span>
        <span className="text-sm text-white/70" data-testid="trial-title">
          Deneme yayını · {data.teacher.name}
        </span>
        <span className="ml-auto text-xs text-white/50">Bu oda özeldir; yalnızca aday ve yetkililer girebilir.</span>
      </header>
      <main className="flex-1 min-h-0 flex">
        <LiveKitRoom
          video
          audio
          token={data.token}
          serverUrl={data.roomUrl}
          connect
          className="flex-1 min-w-0 flex"
          onDisconnected={() => {}}
        >
          <div className="flex-1 min-w-0 relative">
            <VideoConference />
            <RoomAudioRenderer />
          </div>
          <Panel data={data} />
        </LiveKitRoom>
      </main>
    </div>
  )
}

function Panel({ data }: { data: TrialData }) {
  const router = useRouter()
  const participants = useParticipants()
  const [decision, setDecision] = useState<Decision>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())

  const reviewers = useMemo(() => participants.filter((p) => roleOf(p.metadata) === "reviewer"), [participants])
  const candidateIn = participants.some((p) => roleOf(p.metadata) === "candidate")
  useDataChannel("trial-decision", (m) => {
    try {
      setDecision(JSON.parse(new TextDecoder().decode(m.payload)))
    } catch {}
  })

  // the 5-minute clock starts when both sides are present
  useEffect(() => {
    if (reviewers.length > 0 && candidateIn && startedAt === null) setStartedAt(Date.now())
  }, [reviewers.length, candidateIn, startedAt])
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  const elapsed = startedAt ? (now - startedAt) / 1000 : 0
  const remaining = Math.max(0, TRIAL_DURATION_MIN * 60 - elapsed)

  const decide = async (action: "approve" | "reject") => {
    let note: string | undefined
    if (action === "reject") {
      const r = prompt("Reddetme gerekçesi (öğretmene iletilir):")
      if (r === null) return
      if (!r.trim()) return setMsg("Gerekçe yazmalısınız.")
      note = r
    } else if (!confirm(`${data.teacher.name} onaylansın mı? Onaylandığında herkese açık ders ve yayın verebilir.`)) return

    setBusy(true)
    setMsg(null)
    const res = await fetch(`/api/admin/teachers/${data.teacher.id}/trial`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, note }),
    })
    const body = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) return setMsg(body.error || "İşlem başarısız oldu.")
    // the server also broadcasts the decision to the room, so the candidate sees it too
    setDecision({ type: action === "approve" ? "APPROVED" : "REJECTED", note })
    setTimeout(() => router.push("/admin?tab=trials"), 2500)
  }

  return (
    <aside className="w-80 shrink-0 border-l border-white/10 bg-stage-2 p-5 overflow-y-auto space-y-5" data-testid="trial-panel">
      {decision ? (
        <div data-testid="trial-decision" className={`rounded-lg p-4 border ${decision.type === "APPROVED" ? "border-emerald-500/40 bg-emerald-500/10" : "border-red-500/40 bg-red-500/10"}`}>
          <p className="font-display text-2xl mb-1">{decision.type === "APPROVED" ? "Onaylandı 🎉" : "Onaylanmadı"}</p>
          <p className="text-sm text-white/70">
            {decision.type === "APPROVED"
              ? data.role === "candidate"
                ? "Artık herkese açık ders ve yayın verebilirsiniz."
                : "Öğretmen artık ders ve yayın açabilir."
              : decision.note || "Yetkili bu kez onaylamadı."}
          </p>
          {data.role === "candidate" && (
            <Link href="/teach" className="inline-block mt-3 bg-accent hover:bg-accent-dark px-4 py-2 rounded-md text-sm font-semibold">Panele dön</Link>
          )}
        </div>
      ) : (
        <>
          <div>
            <p className="eyebrow !text-white/50 mb-2">Durum</p>
            {data.role === "candidate" ? (
              <p data-testid="trial-status" className="flex items-center gap-2 text-sm">
                {reviewers.length > 0 ? <><UserCheck size={16} className="text-emerald-400" /> Yetkili odada, değerlendiriliyorsunuz.</> : <><Loader2 size={16} className="animate-spin" /> Yetkili bekleniyor…</>}
              </p>
            ) : (
              <p data-testid="trial-status" className="flex items-center gap-2 text-sm">
                {candidateIn ? <><UserCheck size={16} className="text-emerald-400" /> Aday odada.</> : <><Loader2 size={16} className="animate-spin" /> Aday henüz girmedi…</>}
              </p>
            )}
          </div>

          <div className="rounded-lg bg-white/5 p-4">
            <p className="flex items-center gap-2 text-sm text-white/70"><Clock size={15} /> {TRIAL_DURATION_MIN} dakikalık deneme</p>
            <p className="font-display text-4xl mt-1 tabular-nums" data-testid="trial-timer">{formatDuration(startedAt ? remaining : TRIAL_DURATION_MIN * 60)}</p>
            {startedAt && remaining === 0 && <p className="text-xs text-amber-300 mt-1">Süre doldu; yetkili karar verebilir.</p>}
          </div>

          {data.role === "candidate" ? (
            <div className="text-sm text-white/70 space-y-2">
              <p>Yetkililer sizi birkaç dakika izleyecek. Şunları gösterin:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Kendinizi ve dersin içeriğini tanıtın.</li>
                <li>Bir pozu / nefes çalışmasını örnekleyin.</li>
                <li>Görüntü ve ses kalitenizi gösterin.</li>
              </ul>
              {data.teacher.trialNote && <p className="rounded-md bg-amber-500/10 border border-amber-500/30 p-3 text-amber-200">Önceki değerlendirme notu: {data.teacher.trialNote}</p>}
            </div>
          ) : (
            <div className="space-y-3">
              <button data-testid="room-approve" disabled={busy} onClick={() => decide("approve")} className="w-full inline-flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 py-3 rounded-md text-sm font-semibold disabled:opacity-50">
                {busy ? <Loader2 size={15} className="animate-spin" /> : <BadgeCheck size={16} />} Onayla
              </button>
              <button data-testid="room-reject" disabled={busy} onClick={() => decide("reject")} className="w-full inline-flex items-center justify-center gap-2 border border-red-500/50 text-red-300 hover:bg-red-500/10 py-3 rounded-md text-sm font-semibold disabled:opacity-50">
                <XCircle size={16} /> Reddet
              </button>
              {msg && <p role="alert" className="text-sm text-red-300">{msg}</p>}
            </div>
          )}
        </>
      )}
    </aside>
  )
}
