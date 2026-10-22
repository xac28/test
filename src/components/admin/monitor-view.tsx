"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, BadgeCheck, EyeOff, Loader2, Megaphone, Send, ShieldAlert, Users, XCircle } from "lucide-react"
import { formatDuration, SLOW_MODE_OPTIONS } from "@/lib/live-chat"
import { useLiveRoom } from "@/components/live/use-live-room"
import { LivePlayer } from "@/components/live/live-player"
import { LiveChatPanel } from "@/components/live/live-chat-panel"
import { TeacherBadge } from "@/components/teacher-badge"
import { Button, Card, api, useConfirm, useToast } from "./ui"

interface Stream {
  id: string
  title: string
  startedAt: string
  supervised: boolean
  hostIdentity: string
  teacher: { id: string; profileId: string; name: string | null; trial: boolean }
}

/** Unseen live view of a broadcast for officials, with the means to step in. */
export function MonitorView({ liveRoomId }: { liveRoomId: string }) {
  const [stream, setStream] = useState<Stream | null>(null)
  const [phase, setPhase] = useState<"loading" | "watching" | "ended" | "error">("loading")
  const [errorMsg, setErrorMsg] = useState("")
  const [now, setNow] = useState(() => Date.now())
  const [theater, setTheater] = useState(false)
  const [message, setMessage] = useState("")
  const [audience, setAudience] = useState<"teacher" | "all">("teacher")
  const [sending, setSending] = useState(false)
  const { ask, dialog } = useConfirm()
  const { show, toast } = useToast()

  const live = useLiveRoom({ hostIdentity: stream?.hostIdentity, isHost: false })
  const { room, connect } = live

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const [started, setStarted] = useState(false)
  useEffect(() => {
    if (!room || started) return
    setStarted(true)
    ;(async () => {
      try {
        const d = await api<{ roomUrl: string; token: string; stream: Stream }>(`/api/admin/live-monitor/${liveRoomId}/watch`, { method: "POST" })
        setStream(d.stream)
        await connect(d.roomUrl, d.token)
        setPhase("watching")
      } catch (e: any) {
        setPhase(e?.status === 404 ? "ended" : "error")
        setErrorMsg(e?.message || "Yayına bağlanılamadı")
      }
    })()
  }, [room, started, liveRoomId, connect])

  useEffect(() => {
    if (live.state === "ended") setPhase("ended")
  }, [live.state])

  const sendNotice = useCallback(async () => {
    if (message.trim().length < 3) return
    setSending(true)
    try {
      await api(`/api/admin/live-monitor/${liveRoomId}/notice`, { method: "POST", json: { message, audience } })
      show(audience === "all" ? "Duyuru odaya gönderildi" : "Mesaj öğretmene gönderildi")
      setMessage("")
    } catch (e: any) {
      show(e?.message || "Gönderilemedi")
    } finally {
      setSending(false)
    }
  }, [message, audience, liveRoomId, show])

  const moderate = (body: object) => api(`/api/live/${liveRoomId}/moderate`, { method: "POST", json: body })

  if (phase === "ended" || phase === "error") {
    return (
      <div className="max-w-xl mx-auto py-16 text-center space-y-4" data-testid="monitor-ended">
        <h1 className="font-display text-3xl">{phase === "ended" ? "Yayın sona erdi" : "Yayına bağlanılamadı"}</h1>
        {errorMsg && phase === "error" && <p className="text-sage-600">{errorMsg}</p>}
        <Link href="/admin?tab=monitor" className="btn-deep">Canlı izlemeye dön</Link>
      </div>
    )
  }

  const uptime = stream ? formatDuration((now - new Date(stream.startedAt).getTime()) / 1000) : "00:00"
  return (
    <div className="space-y-4" data-testid="monitor-view">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/admin?tab=monitor" className="inline-flex items-center gap-1.5 text-sm text-sage-600 hover:text-ink min-h-[44px]"><ArrowLeft size={16} /> Canlı izleme</Link>
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-sage-600 bg-sage-100 rounded-full px-2.5 py-1" title="İzleyici listesinde ve sayısında görünmezsiniz"><EyeOff size={13} /> Gizli izliyorsunuz</span>
        {stream?.supervised && <span className="text-xs font-bold bg-saffron-300 text-ink rounded px-2 py-1">Denetimli yayın</span>}
      </div>

      <div className="grid xl:grid-cols-[1fr_22rem] gap-4">
        <div className="space-y-4 min-w-0">
          <div className="rounded-xl overflow-hidden bg-black" data-testid="monitor-player">
            <LivePlayer room={room} host={live.host} state={phase === "loading" ? "connecting" : live.state} audioBlocked={live.audioBlocked} theater={theater} onToggleTheater={() => setTheater((t) => !t)} waitingLabel="Öğretmen henüz görüntü yayınlamıyor" />
          </div>
          <Card className="p-4">
            {stream ? (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <div className="min-w-0">
                  <h1 className="font-display text-2xl truncate" data-testid="monitor-title">{stream.title}</h1>
                  <p className="text-sm text-sage-600 flex flex-wrap items-center gap-2">{stream.teacher.name} <TeacherBadge trial={stream.teacher.trial} size="sm" /></p>
                </div>
                <span className="ml-auto inline-flex items-center gap-1.5 text-sm text-sage-700" data-testid="monitor-viewers"><Users size={15} /> {live.viewers.filter((v) => !v.isHost).length} izleyici</span>
                <span className="text-sm tabular-nums text-sage-500">{uptime}</span>
              </div>
            ) : <p className="text-sage-500 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Bağlanılıyor…</p>}
          </Card>
        </div>

        <aside className="space-y-4 min-w-0">
          <Card className="p-4 space-y-3" data-testid="monitor-notice">
            <h2 className="font-display text-xl flex items-center gap-2"><Megaphone size={18} /> Mesaj gönder</h2>
            <textarea value={message} onChange={(e) => setMessage(e.target.value.slice(0, 240))} rows={3} placeholder="Örn. Lütfen kamerayı biraz yukarı al." aria-label="Yetkili mesajı" data-testid="notice-text" className="w-full px-3 py-2 bg-white border border-rule rounded-xl text-sm focus:outline-none focus:border-ink" />
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <label className="inline-flex items-center gap-1.5 min-h-[36px]"><input type="radio" name="aud" checked={audience === "teacher"} onChange={() => setAudience("teacher")} /> Yalnız öğretmene</label>
              <label className="inline-flex items-center gap-1.5 min-h-[36px]"><input type="radio" name="aud" checked={audience === "all"} onChange={() => setAudience("all")} data-testid="aud-all" /> Tüm odaya</label>
              <Button tone="primary" onClick={sendNotice} disabled={sending || message.trim().length < 3} data-testid="notice-send" className="ml-auto"><Send size={14} /> Gönder</Button>
            </div>
          </Card>

          <Card className="p-4 space-y-3">
            <h2 className="font-display text-xl">Sohbet</h2>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-sage-600">Yavaş mod</span>
              {SLOW_MODE_OPTIONS.map((s) => (
                <button key={s} type="button" data-testid={`slow-${s}`} onClick={() => moderate({ action: "chat-settings", slowModeSec: s }).then(() => show(s ? `Yavaş mod ${s} sn` : "Yavaş mod kapalı"))} className={`px-3 min-h-[36px] rounded-full border text-xs font-semibold ${live.settings.slowModeSec === s ? "bg-ink text-cream border-ink" : "bg-paper border-rule"}`}>{s ? `${s} sn` : "Kapalı"}</button>
              ))}
            </div>
            <Button onClick={() => moderate({ action: "chat-settings", chatEnabled: !live.settings.chatEnabled }).then(() => show(live.settings.chatEnabled ? "Sohbet kapatıldı" : "Sohbet açıldı"))} data-testid="chat-toggle">{live.settings.chatEnabled ? "Sohbeti kapat" : "Sohbeti aç"}</Button>
            <div className="h-72 -mx-4 -mb-4 rounded-b-2xl overflow-hidden bg-stage text-white">
              <LiveChatPanel className="h-full" messages={live.messages} settings={live.settings} isHost={false} connected={phase === "watching"} onSend={async () => "Sohbete yazamazsınız; yukarıdaki “Mesaj gönder” kutusunu kullanın."} />
            </div>
          </Card>

          {stream?.teacher.trial && (
            <Card className="p-4 space-y-3 border-saffron-300" data-testid="monitor-trial">
              <h2 className="font-display text-xl flex items-center gap-2"><BadgeCheck size={18} /> Deneme kararı</h2>
              <p className="text-sm text-sage-600">İzlediğiniz yayına göre öğretmeni onaylayabilir ya da deneme sürecinde tutabilirsiniz.</p>
              <div className="flex flex-wrap gap-2">
                <Button tone="primary" data-testid="trial-approve" onClick={() => ask({ title: "Öğretmeni onayla", description: `${stream.teacher.name} “Onaylı öğretmen” olur; atölye ve rezervasyon açabilir.`, confirmLabel: "Onayla", tone: "primary", input: { label: "Not (isteğe bağlı)", min: 0 }, onConfirm: async (note) => { await api(`/api/admin/teachers/${stream.teacher.profileId}/trial`, { method: "POST", json: { action: "approve", note } }); setStream((s) => (s ? { ...s, teacher: { ...s.teacher, trial: false } } : s)); show("Öğretmen onaylandı") } })}>Onayla</Button>
                <Button data-testid="trial-reject" onClick={() => ask({ title: "Denemede tut", description: "Öğretmen deneme sürecinde kalır; sonraki yayınları da izlenir.", confirmLabel: "Denemede tut", tone: "danger", input: { label: "Gerekçe (öğretmene gösterilir)", min: 3 }, onConfirm: async (note) => { await api(`/api/admin/teachers/${stream.teacher.profileId}/trial`, { method: "POST", json: { action: "reject", note } }); show("Karar kaydedildi") } })}>Denemede tut</Button>
              </div>
            </Card>
          )}

          <Card className="p-4 space-y-2">
            <h2 className="font-display text-xl flex items-center gap-2"><ShieldAlert size={18} /> Müdahale</h2>
            <Button tone="danger" data-testid="monitor-end" onClick={() => ask({ title: "Yayını kapat", description: "Yayın hemen sonlandırılır ve tüm izleyicilerin bağlantısı kesilir.", confirmLabel: "Yayını kapat", tone: "danger", input: { label: "Neden (denetim kaydına yazılır)", min: 3 }, onConfirm: async (reason) => { await api(`/api/admin/live-rooms/${liveRoomId}/close`, { method: "POST", json: { reason } }); show("Yayın kapatıldı"); setPhase("ended") } })}><XCircle size={15} /> Yayını kapat</Button>
            <Link href="/admin?tab=reports" className="block text-sm text-sage-600 underline underline-offset-4 min-h-[44px] leading-[44px]">Raporlara git</Link>
          </Card>
        </aside>
      </div>
      {dialog}
      {toast}
    </div>
  )
}
