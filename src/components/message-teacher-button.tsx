"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { MessageCircle, Loader2 } from "lucide-react"

export function MessageTeacherButton({ teacherId }: { teacherId: string }) {
  const { data: session } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleMessage = async () => {
    if (!session?.user) {
      alert("Mesaj göndermek için giriş yapmalısınız.")
      return
    }

    setLoading(true)
    try {
      // Create a dummy message just to instantiate the conversation
      // If conversation already exists, it will just add this greeting.
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacherId, content: "Merhaba! Bilgi almak istiyorum." })
      })

      if (res.ok) {
        router.push("/messages")
      } else {
        alert("Mesaj başlatılamadı.")
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleMessage}
      disabled={loading}
      className="flex items-center gap-2 px-4 py-2 bg-sage-100 hover:bg-sage-200 text-sage-700 rounded-full text-sm font-medium transition disabled:opacity-50 btn-press"
    >
      {loading ? <Loader2 size={16} className="animate-spin" /> : <MessageCircle size={16} />}
      Mesaj Gönder
    </button>
  )
}
