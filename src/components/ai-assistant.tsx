"use client"

import { useState, useRef, useEffect } from "react"
import { MessageCircle, X, Send, ChevronRight } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

interface Message {
  role: "user" | "ai"
  text: string
  teachers?: any[]
  timestamp?: Date
}

const QUICK_PROMPTS = [
  { icon: "🧘", text: "Başlangıç seviyesi yoga", category: "level" },
  { icon: "😰", text: "Stres ve anksiyete için", category: "health" },
  { icon: "💪", text: "Güçlendirme yogası", category: "style" },
  { icon: "🌙", text: "Uyku öncesi rahatlama", category: "time" },
  { icon: "🤰", text: "Hamilelik yogası", category: "special" },
  { icon: "🔥", text: "Kilo verme programı", category: "goal" },
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
      text: "🙏 **Merhaba!** Ben AYA, yapay zeka yoga asistanınızım.\n\nSize en uygun öğretmeni bulabilir, yoga stilleri hakkında bilgi verebilir ve kişisel öneriler sunabilirim.\n\nAşağıdaki hızlı butonları kullanın veya doğrudan sorunuzu yazın!",
      timestamp: new Date()
    }
  ])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [hint, setHint] = useState(false)
  const [showQuickPrompts, setShowQuickPrompts] = useState(true)
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
  const typeMessage = (fullText: string, teachers?: any[]) => {
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
        setMessages(prev => [...prev, { role: "ai", text: fullText, teachers, timestamp: new Date() }])
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

      const data = await res.json()
      setLoading(false)
      typeMessage(
        data.reply || "Şu an size yardımcı olamıyorum, lütfen tekrar deneyin.",
        data.teachers
      )
    } catch {
      setLoading(false)
      typeMessage("Bağlantı hatası oluştu. Lütfen tekrar deneyin.")
    }
  }

  const formatTime = (date?: Date) => {
    if (!date) return ""
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  // the student-facing helper has no place in the admin workspace or in the dashboards' working screens
  if (isFullScreenLivePage(pathname) || pathname?.startsWith("/admin")) return null

  const renderText = (text: string) =>
    text.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-ink">$1</strong>').replace(/\n/g, "<br />")

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
          <button onClick={() => setHint(false)} aria-label="Kapat" className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-ink text-cream flex items-center justify-center"><X size={11} /></button>
        </div>
      )}

      {isOpen && (
        <div role="dialog" aria-label="AYA yoga rehberi" className="fixed bottom-20 right-5 z-[90] w-[380px] max-w-[calc(100vw-40px)] max-h-[min(600px,calc(100vh-120px))] bg-paper rounded-2xl shadow-2xl border border-rule flex flex-col overflow-hidden animate-scale-in">
          <div className="px-5 py-4 flex items-center gap-3 flex-shrink-0 bg-ink text-cream">
            <div className="flex-1 min-w-0">
              <h3 className="font-display text-xl leading-none">AYA Rehber</h3>
              <p className="text-cream/60 text-xs mt-1">Eğitmen ve yoga stili önerileri</p>
            </div>
            <button onClick={() => setIsOpen(false)} aria-label="Kapat" className="p-1.5 rounded-md hover:bg-white/10"><X size={16} /></button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0" role="log" aria-live="polite">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[88%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${msg.role === "user" ? "bg-ink text-cream rounded-br-sm" : "bg-sage-100/70 text-sage-800 rounded-bl-sm"}`}>
                  <div dangerouslySetInnerHTML={{ __html: renderText(msg.text) }} />
                  {msg.teachers && msg.teachers.length > 0 && (
                    <div className="mt-3 space-y-1.5 border-t border-rule pt-3">
                      {msg.teachers.map((t: any, j: number) => (
                        <Link key={j} href={`/teachers/${t.id}`} className="flex items-center gap-3 p-2 rounded-lg bg-paper hover:bg-white border border-rule group">
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
                className="flex-1 bg-transparent outline-none text-sm text-ink placeholder:text-sage-500"
              />
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || loading}
                aria-label="Gönder"
                className="w-9 h-9 rounded-md flex items-center justify-center bg-ink text-cream disabled:opacity-30 hover:bg-sage-800 transition"
              >
                <Send size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
