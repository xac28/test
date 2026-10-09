"use client"

import { Fragment, ReactNode, useCallback, useEffect, useRef, useState } from "react"
import { BookOpen, CalendarDays, ChevronRight, Headphones, LifeBuoy, MessageCircle, Package, PersonStanding, Radio, Send, ShoppingBag, Sparkles, Square, ThumbsDown, ThumbsUp, User, X } from "lucide-react"
import { SupportChat } from "@/components/support-chat"
import Link from "next/link"
import { usePathname } from "next/navigation"

interface GuideLink {
  label: string
  href: string
}
/** A result of an AI tool, shown as a card under the answer (see src/lib/ai/tools.ts). */
interface AiCard {
  kind: "teacher" | "workshop" | "product" | "article" | "podcast" | "pose" | "live" | "order"
  title: string
  subtitle?: string
  meta?: string
  href: string
  image?: string | null
}
interface Message {
  role: "user" | "ai"
  text: string
  teachers?: any[]
  links?: GuideLink[]
  suggestions?: string[]
  cards?: AiCard[]
  /** the answer is still being written */
  streaming?: boolean
  /** what the guide is doing right now ("Eğitmenler aranıyor…") */
  status?: string
  /** the answer can be rated; `feedback` holds the visitor's rating once given */
  interactionId?: string | null
  askFeedback?: boolean
  feedback?: "up" | "down"
  /** the guide did not know this one and recorded it */
  learning?: boolean
  /** the question this answer belongs to (handed to the support team on request) */
  question?: string
}

const QUICK_PROMPTS = [
  { text: "Bel ağrım için ne yapabilirim?" },
  { text: "10 dakikalık sabah rutini hazırla" },
  { text: "Uyumakta zorlanıyorum" },
  { text: "Canlı yayın var mı?" },
  { text: "Hafta sonu atölye var mı?" },
  { text: "Yeni başlıyorum, hangi stil?" },
]

const WELCOME: Message = {
  role: "ai",
  text: "**Merhaba!** Ben AYA Rehber. Derdini ya da hedefini yaz; sana uygun stili, eğitmeni, atölyeyi ve pozları bulur, istersen kısa bir pratik rutini hazırlarım. Üyelik, ders, sipariş ve ödeme konularında da yardımcı olurum.\n\nBir şey yaz ya da aşağıdan seç.",
}

const STORE_KEY = "aya-ai-chat"
const CARD_ICON = { teacher: User, workshop: CalendarDays, product: ShoppingBag, article: BookOpen, podcast: Headphones, pose: PersonStanding, live: Radio, order: Package } as const

// Full-screen live pages (broadcast viewer/studio, lesson room) own the bottom-right corner (chat send button)
const isFullScreenLivePage = (path: string | null) =>
  !!path && (path.startsWith("/live/") || path === "/room" || path.startsWith("/room/"))

/** **bold**, _italic_ and [label](/internal/path): anything else stays plain text (React escapes it, links to other sites are never made). */
function inline(text: string, onNavigate: () => void): ReactNode[] {
  return text.split(/(\*\*[^*\n]+\*\*|\[[^\]\n]+\]\(\/(?!\/)[^)\s]*\)|(?<![\w])_[^_\n]+_(?![\w]))/g).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) return <strong key={i} className="font-semibold text-ink">{part.slice(2, -2)}</strong>
    const link = /^\[([^\]]+)\]\((\/[^)\s]*)\)$/.exec(part)
    if (link) return <Link key={i} href={link[2]} onClick={onNavigate} className="underline underline-offset-2 text-teal-700 font-medium hover:text-ink">{link[1]}</Link>
    if (part.length > 2 && part.startsWith("_") && part.endsWith("_")) return <em key={i}>{part.slice(1, -1)}</em>
    return <Fragment key={i}>{part}</Fragment>
  })
}

function RichText({ text, onNavigate }: { text: string; onNavigate: () => void }) {
  const lines = text.split("\n")
  const blocks: ReactNode[] = []
  for (let i = 0; i < lines.length; ) {
    if (/^\s*[-*•]\s+/.test(lines[i])) {
      const items: string[] = []
      while (i < lines.length && /^\s*[-*•]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*[-*•]\s+/, ""))
      blocks.push(<ul key={blocks.length} className="list-disc pl-5 my-1.5 space-y-0.5">{items.map((it, k) => <li key={k}>{inline(it, onNavigate)}</li>)}</ul>)
    } else if (!lines[i].trim()) {
      i++
    } else {
      const para: string[] = []
      while (i < lines.length && lines[i].trim() && !/^\s*[-*•]\s+/.test(lines[i])) para.push(lines[i++])
      blocks.push(<p key={blocks.length} className="my-1.5 first:mt-0 last:mb-0">{para.map((l, k) => <Fragment key={k}>{k > 0 && <br />}{inline(l, onNavigate)}</Fragment>)}</p>)
    }
  }
  return <>{blocks}</>
}

export function AiAssistant() {
  const pathname = usePathname()

  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([WELCOME])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [hint, setHint] = useState(false)
  const [showQuickPrompts, setShowQuickPrompts] = useState(true)
  const [mode, setMode] = useState<"guide" | "support">("guide")
  const [supportCtx, setSupportCtx] = useState<{ source: "USER" | "AI_UNHELPFUL" | "AI_REQUEST"; context: string }>({ source: "USER", context: "" })
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const [hydrated, setHydrated] = useState(false)

  // the conversation survives page changes and reloads of the tab
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORE_KEY) || "null")
      if (Array.isArray(saved) && saved.length) {
        setMessages(saved.map((m: Message) => ({ ...m, streaming: false, status: undefined })))
        setShowQuickPrompts(false)
      }
    } catch { /* private mode or damaged data: start fresh */ }
    // saving starts only once the saved conversation is back in state (otherwise the first render would overwrite it)
    setHydrated(true)
  }, [])
  useEffect(() => {
    if (!hydrated) return
    try { sessionStorage.setItem(STORE_KEY, JSON.stringify(messages.filter((m) => !m.streaming).slice(-30))) } catch { /* storage full or blocked */ }
  }, [messages, hydrated])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages])

  // a short, one-time hint per browser session
  useEffect(() => {
    try {
      if (sessionStorage.getItem("aya-ai-hint")) return
      sessionStorage.setItem("aya-ai-hint", "1")
    } catch {
      return
    }
    const show = setTimeout(() => setHint(true), 2500)
    const hide = setTimeout(() => setHint(false), 10_000)
    return () => { clearTimeout(show); clearTimeout(hide) }
  }, [])

  const patchLast = (fn: (m: Message) => Message) => setMessages((prev) => (prev.length ? [...prev.slice(0, -1), fn(prev[prev.length - 1])] : prev))

  /** The guide: the answer arrives as a stream of events (status, cards, text, links, chips, done). */
  const ask = async (userMsg: string, history: Message[]) => {
    const ctrl = new AbortController()
    abortRef.current = ctrl
    const payload = [...history.filter((m) => m.text && m !== WELCOME), { role: "user", text: userMsg } as Message]
      .slice(-16).map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.text }))
    const say = (text: string) => setMessages((prev) => [...prev, { role: "ai", text, question: userMsg }])
    let wrote = false
    try {
      const res = await fetch("/api/ai/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: payload, page: pathname || undefined }), signal: ctrl.signal })
      if (!(res.headers.get("content-type") || "").includes("text/event-stream") || !res.body) {
        const data = await res.json().catch(() => ({}))
        setLoading(false)
        say(res.status === 429 ? (data.error || "Çok hızlı yazıyorsun 🙂 Birkaç saniye bekleyip tekrar dene.") : "Şu an yardımcı olamıyorum, lütfen biraz sonra tekrar dene.")
        return
      }
      setMessages((prev) => [...prev, { role: "ai", text: "", streaming: true, question: userMsg }])
      setLoading(false)
      const reader = res.body.getReader()
      const dec = new TextDecoder()
      let buf = ""
      let supportAfter = false
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        const parts = buf.split("\n\n")
        buf = parts.pop() ?? ""
        for (const p of parts) {
          if (!p.startsWith("data: ")) continue
          let ev: any
          try { ev = JSON.parse(p.slice(6)) } catch { continue }
          if (ev.type === "text") { wrote = true; patchLast((m) => ({ ...m, text: m.text + ev.text, status: undefined })) }
          else if (ev.type === "status") patchLast((m) => ({ ...m, status: ev.label }))
          else if (ev.type === "cards") patchLast((m) => ({ ...m, cards: [...(m.cards ?? []), ...ev.cards], status: undefined }))
          else if (ev.type === "links") patchLast((m) => ({ ...m, links: ev.links }))
          else if (ev.type === "suggestions") patchLast((m) => ({ ...m, suggestions: ev.suggestions }))
          else if (ev.type === "learning") patchLast((m) => ({ ...m, learning: true }))
          else if (ev.type === "action" && ev.action === "support") supportAfter = true
          else if (ev.type === "done") patchLast((m) => ({ ...m, streaming: false, status: undefined, interactionId: ev.interactionId, askFeedback: !!ev.askFeedback }))
          else if (ev.type === "error") patchLast((m) => ({ ...m, streaming: false, status: undefined, text: m.text ? `${m.text}\n\n_${ev.message}_` : ev.message }))
        }
      }
      patchLast((m) => ({ ...m, streaming: false, status: undefined }))
      if (supportAfter) openSupport("AI_REQUEST", lastQuestion())
    } catch (e: any) {
      if (e?.name === "AbortError") { patchLast((m) => ({ ...m, streaming: false, status: undefined })); return }
      setLoading(false)
      if (wrote) patchLast((m) => ({ ...m, streaming: false, status: undefined, text: `${m.text}\n\n_Bağlantı koptu. Soruyu tekrar gönder._` }))
      else { setMessages((prev) => (prev.at(-1)?.streaming ? prev.slice(0, -1) : prev)); say("Bağlantı hatası oluştu. Lütfen tekrar dene.") }
    } finally {
      abortRef.current = null
    }
  }

  const handleSend = async (text?: string) => {
    const userMsg = (text || input).trim().slice(0, 800)
    if (!userMsg || loading || abortRef.current) return

    setInput("")
    setShowQuickPrompts(false)
    const history = messages
    setMessages((prev) => [...prev, { role: "user", text: userMsg }])
    setLoading(true)
    await ask(userMsg, history)
  }

  const stop = () => abortRef.current?.abort()

  const lastQuestion = () => [...messages].reverse().find((m) => m.role === "user" && !/canli|canlı|destek|yetkili|temsilci/i.test(m.text))?.text ?? ""

  const openSupport = (source: "USER" | "AI_UNHELPFUL" | "AI_REQUEST", context = "") => {
    setSupportCtx({ source, context })
    setMode("support")
  }

  const rate = async (index: number, up: boolean) => {
    const m = messages[index]
    if (!m?.interactionId || m.feedback) return
    setMessages((prev) => prev.map((x, i) => (i === index ? { ...x, feedback: up ? "up" : "down" } : x)))
    fetch("/api/ai/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: m.interactionId, helpful: up }) }).catch(() => {})
  }

  const reset = () => {
    abortRef.current?.abort()
    setMessages([WELCOME])
    setShowQuickPrompts(true)
    setLoading(false)
    try { sessionStorage.removeItem(STORE_KEY) } catch { /* nothing to remove */ }
  }

  // the student-facing helper has no place in the admin workspace or in the dashboards' working screens
  if (isFullScreenLivePage(pathname) || pathname?.startsWith("/admin")) return null

  const close = () => setIsOpen(false)
  const busy = loading || messages.at(-1)?.streaming === true

  return (
    <>
      {/* Floating button — quiet by default, the hint disappears after a few seconds and never returns in this session */}
      <button
        onClick={() => { setIsOpen(!isOpen); setHint(false); setTimeout(() => inputRef.current?.focus(), 200) }}
        className={`fixed bottom-5 right-5 z-[90] h-12 rounded-full shadow-lg flex items-center justify-center gap-2 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ink ${
          isOpen ? "w-12 bg-paper text-ink border border-rule" : "pl-4 pr-5 bg-ink text-cream hover:bg-sage-800"
        }`}
        aria-label={isOpen ? "Rehberi kapat" : "Yoga rehberini aç"}
        aria-expanded={isOpen}
        data-testid="ai-toggle"
      >
        {isOpen ? <X size={20} /> : (<><MessageCircle size={18} /><span className="text-sm font-semibold hidden sm:inline">Rehber</span></>)}
      </button>

      {!isOpen && hint && (
        <div role="status" className="fixed bottom-[76px] right-5 z-[89] bg-paper border border-rule rounded-lg px-3.5 py-2 shadow-md text-xs text-sage-700 max-w-[220px] animate-slide-up">
          Hangi eğitmen sana uygun? Rehbere sor.
          <button onClick={() => setHint(false)} aria-label="Kapat" className="tap-area tap-area-lg absolute -top-2 -right-2 w-5 h-5 rounded-full bg-ink text-cream flex items-center justify-center"><X size={11} /></button>
        </div>
      )}

      {isOpen && (
        <div role="dialog" aria-label="AYA yoga rehberi" className="fixed bottom-20 right-5 z-[90] w-[400px] max-w-[calc(100vw-40px)] max-h-[min(640px,calc(100vh-120px))] bg-paper rounded-2xl shadow-2xl border border-rule flex flex-col overflow-hidden animate-scale-in">
          <div className="px-5 pt-4 pb-3 flex-shrink-0 bg-ink text-cream">
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <h3 className="font-display text-xl leading-none flex items-center gap-2">
                  {mode === "guide" ? "AYA Rehber" : "Canlı destek"}
                  {mode === "guide" && <span data-testid="ai-badge" className="text-[10px] font-body font-bold tracking-wider uppercase bg-white/15 rounded-full px-2 py-0.5">Akıllı asistan</span>}
                </h3>
                <p className="text-cream/60 text-xs mt-1">{mode === "guide" ? "Sorularını yanıtlar, doğru sayfaya götürür" : "Ekibimizle yaz, buradan yanıtlasınlar"}</p>
              </div>
              {mode === "guide" && messages.length > 1 && <button onClick={reset} data-testid="ai-reset" className="text-xs text-cream/70 hover:text-cream underline underline-offset-2">Yeni sohbet</button>}
              <button onClick={close} aria-label="Kapat" className="p-1.5 rounded-md hover:bg-white/10"><X size={16} /></button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-1 p-1 bg-white/10 rounded-lg text-xs font-semibold" role="tablist">
              <button role="tab" aria-selected={mode === "guide"} onClick={() => setMode("guide")} data-testid="mode-guide" className={`py-1.5 rounded-md inline-flex items-center justify-center gap-1.5 transition ${mode === "guide" ? "bg-cream text-ink" : "text-cream/80 hover:text-cream"}`}><Sparkles size={13} /> Rehber</button>
              <button role="tab" aria-selected={mode === "support"} onClick={() => openSupport("USER", "")} data-testid="mode-support" className={`py-1.5 rounded-md inline-flex items-center justify-center gap-1.5 transition ${mode === "support" ? "bg-cream text-ink" : "text-cream/80 hover:text-cream"}`}><LifeBuoy size={13} /> Canlı destek</button>
            </div>
          </div>

          {mode === "support" ? (
            <SupportChat key={supportCtx.source + supportCtx.context} className="flex-1 min-h-0" source={supportCtx.source} context={supportCtx.context} />
          ) : (<>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0" role="log" aria-live="polite">
            {messages.map((msg, i) => (
              <div key={i} data-testid={msg.role === "ai" ? "ai-message" : "ai-user-message"} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[90%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${msg.role === "user" ? "bg-ink text-cream rounded-br-sm" : "bg-sage-100/70 text-sage-800 rounded-bl-sm"}`}>
                  {msg.role === "user" ? msg.text : <RichText text={msg.text} onNavigate={close} />}
                  {msg.streaming && !msg.text && !msg.status && <TypingDots />}
                  {msg.status && (
                    <p data-testid="ai-status" className="mt-1 text-xs text-sage-500 flex items-center gap-2"><Sparkles size={12} className="animate-pulse" /> {msg.status}</p>
                  )}
                  {msg.cards && msg.cards.length > 0 && (
                    <div className="mt-3 space-y-1.5" data-testid="ai-cards">
                      {msg.cards.map((c, j) => {
                        const Icon = CARD_ICON[c.kind] ?? Sparkles
                        return (
                          <Link key={j} href={c.href} onClick={close} data-testid="ai-card" className="flex items-center gap-3 p-2 rounded-lg bg-paper hover:bg-white border border-rule group">
                            <div className="w-10 h-10 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center flex-shrink-0 overflow-hidden">
                              {c.image ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={c.image} alt="" className="w-full h-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none" }} /> : <Icon size={17} />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-ink text-xs truncate">{c.title}</p>
                              {c.subtitle && <p className="text-[11px] text-sage-500 truncate">{c.subtitle}</p>}
                              {c.meta && <p className="text-[11px] text-teal-700 font-medium">{c.meta}</p>}
                            </div>
                            <ChevronRight size={14} className="text-sage-400 group-hover:translate-x-0.5 transition" />
                          </Link>
                        )
                      })}
                    </div>
                  )}
                  {msg.teachers && msg.teachers.length > 0 && (
                    <div className="mt-3 space-y-1.5 border-t border-rule pt-3">
                      {msg.teachers.map((t: any, j: number) => (
                        <Link key={j} href={t.href || `/teachers/${t.id}`} onClick={close} className="flex items-center gap-3 p-2 rounded-lg bg-paper hover:bg-white border border-rule group">
                          <div className="w-9 h-9 rounded-full bg-sage-200 flex items-center justify-center text-sage-700 font-display flex-shrink-0">{(t.name || "T")[0]}</div>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-ink text-xs truncate">{t.name}</p>
                            <p className="text-[11px] text-sage-500">★ {t.rating} · ${t.hourlyRate}/saat · {t.studentsCount} öğrenci</p>
                          </div>
                          <ChevronRight size={14} className="text-sage-400 group-hover:translate-x-0.5 transition" />
                        </Link>
                      ))}
                    </div>
                  )}
                  {i === messages.length - 1 && !busy && msg.suggestions && msg.suggestions.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5" data-testid="ai-suggestions">
                      {msg.suggestions.map((q) => (
                        <button key={q} onClick={() => handleSend(q)} className="px-2.5 py-1 rounded-full text-xs border border-rule bg-paper text-sage-700 hover:border-ink hover:text-ink transition">
                          {q}
                        </button>
                      ))}
                    </div>
                  )}
                  {msg.learning && (
                    <p data-testid="ai-learning" className="mt-2 text-xs text-sage-600 flex items-start gap-1.5"><Sparkles size={12} className="mt-0.5 shrink-0" /> Sorun kaydedildi; ekibimiz cevabı eklediğinde öğrenmiş olacağım.</p>
                  )}
                  {msg.links && msg.links.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {msg.links.map((l, k) => (
                        <Link
                          key={k}
                          href={l.href}
                          onClick={close}
                          data-testid="ai-link"
                          className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold border transition ${k === 0 ? "bg-ink text-cream border-ink hover:bg-sage-800" : "bg-paper text-ink border-rule hover:border-ink"}`}
                        >
                          {l.label} <ChevronRight size={12} />
                        </Link>
                      ))}
                    </div>
                  )}
                  {msg.askFeedback && i > 0 && !msg.streaming && (
                    <div className="mt-3 pt-2 border-t border-rule/70 text-xs text-sage-600" data-testid="ai-feedback">
                      {!msg.feedback ? (
                        <div className="flex items-center gap-2">
                          <span>Yardımcı oldu mu?</span>
                          <button onClick={() => rate(i, true)} aria-label="Evet, yardımcı oldu" data-testid="ai-helpful" className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-rule bg-paper hover:border-ink hover:text-ink"><ThumbsUp size={12} /> Evet</button>
                          <button onClick={() => rate(i, false)} aria-label="Hayır, yardımcı olmadı" data-testid="ai-unhelpful" className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-rule bg-paper hover:border-ink hover:text-ink"><ThumbsDown size={12} /> Hayır</button>
                        </div>
                      ) : msg.feedback === "up" ? (
                        <p data-testid="ai-thanks">Teşekkürler, sevindim! 🙏</p>
                      ) : (
                        <div data-testid="ai-escalate" className="space-y-2">
                          <p>Üzgünüm, yardımcı olamadım. Bunu not aldım; ekibimiz cevabı geliştirecek.</p>
                          <button onClick={() => openSupport("AI_UNHELPFUL", msg.question || "")} data-testid="ai-to-support" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-ink text-cream hover:bg-sage-800"><LifeBuoy size={12} /> Canlı destekle konuş</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-sage-100/70 rounded-xl rounded-bl-sm px-3.5 py-2.5 text-sm text-sage-800 max-w-[90%]"><TypingDots /></div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {showQuickPrompts && (
            <div className="px-4 pb-3 flex-shrink-0">
              <div className="flex flex-wrap gap-1.5">
                {QUICK_PROMPTS.map((prompt, i) => (
                  <button key={i} onClick={() => handleSend(prompt.text)} className="px-3 py-1.5 border border-rule hover:border-ink rounded-full text-xs text-sage-700 hover:text-ink transition">
                    {prompt.text}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="border-t border-rule px-3 py-3 flex-shrink-0">
            <div className="flex items-center gap-2 bg-white rounded-lg pl-3.5 pr-1.5 py-1.5 border border-rule focus-within:border-ink transition">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder="Nasıl yardımcı olabilirim?"
                aria-label="Mesajınız"
                maxLength={800}
                data-testid="ai-input"
                className="flex-1 bg-transparent outline-none text-sm text-ink placeholder:text-sage-500"
              />
              {messages.at(-1)?.streaming ? (
                <button onClick={stop} aria-label="Yanıtı durdur" data-testid="ai-stop" className="w-9 h-9 rounded-md flex items-center justify-center bg-ink text-cream hover:bg-sage-800 transition"><Square size={12} fill="currentColor" /></button>
              ) : (
                <button
                  onClick={() => handleSend()}
                  disabled={!input.trim() || busy}
                  aria-label="Gönder"
                  data-testid="ai-send"
                  className="w-9 h-9 rounded-md flex items-center justify-center bg-ink text-cream disabled:opacity-30 hover:bg-sage-800 transition"
                >
                  <Send size={14} />
                </button>
              )}
            </div>
            <p className="mt-1.5 px-1 text-[10px] text-sage-500">Otomatik asistan yanılabilir. Önemli konularda canlı destekle doğrulayın; sağlık sorunlarında doktora danışın.</p>
          </div>
          </>)}
        </div>
      )}
    </>
  )
}

function TypingDots() {
  return (
    <span className="flex gap-1 items-center py-1" aria-label="Yanıt yazılıyor">
      {[0, 150, 300].map((d) => <span key={d} className="w-1.5 h-1.5 rounded-full bg-sage-400 animate-bounce" style={{ animationDelay: `${d}ms` }} />)}
    </span>
  )
}
