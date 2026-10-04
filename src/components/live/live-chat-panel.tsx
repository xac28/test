"use client"

import { useEffect, useRef, useState } from "react"
import { ArrowDown, Crown, Flag, Send, ShieldBan } from "lucide-react"
import { ChatMessage, MAX_CHAT_LEN, RoomSettings, nameColor } from "@/lib/live-chat"

const QUICK_EMOJIS = ["🙏", "🧘", "❤️", "👏", "🔥", "😊"]

interface Props {
  messages: ChatMessage[]
  settings: RoomSettings
  isHost: boolean
  connected: boolean
  onSend: (text: string) => Promise<string | null>
  onKick?: (identity: string, name: string) => void
  /** viewer: flag a message for the admins */
  onReport?: (m: ChatMessage) => void
  selfIdentity?: string
  className?: string
}

/** Twitch-style chat column: coloured names, host badge, slow mode, jump-to-latest. */
export function LiveChatPanel({ messages, settings, isHost, connected, onSend, onKick, onReport, selfIdentity, className = "" }: Props) {
  const [text, setText] = useState("")
  const [notice, setNotice] = useState<string | null>(null)
  const [stuck, setStuck] = useState(true) // is the list scrolled to the bottom?
  const [unseen, setUnseen] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  const prevCount = useRef(0)

  const disabled = !connected || (!settings.chatEnabled && !isHost)

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    const added = messages.length - prevCount.current
    prevCount.current = messages.length
    if (stuck) el.scrollTop = el.scrollHeight
    else if (added > 0) setUnseen((n) => n + added)
  }, [messages, stuck])

  const onScroll = () => {
    const el = listRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40
    setStuck(atBottom)
    if (atBottom) setUnseen(0)
  }

  const jump = () => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
    setStuck(true)
    setUnseen(0)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim() || disabled) return
    const err = await onSend(text)
    if (err) {
      setNotice(err)
      setTimeout(() => setNotice(null), 3000)
    } else {
      setText("")
      setNotice(null)
      jump()
    }
  }

  return (
    <div data-testid="live-chat" className={`flex flex-col bg-stage-2 text-white min-h-0 ${className}`}>
      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
        <h2 className="text-xs font-semibold tracking-[0.18em] uppercase text-white/70">Yayın Sohbeti</h2>
        {settings.slowModeSec > 0 && (
          <span className="text-[11px] text-amber-300 bg-amber-300/10 px-2 py-0.5 rounded">Yavaş mod · {settings.slowModeSec} sn</span>
        )}
      </div>

      <div className="relative flex-1 min-h-0">
        <div ref={listRef} onScroll={onScroll} className="absolute inset-0 overflow-y-auto px-4 py-3 space-y-1.5 text-sm" role="log" aria-live="polite">
          {messages.length === 0 && (
            <p className="text-white/40 text-center mt-8 text-sm">Sohbet burada başlar. İlk mesajı sen yaz 🙏</p>
          )}
          {messages.map((m) => (
            <div key={`${m.identity}-${m.id}`} data-testid="chat-message" className="group leading-snug break-words">
              {m.isHost && (
                <span title="Yayıncı" className="inline-flex items-center gap-1 mr-1.5 align-middle text-[10px] font-bold uppercase tracking-wider bg-accent text-white px-1.5 py-0.5 rounded">
                  <Crown size={10} /> Eğitmen
                </span>
              )}
              <span className="font-semibold" style={{ color: m.isHost ? "#FFB89A" : nameColor(m.identity) }}>
                {m.name}
              </span>
              <span className="text-white/50">: </span>
              <span className="text-white/90">{m.text}</span>
              {onReport && !m.isHost && m.identity !== selfIdentity && (
                <button
                  onClick={() => onReport(m)}
                  title="Mesajı bildir"
                  aria-label="Mesajı bildir"
                  data-testid="chat-report"
                  className="ml-2 opacity-0 group-hover:opacity-100 focus:opacity-100 text-white/50 hover:text-red-300 align-middle"
                >
                  <Flag size={12} />
                </button>
              )}
              {isHost && !m.isHost && onKick && (
                <button
                  onClick={() => onKick(m.identity, m.name)}
                  title="Yayından çıkar"
                  className="ml-2 opacity-0 group-hover:opacity-100 focus:opacity-100 text-red-300 hover:text-red-200 align-middle"
                >
                  <ShieldBan size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
        {!stuck && unseen > 0 && (
          <button onClick={jump} className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-black/80 hover:bg-black text-white text-xs px-3 py-1.5 rounded-full border border-white/20">
            <ArrowDown size={12} /> {unseen} yeni mesaj
          </button>
        )}
      </div>

      <form onSubmit={submit} className="p-3 border-t border-white/10 space-y-2">
        {notice && <p role="alert" className="text-xs text-amber-300">{notice}</p>}
        {!settings.chatEnabled && !isHost && <p className="text-xs text-white/50">Sohbet yayıncı tarafından kapatıldı.</p>}
        <div className="flex gap-1.5">
          {QUICK_EMOJIS.map((e) => (
            <button key={e} type="button" disabled={disabled} onClick={() => setText((t) => (t + e).slice(0, MAX_CHAT_LEN))} className="text-base hover:scale-125 transition disabled:opacity-40">
              {e}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            data-testid="chat-input"
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, MAX_CHAT_LEN))}
            disabled={disabled}
            placeholder={disabled ? "Sohbet kapalı" : "Mesaj gönder"}
            maxLength={MAX_CHAT_LEN}
            className="flex-1 min-w-0 bg-white/10 border border-white/10 focus:border-white/40 focus:outline-none rounded-lg px-3 py-2 text-sm placeholder:text-white/40 disabled:opacity-50"
          />
          <button
            data-testid="chat-send"
            type="submit"
            disabled={disabled || !text.trim()}
            aria-label="Gönder"
            className="bg-accent hover:bg-accent-dark disabled:opacity-40 rounded-lg px-3 flex items-center"
          >
            <Send size={16} />
          </button>
        </div>
        {text.length > MAX_CHAT_LEN - 60 && <p className="text-[11px] text-white/40 text-right">{text.length}/{MAX_CHAT_LEN}</p>}
      </form>
    </div>
  )
}
