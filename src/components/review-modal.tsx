"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

interface ReviewModalProps {
  bookingId: string
  teacherName: string
  onClose: () => void
}

export function ReviewModal({ bookingId, teacherName, onClose }: ReviewModalProps) {
  const router = useRouter()
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId, rating, comment }),
      })
      if (res.ok) {
        alert("Yorumun gönderildi, teşekkürler!")
        onClose()
        router.refresh()
      } else {
        const data = await res.json()
        alert(data.error || "Yorum gönderilemedi")
      }
    } catch {
      alert("Bağlantı hatası, tekrar dene")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-sage-400 hover:text-sage-700">
          ✕
        </button>
        <h2 className="text-2xl font-display text-sage-900 mb-2">Yorum bırak</h2>
        <p className="text-sage-500 text-sm mb-6">{teacherName} ile dersin nasıldı?</p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                className={`text-4xl transition-transform ${star <= rating ? "text-yellow-400 scale-110" : "text-gray-200 hover:text-yellow-200"}`}
              >
                ★
              </button>
            ))}
          </div>

          <div>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Ders hakkında düşüncelerini paylaş… (isteğe bağlı)"
              rows={4}
              className="w-full rounded-2xl border border-sage-200 p-4 text-sage-900 focus:outline-none focus:ring-2 focus:ring-sage-500 resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-sage-600 text-white py-3.5 rounded-full font-medium hover:bg-sage-700 transition disabled:opacity-50 btn-press"
          >
            {submitting ? "Gönderiliyor…" : "Yorumu gönder"}
          </button>
        </form>
      </div>
    </div>
  )
}
