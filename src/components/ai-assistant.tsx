"use client"

import { useState, useRef, useEffect } from "react"
import { MessageCircle, X, Send, Sparkles, ChevronRight, Mic, MicOff, Zap, Heart, Brain, Moon, Sun, Leaf } from "lucide-react"
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

const AI_MOODS = [
  { icon: <Leaf size={14} />, label: "Zen", color: "from-sage-500 to-emerald-500" },
  { icon: <Brain size={14} />, label: "Focus", color: "from-indigo-500 to-purple-500" },
  { icon: <Heart size={14} />, label: "Love", color: "from-rose-400 to-pink-500" },
  { icon: <Moon size={14} />, label: "Calm", color: "from-slate-500 to-blue-500" },
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
  const [selectedMood, setSelectedMood] = useState(0)
  const [showQuickPrompts, setShowQuickPrompts] = useState(true)
  const [typingText, setTypingText] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, typingText])

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

  const currentMood = AI_MOODS[selectedMood]

  if (isFullScreenLivePage(pathname)) return null

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => { setIsOpen(!isOpen); setTimeout(() => inputRef.current?.focus(), 300); }}
        className={`fixed bottom-6 right-6 z-[100] w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all duration-500 ${
          isOpen
            ? "bg-sage-800 rotate-180 scale-90"
            : `bg-gradient-to-br ${currentMood.color} hover:scale-110 hover:shadow-sage-500/40`
        }`}
        aria-label="AI Yoga Asistanı"
      >
        {isOpen ? (
          <X size={22} className="text-white" />
        ) : (
          <div className="relative">
            <Sparkles size={22} className="text-white animate-pulse" />
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white" />
          </div>
        )}
      </button>

      {/* Notification badge when closed */}
      {!isOpen && messages.length <= 1 && (
        <div className="fixed bottom-[84px] right-6 z-[99] bg-white rounded-2xl px-4 py-2 shadow-lg border border-sage-100 animate-slide-up text-xs text-sage-600 max-w-[200px]">
          💡 AI asistanınız hazır!
          <div className="absolute bottom-0 right-6 w-3 h-3 bg-white border-r border-b border-sage-100 transform rotate-45 translate-y-1.5" />
        </div>
      )}

      {/* Chat Panel */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-[100] w-[400px] max-w-[calc(100vw-48px)] max-h-[620px] bg-white rounded-3xl shadow-2xl shadow-sage-900/15 border border-sage-100/80 flex flex-col overflow-hidden animate-scale-in">
          
          {/* Header */}
          <div className={`bg-gradient-to-r ${currentMood.color} px-5 py-4 flex items-center gap-3 flex-shrink-0 relative overflow-hidden`}>
            {/* Animated background pattern */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-0 left-0 w-20 h-20 bg-white rounded-full -translate-x-10 -translate-y-10 animate-float" />
              <div className="absolute bottom-0 right-0 w-16 h-16 bg-white rounded-full translate-x-8 translate-y-8 animate-float" style={{ animationDelay: "2s" }} />
            </div>
            
            <div className="relative z-10 flex items-center gap-3 w-full">
              <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm border border-white/10">
                <Sparkles size={20} className="text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-white font-bold text-sm flex items-center gap-2">
                  AYA AI
                  <span className="bg-white/20 text-[9px] px-2 py-0.5 rounded-full font-medium backdrop-blur-sm">PRO</span>
                </h3>
                <p className="text-white/60 text-xs flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  Powered by Gemini
                </p>
              </div>
              
              {/* Mood selector */}
              <div className="flex gap-1">
                {AI_MOODS.map((mood, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedMood(i)}
                    className={`w-7 h-7 rounded-full flex items-center justify-center transition-all duration-300 ${selectedMood === i ? 'bg-white/30 scale-110' : 'bg-white/10 hover:bg-white/20'}`}
                    title={mood.label}
                  >
                    <span className="text-white">{mood.icon}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-gradient-to-b from-sage-50/50 to-white min-h-0" style={{ maxHeight: "400px" }}>
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-fade-in`}>
                {msg.role === "ai" && (
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-sage-400 to-sage-600 flex items-center justify-center mr-2 mt-1 flex-shrink-0 shadow-sm">
                    <Sparkles size={12} className="text-white" />
                  </div>
                )}
                <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-gradient-to-br from-sage-600 to-sage-700 text-white rounded-br-md shadow-sm shadow-sage-600/20"
                    : "bg-white text-sage-800 shadow-sm border border-sage-100/80 rounded-bl-md"
                }`}>
                  <div className="whitespace-pre-wrap" dangerouslySetInnerHTML={{
                    __html: msg.text
                      .replace(/\*\*(.*?)\*\*/g, '<strong class="text-sage-900 font-semibold">$1</strong>')
                      .replace(/\n/g, '<br />')
                  }} />

                  {/* Teacher Cards */}
                  {msg.teachers && msg.teachers.length > 0 && (
                    <div className="mt-3 space-y-2 border-t border-sage-100 pt-3">
                      {msg.teachers.map((t: any, j: number) => (
                        <Link
                          key={j}
                          href={`/teachers/${t.id}`}
                          className="flex items-center gap-3 p-2.5 rounded-xl bg-gradient-to-r from-sage-50 to-transparent hover:from-sage-100 transition group border border-sage-100/50"
                        >
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sage-200 to-sage-300 flex items-center justify-center text-sage-700 font-display text-sm flex-shrink-0 shadow-sm">
                            {(t.name || "T")[0]}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-sage-900 text-xs truncate">{t.name}</p>
                            <p className="text-[10px] text-sage-500 flex items-center gap-1">
                              ⭐ {t.rating} · ${t.hourlyRate}/hr · {t.studentsCount} öğrenci
                            </p>
                          </div>
                          <ChevronRight size={14} className="text-sage-400 group-hover:text-sage-600 group-hover:translate-x-0.5 transition-all" />
                        </Link>
                      ))}
                    </div>
                  )}

                  {/* Timestamp */}
                  <p className={`text-[9px] mt-1.5 ${msg.role === "user" ? "text-white/50" : "text-sage-400"} text-right`}>
                    {formatTime(msg.timestamp)}
                  </p>
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {(loading || isTyping) && (
              <div className="flex justify-start animate-fade-in">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-sage-400 to-sage-600 flex items-center justify-center mr-2 mt-1 flex-shrink-0">
                  <Sparkles size={12} className="text-white animate-spin" />
                </div>
                <div className="bg-white rounded-2xl rounded-bl-md px-4 py-3 shadow-sm border border-sage-100/80 max-w-[80%]">
                  {isTyping ? (
                    <div className="text-sm text-sage-800 whitespace-pre-wrap" dangerouslySetInnerHTML={{
                      __html: typingText
                        .replace(/\*\*(.*?)\*\*/g, '<strong class="text-sage-900 font-semibold">$1</strong>')
                        .replace(/\n/g, '<br />')
                    }} />
                  ) : (
                    <div className="flex gap-1.5 items-center">
                      <span className="w-2 h-2 rounded-full bg-sage-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-2 h-2 rounded-full bg-sage-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-2 h-2 rounded-full bg-sage-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                      <span className="text-[10px] text-sage-400 ml-2">düşünüyor...</span>
                    </div>
                  )}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts */}
          {showQuickPrompts && (
            <div className="px-4 pb-2 flex-shrink-0 border-t border-sage-50 pt-2 bg-white">
              <p className="text-[10px] text-sage-400 font-medium uppercase tracking-wider mb-2">Hızlı Başlangıç</p>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_PROMPTS.map((prompt, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(prompt.text)}
                    className="px-3 py-1.5 bg-sage-50 hover:bg-sage-100 border border-sage-100 rounded-full text-xs text-sage-700 transition-all hover:scale-105 hover:shadow-sm flex items-center gap-1"
                  >
                    <span>{prompt.icon}</span> {prompt.text}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="border-t border-sage-100 bg-white px-4 py-3 flex-shrink-0">
            <div className="flex items-center gap-2 bg-sage-50/80 rounded-2xl pl-4 pr-1.5 py-1.5 border border-sage-200 focus-within:border-sage-400 focus-within:shadow-sm transition-all">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder="Size nasıl yardımcı olabilirim?"
                className="flex-1 bg-transparent outline-none text-sm text-sage-800 placeholder:text-sage-400"
              />
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || loading}
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300 flex-shrink-0 ${
                  input.trim()
                    ? `bg-gradient-to-r ${currentMood.color} text-white shadow-sm hover:shadow-md hover:scale-105`
                    : "bg-sage-200 text-sage-400 cursor-not-allowed"
                }`}
              >
                <Send size={14} className={input.trim() ? "ml-0.5" : ""} />
              </button>
            </div>
            <p className="text-[9px] text-sage-300 text-center mt-2">AYA AI · Gemini ile güçlendirilmiştir</p>
          </div>
        </div>
      )}
    </>
  )
}
