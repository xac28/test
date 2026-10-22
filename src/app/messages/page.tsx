"use client"

import { useState, useEffect, useRef } from "react"
import { useSession } from "next-auth/react"
import Navbar from "@/components/Navbar"
import Footer from "@/components/Footer"
import { Send, UserCircle, Check, CheckCheck, Loader2 } from "lucide-react"

export default function MessagesPage() {
  const { data: session } = useSession()
  const [conversations, setConversations] = useState<any[]>([])
  const [activeConv, setActiveConv] = useState<any | null>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [content, setContent] = useState("")
  const [loading, setLoading] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchConversations()
    const interval = setInterval(fetchConversations, 5000) // Poll every 5s
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (activeConv) {
      fetchMessages(activeConv.id)
      const interval = setInterval(() => fetchMessages(activeConv.id), 2000) // Poll active chat every 2s
      return () => clearInterval(interval)
    }
  }, [activeConv])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const fetchConversations = async () => {
    const res = await fetch("/api/messages")
    if (res.ok) {
      setConversations(await res.json())
      setLoading(false)
    }
  }

  const fetchMessages = async (convId: string) => {
    const res = await fetch(`/api/messages?conversationId=${convId}`)
    if (res.ok) {
      setMessages(await res.json())
    }
  }

  const handleSend = async () => {
    if (!content.trim() || !activeConv || !session) return
    
    // Find the other user's ID
    const targetUserId = activeConv.userOneId === session.user.id ? activeConv.userTwoId : activeConv.userOneId

    // Optimistic UI
    const tempMessage = {
      id: Math.random().toString(),
      content,
      senderId: session.user.id,
      createdAt: new Date().toISOString(),
      read: false
    }
    setMessages([...messages, tempMessage])
    setContent("")

    const res = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetUserId, content })
    })

    if (res.ok) {
      fetchMessages(activeConv.id)
      fetchConversations()
    }
  }

  const getOtherUser = (conv: any) => {
    return conv.userOne.id === session?.user?.id ? conv.userTwo : conv.userOne
  }

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen flex items-center justify-center bg-sage-50">
          <Loader2 className="animate-spin text-sage-600" size={40} />
        </div>
      </>
    )
  }

  return (
    <>
      <Navbar />
      <div className="max-w-6xl mx-auto h-[calc(100vh-64px)] p-4 md:p-6 flex flex-col md:flex-row gap-6">
        
        {/* Sidebar */}
        <div className={`w-full md:w-1/3 bg-white rounded-3xl shadow-sm border border-sage-100 flex flex-col overflow-hidden ${activeConv ? 'hidden md:flex' : 'flex'}`}>
          <div className="p-5 border-b border-sage-100 bg-sage-50/50">
            <h2 className="text-xl font-display text-ink font-semibold">Mesajlar</h2>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {conversations.length === 0 ? (
              <div className="p-8 text-center text-sage-500">
                Henüz hiç mesajınız yok. Öğretmen profillerinden mesaj gönderebilirsiniz.
              </div>
            ) : (
              conversations.map(conv => {
                const otherUser = getOtherUser(conv)
                const lastMessage = conv.messages[0]
                const isUnread = lastMessage && lastMessage.senderId !== session?.user?.id && !lastMessage.read

                return (
                  <button 
                    key={conv.id}
                    onClick={() => setActiveConv(conv)}
                    className={`w-full p-4 flex items-center gap-3 hover:bg-sage-50 transition text-left border-b border-sage-50 ${activeConv?.id === conv.id ? 'bg-sage-50' : ''}`}
                  >
                    <div className="relative">
                      {otherUser.image ? (
                        <img src={otherUser.image} alt="" className="w-12 h-12 rounded-full object-cover" />
                      ) : (
                        <UserCircle className="w-12 h-12 text-sage-300" />
                      )}
                      {isUnread && <div className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className={`text-sm truncate ${isUnread ? 'font-bold text-ink' : 'font-medium text-ink'}`}>
                        {otherUser.name}
                        {otherUser.role === "TEACHER" && <span className="ml-2 text-[10px] bg-sage-100 text-sage-600 px-2 py-0.5 rounded-full">Öğretmen</span>}
                      </h3>
                      <p className={`text-xs truncate mt-0.5 ${isUnread ? 'text-sage-800 font-medium' : 'text-sage-500'}`}>
                        {lastMessage ? lastMessage.content : "Mesaj gönderin..."}
                      </p>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className={`w-full md:w-2/3 bg-white rounded-3xl shadow-sm border border-sage-100 flex flex-col overflow-hidden ${!activeConv ? 'hidden md:flex items-center justify-center' : 'flex'}`}>
          {!activeConv ? (
            <div className="text-center text-sage-500">
              <MessageCircle size={48} className="mx-auto mb-4 opacity-20" />
              <p>Sohbet başlatmak için soldan bir konuşma seçin.</p>
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-sage-100 bg-sage-50/50 flex items-center gap-3">
                <button className="md:hidden text-sage-500" onClick={() => setActiveConv(null)}>
                  ← Geri
                </button>
                {getOtherUser(activeConv).image ? (
                  <img src={getOtherUser(activeConv).image} alt="" className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <UserCircle className="w-10 h-10 text-sage-300" />
                )}
                <div>
                  <h3 className="font-semibold text-ink text-sm">{getOtherUser(activeConv).name}</h3>
                </div>
              </div>

              {/* Messages Container */}
              <div className="flex-1 p-4 overflow-y-auto bg-[url('/chat-pattern.png')] bg-repeat bg-opacity-10 space-y-4">
                {messages.map((msg, i) => {
                  const isMe = msg.senderId === session?.user?.id
                  return (
                    <div key={msg.id || i} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                      <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${isMe ? 'bg-sage-600 text-white rounded-tr-sm' : 'bg-sage-100 text-ink rounded-tl-sm'}`}>
                        <p className="text-sm break-words">{msg.content}</p>
                        <div className={`flex items-center justify-end gap-1 mt-1 ${isMe ? 'text-sage-200' : 'text-sage-500'}`}>
                          <span className="text-[10px]">{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          {isMe && (msg.read ? <CheckCheck size={12} className="text-blue-200" /> : <Check size={12} />)}
                        </div>
                      </div>
                    </div>
                  )
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="p-4 border-t border-sage-100 bg-white">
                <form 
                  onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                  className="flex items-center gap-3"
                >
                  <input
                    type="text"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Bir mesaj yazın..."
                    className="flex-1 bg-sage-50 rounded-full px-5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300 border border-transparent"
                  />
                  <button 
                    type="submit"
                    disabled={!content.trim()}
                    className="w-11 h-11 bg-sage-600 hover:bg-sage-700 text-white rounded-full flex items-center justify-center transition disabled:opacity-50"
                  >
                    <Send size={18} className="ml-1" />
                  </button>
                </form>
              </div>
            </>
          )}
        </div>

      </div>
    </>
  )
}

function MessageCircle(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>
  )
}
