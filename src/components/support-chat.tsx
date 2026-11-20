"use client"

import Link from "next/link"
import { useCallback, useEffect, useRef, useState } from "react"
import { CheckCircle2, Loader2, LogIn, Send, Star, X } from "lucide-react"
import { timeAgo } from "@/components/notification-bell"

interface Msg { id: string; role: "USER" | "STAFF" | "SYSTEM" | string; content: string; createdAt: string }
interface TicketState { id: string; status: string; awaitingStaff: boolean; rating: number | null }

const POLL_MS = 4000

/**
 * Live support conversation (used inside the guide widget and on /dashboard/support).
 * Without an open conversation it asks what the problem is; otherwise it shows the thread and polls for replies.
 */
export function SupportChat({ source = "USER", context = "", initialMessage = "", onClose, className = "" }: { source?: "USER" | "AI_UNHELPFUL" | "AI_REQUEST"; context?: string; initialMessage?: string; onClose?: () => void; className?: string }) {
  const [state, setState] = useState<"loading" | "login" | "ready" | "error">("loading")
  const [ticket, setTicket] = useState<TicketState | null>(null)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [text, setText] = useState(initialMessage)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stars, setStars] = useState(0)
  const [rated, setRated] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const last = useRef<string | null>(null)

  const merge = useCallback((incoming: Msg[]) => {
    if (!incoming.length) return
    setMsgs((cur) => {
      const seen = new Set(cur.map((m) => m.id))
      const add = incoming.filter((m) => !seen.has(m.id))
      return add.length ? [...cur, ...add] : cur
    })
    last.current = incoming[incoming.length - 1].createdAt
  }, [])

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/support", { cache: "no-store" })
      if (res.status === 401) return setState("login")
      if (!res.ok) return setState("error")
      const d = await res.json()
      if (d.open) {
        setTicket({ id: d.open.id, status: "OPEN", awaitingStaff: d.open.awaitingStaff, rating: null })
        setMsgs(d.messages)
        last.current = d.messages.length ? d.messages[d.messages.length - 1].createdAt : null
      }
      setState("ready")
    } catch {
      setState("error")
    }
  }, [])
  useEffect(() => { load() }, [load])

  // poll for replies while a conversation exists
  useEffect(() => {
    if (!ticket) return
    let alive = true
    const tick = async () => {
      try {
        const res = await fetch(`/api/support/${ticket.id}${last.current ? `?after=${encodeURIComponent(last.current)}` : ""}`, { cache: "no-store" })
        if (!res.ok || !alive) return
        const d = await res.json()
        merge(d.messages)
        setTicket((t) => (t ? { ...t, status: d.ticket.status, awaitingStaff: d.ticket.awaitingStaff, rating: d.ticket.rating } : t))
      } catch {}
    }
    const id = setInterval(tick, POLL_MS)
    return () => { alive = false; clearInterval(id) }
  }, [ticket?.id, merge]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }) }, [msgs.length])

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault()
    const content = text.trim()
    if (!content || busy) return
    setBusy(true)
    setError(null)
    try {
      const res = ticket
        ? await fetch(`/api/support/${ticket.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content }) })
        : await fetch("/api/support", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: content, source, context }) })
      const d = await res.json().catch(() => ({}))
      if (res.status === 401) return setState("login")
      if (!res.ok) return setError(d.error || "Gönderilemedi.")
      setText("")
      if (!ticket) await load()
      else {
        merge([d.message])
        setTicket((t) => (t ? { ...t, awaitingStaff: true } : t))
      }
    } catch {
      setError("Bağlantı hatası, tekrar dene.")
    } finally {
      setBusy(false)
    }
  }

  const close = async () => {
    if (!ticket) return
    await fetch(`/api/support/${ticket.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "close" }) }).catch(() => {})
    setTicket((t) => (t ? { ...t, status: "CLOSED" } : t))
  }
  const rate = async (n: number) => {
    if (!ticket) return
    setStars(n)
    const res = await fetch(`/api/support/${ticket.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "rate", rating: n }) }).catch(() => null)
    if (res?.ok) setRated(true)
  }
  const startNew = () => { setTicket(null); setMsgs([]); setRated(false); setStars(0); last.current = null; setText("") }

  if (state === "loading") return <div className={`flex items-center justify-center p-10 text-sage-500 ${className}`}><Loader2 className="animate-spin" size={18} /></div>
  if (state === "error") return <p role="alert" className={`p-6 text-sm text-clay-600 ${className}`}>Canlı destek yüklenemedi. <button className="underline" onClick={() => { setState("loading"); load() }}>Tekrar dene</button></p>
  if (state === "login") {
    return (
      <div className={`p-6 text-center space-y-3 ${className}`} data-testid="support-login">
        <LogIn className="mx-auto text-sage-500" />
        <p className="text-sm text-sage-700">Canlı destek için giriş yapman gerekiyor; böylece yanıtı hesabına iletebiliriz.</p>
        <div className="flex justify-center gap-2">
          <Link href={`/login?callbackUrl=${encodeURIComponent(typeof window !== "undefined" ? window.location.pathname : "/")}`} className="px-4 py-2 bg-ink text-cream rounded-md text-sm font-medium">Giriş yap</Link>
          <Link href="/login?mode=register" className="px-4 py-2 border border-rule rounded-md text-sm font-medium">Üye ol</Link>
        </div>
      </div>
    )
  }

  const closed = ticket?.status === "CLOSED"
  return (
    <div className={`flex flex-col min-h-0 ${className}`} data-testid="support-chat">
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0" role="log" aria-live="polite" data-testid="support-messages">
        {!ticket && (
          <div className="text-sm text-sage-700 bg-sage-100/70 rounded-xl px-3.5 py-3">
            <p className="font-semibold text-ink mb-1">Canlı destek</p>
            Sorununu yaz; ekibimiz mesajını görür ve buradan yanıtlar. Yanıt geldiğinde zil simgesinde de haber alırsın.
          </div>
        )}
        {msgs.map((m) =>
          m.role === "SYSTEM" ? (
            <p key={m.id} data-testid="support-system" className="text-center text-[11px] text-sage-500 px-4">{m.content}</p>
          ) : (
            <div key={m.id} data-testid={m.role === "STAFF" ? "support-staff-msg" : "support-user-msg"} className={`flex ${m.role === "USER" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[88%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-line break-words ${m.role === "USER" ? "bg-ink text-cream rounded-br-sm" : "bg-sage-100/80 text-sage-900 rounded-bl-sm"}`}>
                {m.role === "STAFF" && <span className="block text-[10px] font-bold uppercase tracking-wider text-sage-600 mb-0.5">Destek ekibi</span>}
                {m.content}
                <span className={`block text-[10px] mt-1 ${m.role === "USER" ? "text-cream/60" : "text-sage-500"}`}>{timeAgo(m.createdAt)}</span>
              </div>
            </div>
          ),
        )}
        {ticket && !closed && ticket.awaitingStaff && <p data-testid="support-waiting" className="text-center text-xs text-sage-500">Mesajın iletildi — ekibimiz yanıtlayınca burada göreceksin. Sayfayı kapatsan da zil simgesinden haber alırsın.</p>}
        {closed && (
          <div className="rounded-xl border border-rule bg-paper p-4 text-center space-y-2" data-testid="support-closed">
            <CheckCircle2 className="mx-auto text-emerald-600" size={20} />
            <p className="text-sm font-semibold">Görüşme kapandı</p>
            {rated || ticket?.rating ? (
              <p className="text-xs text-sage-600" data-testid="support-thanks">Puanın için teşekkürler! 🙏</p>
            ) : (
              <>
                <p className="text-xs text-sage-600">Destek nasıldı?</p>
                <div className="flex justify-center gap-1" role="radiogroup" aria-label="Puan ver">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} role="radio" aria-checked={stars === n} aria-label={`${n} yıldız`} onClick={() => rate(n)} data-testid={`support-star-${n}`} className="w-9 h-9 flex items-center justify-center">
                      <Star size={22} className={n <= stars ? "fill-yellow-500 text-yellow-500" : "text-sage-300 hover:text-yellow-500"} />
                    </button>
                  ))}
                </div>
              </>
            )}
            <button onClick={startNew} className="text-xs underline text-sage-600 hover:text-ink" data-testid="support-new">Yeni bir talep başlat</button>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {!closed && (
        <form onSubmit={send} className="border-t border-rule px-3 py-3 flex-shrink-0 space-y-2">
          {error && <p role="alert" data-testid="support-error" className="text-xs text-clay-600 bg-clay-50 border border-clay-200 rounded px-2.5 py-1.5">{error}</p>}
          <div className="flex items-end gap-2 bg-white rounded-lg pl-3.5 pr-1.5 py-1.5 border border-rule focus-within:border-ink transition">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, 1000))}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send() } }}
              rows={ticket ? 1 : 3}
              placeholder={ticket ? "Mesajını yaz…" : "Nasıl yardımcı olabiliriz?"}
              aria-label="Destek mesajı"
              data-testid="support-input"
              className="flex-1 bg-transparent outline-none text-sm text-ink placeholder:text-sage-500 resize-none py-1.5"
            />
            <button type="submit" disabled={!text.trim() || busy} aria-label="Gönder" data-testid="support-send" className="w-9 h-9 rounded-md flex items-center justify-center bg-ink text-cream disabled:opacity-30 hover:bg-sage-800 transition shrink-0">
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            </button>
          </div>
          {ticket && (
            <div className="flex justify-between items-center text-[11px] text-sage-500">
              <span>Enter gönderir · Shift+Enter yeni satır</span>
              <button type="button" onClick={close} data-testid="support-close" className="inline-flex items-center gap-1 underline hover:text-ink"><X size={11} /> Görüşmeyi kapat</button>
            </div>
          )}
        </form>
      )}
    </div>
  )
}
