"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Link2, Loader2, Radio, Users, X } from "lucide-react"
import { formatDuration } from "@/lib/live-chat"
import { useLiveRoom } from "./use-live-room"
import { LivePlayer } from "./live-player"
import { LiveChatPanel } from "./live-chat-panel"
import { StaffNoticeBanner } from "./staff-notice"
import { TeacherBadge } from "@/components/teacher-badge"
import { ReportButton, ReportDialog, ReportChatMessage } from "@/components/report-dialog"
import type { ChatMessage } from "@/lib/live-chat"

interface StreamInfo {
  id: string
  title: string
  startedAt: string
  hostIdentity: string
  supervised?: boolean
  teacher: { id: string; name: string | null; image: string | null; trial?: boolean }
}

type Phase = "loading" | "watching" | "ended" | "error" | "locked"

export function ViewerPage({ liveRoomId }: { liveRoomId: string }) {
  const router = useRouter()
  const [stream, setStream] = useState<StreamInfo | null>(null)
  const [phase, setPhase] = useState<Phase>("loading")
  const [errorMsg, setErrorMsg] = useState("")
  const [theater, setTheater] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const [copied, setCopied] = useState(false)
  const [reportMsg, setReportMsg] = useState<ReportChatMessage | null>(null)
  const [lockedWorkshop, setLockedWorkshop] = useState<{ slug: string; title: string } | null>(null)

  const live = useLiveRoom({ hostIdentity: stream?.hostIdentity, isHost: false })
  const { room, connect } = live

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  // fetch a viewer token, then connect
  const join = useCallback(async () => {
    try {
      const res = await fetch(`/api/live/${liveRoomId}/join`, { method: "POST" })
      const data = await res.json().catch(() => ({}))
      if (res.status === 401) return router.replace(`/login?callbackUrl=/live/${liveRoomId}`)
      if (res.status === 403 && data.code === "TERMS_REQUIRED") return router.replace(`/accept-terms?next=/live/${liveRoomId}`)
      if (res.status === 403 && data.code === "ENROLLMENT_REQUIRED") {
        setLockedWorkshop(data.workshop)
        setErrorMsg(data.error)
        setPhase("locked")
        return
      }
      if (!res.ok) {
        setPhase(data.code === "ENDED" ? "ended" : "error")
        setErrorMsg(data.error || "Yayına katılınamadı")
        return
      }
      setStream(data.stream)
      return data as { roomUrl: string; token: string }
    } catch {
      setPhase("error")
      setErrorMsg("Ağ hatası, sayfayı yenileyin.")
    }
  }, [liveRoomId, router])

  const [started, setStarted] = useState(false)
  useEffect(() => {
    if (!room || started) return
    setStarted(true)
    join().then(async (d) => {
      if (!d) return
      try {
        await connect(d.roomUrl, d.token)
        setPhase("watching")
      } catch {
        setPhase("error")
        setErrorMsg("Yayına bağlanılamadı. Yayın sona ermiş olabilir.")
      }
    })
  }, [room, started, join, connect])

  useEffect(() => {
    if (live.state === "ended") setPhase("ended")
    if (live.state === "error" && live.error) {
      setErrorMsg(live.error)
      setPhase("error")
    }
  }, [live.state, live.error])

  const uptime = stream ? formatDuration((now - new Date(stream.startedAt).getTime()) / 1000) : "00:00"

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  if (phase === "locked") {
    return (
      <div className="min-h-screen bg-stage text-white flex flex-col items-center justify-center gap-5 px-6 text-center">
        <p className="eyebrow !text-white/50">Atölye yayını</p>
        <h1 className="font-display text-4xl max-w-xl">{lockedWorkshop?.title ?? "Bu yayın atölye katılımcılarına açık"}</h1>
        <p className="text-white/60 max-w-md">{errorMsg}</p>
        <div className="flex gap-3">
          {lockedWorkshop && (
            <Link href={`/atolyeler/${lockedWorkshop.slug}`} className="bg-accent hover:bg-accent-dark px-6 py-2.5 rounded-md text-sm font-semibold">Atölyeye git</Link>
          )}
          <Link href="/live" className="border border-white/30 hover:bg-white/10 px-6 py-2.5 rounded-md text-sm font-semibold">Canlı yayınlar</Link>
        </div>
      </div>
    )
  }

  if (phase === "ended" || phase === "error") {
    return (
      <div className="min-h-screen bg-stage text-white flex flex-col items-center justify-center gap-5 px-6 text-center">
        <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center">
          {phase === "ended" ? <Radio size={28} /> : <X size={28} />}
        </div>
        <h1 className="font-display text-3xl">{phase === "ended" ? "Yayın sona erdi" : "Yayına katılınamadı"}</h1>
        <p className="text-white/60 max-w-md">
          {phase === "ended"
            ? "Eğitmen yayını bitirdi. Başka bir canlı yayına göz atabilir ya da kayıtlı derslerini izleyebilirsin."
            : errorMsg}
        </p>
        <div className="flex gap-3">
          <Link href="/live" className="bg-accent hover:bg-accent-dark px-6 py-2.5 rounded-full text-sm font-semibold">Canlı yayınlar</Link>
          {stream && (
            <Link href={`/teachers/${stream.teacher.id}`} className="border border-white/30 hover:bg-white/10 px-6 py-2.5 rounded-full text-sm font-semibold">
              Eğitmenin profili
            </Link>
          )}
        </div>
      </div>
    )
  }

  const connected = live.state === "live" || live.state === "reconnecting"

  return (
    <div className="min-h-screen bg-stage text-white flex flex-col">
      <StaffNoticeBanner notice={live.staffNotice} onDismiss={live.dismissStaffNotice} />
      <header className="h-12 shrink-0 flex items-center gap-4 px-4 border-b border-white/10 bg-stage-2">
        <Link href="/live" className="flex items-center gap-2 text-white/70 hover:text-white text-sm">
          <ArrowLeft size={16} /> <span className="hidden sm:inline">Canlı yayınlar</span>
        </Link>
        <span className="font-display text-xl tracking-[0.2em]">AYA</span>
      </header>

      <div className={`flex-1 min-h-0 flex ${theater ? "flex-col" : "flex-col lg:flex-row"}`}>
        <main className={`min-w-0 ${theater ? "" : "lg:flex-1 lg:overflow-y-auto"}`}>
          <div className={theater ? "bg-black" : "p-0 lg:p-4"}>
            <div className={theater ? "max-w-[1600px] mx-auto" : ""}>
              <LivePlayer
                room={room}
                host={live.host}
                state={phase === "loading" ? "connecting" : live.state}
                audioBlocked={live.audioBlocked}
                theater={theater}
                onToggleTheater={() => setTheater((t) => !t)}
              />
            </div>
          </div>

          <div className="px-4 py-4 lg:px-4 max-w-5xl">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-3">
              <span data-testid="live-badge" className="inline-flex items-center gap-1.5 bg-accent text-white text-[11px] font-bold tracking-wider uppercase px-2 py-1 rounded">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> Canlı
              </span>
              <span data-testid="viewer-count" className="inline-flex items-center gap-1.5 text-sm text-white/80">
                <Users size={15} /> {live.viewerCount} izleyici
              </span>
              <span className="text-sm text-white/50" data-testid="uptime">{uptime}</span>
              <button onClick={copyLink} className="ml-auto inline-flex items-center gap-1.5 text-sm text-white/70 hover:text-white">
                <Link2 size={15} /> {copied ? "Kopyalandı" : "Bağlantıyı kopyala"}
              </button>
              {stream && (
                <ReportButton
                  targetType="LIVE_ROOM"
                  targetId={stream.id}
                  subject={stream.title}
                  theme="dark"
                  label="Yayını bildir"
                  className="inline-flex items-center gap-1.5 text-sm text-white/60 hover:text-red-300"
                />
              )}
            </div>

            {stream ? (
              <div className="flex items-center gap-3">
                {stream.teacher.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={stream.teacher.image} alt="" className="w-11 h-11 rounded-full object-cover" />
                ) : (
                  <div className="w-11 h-11 rounded-full bg-accent/30 flex items-center justify-center font-display text-lg">{(stream.teacher.name || "E")[0]}</div>
                )}
                <div className="min-w-0">
                  <h1 data-testid="stream-title" className="font-display text-2xl leading-tight truncate">{stream.title}</h1>
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    {stream.teacher.trial ? (
                      <span className="text-sm text-white/60">{stream.teacher.name}</span> // trial-phase teachers have no public profile yet
                    ) : (
                      <Link href={`/teachers/${stream.teacher.id}`} className="text-sm text-white/60 hover:text-white">
                        {stream.teacher.name}
                      </Link>
                    )}
                    <TeacherBadge trial={!!stream.teacher.trial} size="sm" tone="dark" />
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-white/50 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Yükleniyor…</p>
            )}
            {stream?.supervised && (
              <p data-testid="supervised-note" className="text-xs text-saffron-300/90 border border-saffron-300/30 bg-saffron-300/10 rounded-lg px-3 py-2 max-w-xl">
                Bu yayın, deneme sürecindeki bir öğretmene ait ve yetkililer tarafından izlenmektedir. Bir sorun görürsen “Bildir” düğmesini kullanabilirsin.
              </p>
            )}
          </div>
        </main>

        <aside className={`${theater ? "h-80" : "h-[28rem] lg:h-auto lg:w-[22rem] lg:shrink-0"} flex flex-col border-t lg:border-t-0 lg:border-l border-white/10 min-h-0`}>
          <LiveChatPanel
            className="flex-1"
            messages={live.messages}
            settings={live.settings}
            isHost={false}
            connected={connected}
            onSend={live.sendChat}
            selfIdentity={room?.localParticipant?.identity}
            onReport={(m: ChatMessage) => setReportMsg({ text: m.text, senderIdentity: m.identity, senderName: m.name, sentAt: m.ts })}
          />
        </aside>
        {reportMsg && stream && (
          <ReportDialog targetType="CHAT_MESSAGE" targetId={stream.id} subject={`Sohbet · ${stream.title}`} message={reportMsg} theme="dark" onClose={() => setReportMsg(null)} />
        )}
      </div>
    </div>
  )
}
