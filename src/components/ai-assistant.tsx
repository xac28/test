"use client"

import { useState, useRef, useEffect } from "react"
import { MessageCircle, X, Send, ChevronRight, ThumbsUp, ThumbsDown, LifeBuoy, Sparkles } from "lucide-react"
import { SupportChat } from "@/components/support-chat"
import Link from "next/link"
import { usePathname } from "next/navigation"

interface GuideLink {
  label: string
  href: string
}
interface Message {
  role: "user" | "ai"
  text: string
  teachers?: any[]
  links?: GuideLink[]
  suggestions?: string[]
  timestamp?: Date
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
  { icon: "", text: "Bel ağrım için hangi yoga?", category: "health" },
  { icon: "", text: "Stres ve uyku için", category: "health" },
  { icon: "", text: "Canlı yayın var mı?", category: "live" },
  { icon: "", text: "Atölyeleri göster", category: "workshops" },
  { icon: "", text: "Üye olmak istiyorum", category: "account" },
  { icon: "", text: "Eğitmen olmak istiyorum", category: "teacher" },
]


// Full-screen live pages (broadcast viewer/studio, lesson room) own the bottom-right corner (chat send button)
const isFullScreenLivePage = (path: string | null) =>
  !!path && (path.startsWith("/live/") || path === "/room" || path.startsWith("/room/"))

export function AiAssistant() {
  const pathname = usePathname()

  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "ai",
      text: "**Merhaba!** Ben AYA Rehber. Sana uygun eğitmeni, atölyeyi ya da canlı yayını bulurum; üyelik, ders kaydı ve ödeme gibi konularda doğru sayfaya yönlendiririm.\n\nBir şey yaz ya da aşağıdan seç.",
      timestamp: new Date()
    }
  ])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [hint, setHint] = useState(false)
  const [showQuickPrompts, setShowQuickPrompts] = useState(true)
  const [mode, setMode] = useState<"guide" | "support">("guide")
  const [supportCtx, setSupportCtx] = useState<{ source: "USER" | "AI_UNHELPFUL" | "AI_REQUEST"; context: string }>({ source: "USER", context: "" })
  const [typingText, setTypingText] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, typingText])

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

  // Typing animation for AI responses
  const typeMessage = (fullText: string, teachers?: any[], links?: GuideLink[], suggestions?: string[], extra: Partial<Message> = {}) => {
    setIsTyping(true)
    setTypingText("")
    let i = 0
    const interval = setInterval(() => {
      if (i < fullText.length) {
        setTypingText(fullText.substring(0, i + 1))
        i++
      } else {
        clearInterval(interval)
        setIsTyping(false)
        setTypingText("")
        setMessages(prev => [...prev, { role: "ai", text: fullText, teachers, links, suggestions, timestamp: new Date(), ...extra }])
      }
    }, 12) // Fast but visible typing speed
  }

  const handleSend = async (text?: string) => {
    const userMsg = (text || input).trim()
    if (!userMsg || loading) return

    setInput("")
    setShowQuickPrompts(false)
    setMessages(prev => [...prev, { role: "user", text: userMsg, timestamp: new Date() }])
    setLoading(true)

    try {
      const res = await fetch("/api/ai/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg })
      })

      const data = await res.json().catch(() => ({}))
      setLoading(false)
      typeMessage(
        data.reply || (res.status === 429 ? "Çok hızlı yazıyorsun 🙂 Birkaç saniye bekleyip tekrar dene." : "Şu an yardımcı olamıyorum, lütfen biraz sonra tekrar dene."),
        data.teachers,
        data.links,
        data.suggestions,
        { interactionId: data.interactionId, askFeedback: !!data.askFeedback, learning: !!data.learning, question: userMsg },
      )
      // "canlı destek" → the chat opens right after the answer
      if (data.action === "support") openSupport("AI_REQUEST", lastQuestion())
    } catch {
      setLoading(false)
      typeMessage("Bağlantı hatası oluştu. Lütfen tekrar deneyin.")
    }
  }

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

  const formatTime = (date?: Date) => {
    if (!date) return ""
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  // the student-facing helper has no place in the admin workspace or in the dashboards' working screens
  if (isFullScreenLivePage(pathname) || pathname?.startsWith("/admin")) return null

  // everything shown here (visitor input, teacher and workshop names) is escaped before the light markdown is applied
  const escapeHtml = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
  const renderText = (text: string) =>
    escapeHtml(text).replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-ink">$1</strong>').replace(/\n/g, "<br />")

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
          <button onClick={() => setHint(false)} aria-label="Kapat" className="tap-area absolute -top-2 -right-2 w-5 h-5 rounded-full bg-ink text-cream flex items-center justify-center"><X size={11} /></button>
        </div>
      )}

      {isOpen && (
        <div role="dialog" aria-label="AYA yoga rehberi" className="fixed bottom-20 right-5 z-[90] w-[380px] max-w-[calc(100vw-40px)] max-h-[min(600px,calc(100vh-120px))] bg-paper rounded-2xl shadow-2xl border border-rule flex flex-col overflow-hidden animate-scale-in">
          <div className="px-5 pt-4 pb-3 flex-shrink-0 bg-ink text-cream">
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <h3 className="font-display text-xl leading-none">{mode === "guide" ? "AYA Rehber" : "Canlı destek"}</h3>
                <p className="text-cream/60 text-xs mt-1">{mode === "guide" ? "Sorularını yanıtlar, doğru sayfaya götürür" : "Ekibimizle yaz, buradan yanıtlasınlar"}</p>
              </div>
              <button onClick={() => setIsOpen(false)} aria-label="Kapat" className="p-1.5 rounded-md hover:bg-white/10"><X size={16} /></button>
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
                <div className={`max-w-[88%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${msg.role === "user" ? "bg-ink text-cream rounded-br-sm" : "bg-sage-100/70 text-sage-800 rounded-bl-sm"}`}>
                  <div dangerouslySetInnerHTML={{ __html: renderText(msg.text) }} />
                  {msg.teachers && msg.teachers.length > 0 && (
                    <div className="mt-3 space-y-1.5 border-t border-rule pt-3">
                      {msg.teachers.map((t: any, j: number) => (
                        <Link key={j} href={t.href || `/teachers/${t.id}`} onClick={() => setIsOpen(false)} className="flex items-center gap-3 p-2 rounded-lg bg-paper hover:bg-white border border-rule group">
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
                  {i === messages.length - 1 && !loading && !isTyping && msg.suggestions && msg.suggestions.length > 0 && (
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
                          onClick={() => setIsOpen(false)}
                          data-testid="ai-link"
                          className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold border transition ${k === 0 ? "bg-ink text-cream border-ink hover:bg-sage-800" : "bg-paper text-ink border-rule hover:border-ink"}`}
                        >
                          {l.label} <ChevronRight size={12} />
                        </Link>
                      ))}
                    </div>
                  )}
                  {msg.askFeedback && i > 0 && (
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

            {(loading || isTyping) && (
              <div className="flex justify-start">
                <div className="bg-sage-100/70 rounded-xl rounded-bl-sm px-3.5 py-2.5 text-sm text-sage-800 max-w-[88%]">
                  {isTyping ? (
                    <div dangerouslySetInnerHTML={{ __html: renderText(typingText) }} />
                  ) : (
                    <span className="flex gap-1 items-center" aria-label="Yanıt yazılıyor">
                      {[0, 150, 300].map((d) => <span key={d} className="w-1.5 h-1.5 rounded-full bg-sage-400 animate-bounce" style={{ animationDelay: `${d}ms` }} />)}
                    </span>
                  )}
                </div>
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
                data-testid="ai-input"
                className="flex-1 bg-transparent outline-none text-sm text-ink placeholder:text-sage-500"
              />
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || loading}
                aria-label="Gönder"
                data-testid="ai-send"
                className="w-9 h-9 rounded-md flex items-center justify-center bg-ink text-cream disabled:opacity-30 hover:bg-sage-800 transition"
              >
                <Send size={14} />
              </button>
            </div>
          </div>
          </>)}
        </div>
      )}
    </>
  )
}
