"use client"

import { useEffect, useState } from "react"
import { Star } from "lucide-react"
import { ReportButton } from "@/components/report-dialog"
import { timeAgo } from "@/components/notification-bell"

interface Review { id: string; rating: number; comment: string | null; createdAt: string; author: string }

/** Written reviews of a teacher, each with its own "Bildir" button (reported reviews go to the admins' queue). */
export function TeacherReviews({ teacherId }: { teacherId: string }) {
  const [items, setItems] = useState<Review[] | null>(null)
  useEffect(() => {
    let alive = true
    fetch(`/api/teachers/${encodeURIComponent(teacherId)}/reviews`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { reviews: [] }))
      .then((d) => alive && setItems(d.reviews))
      .catch(() => alive && setItems([]))
    return () => { alive = false }
  }, [teacherId])

  if (!items || items.length === 0) return null
  const withText = items.filter((r) => r.comment)
  return (
    <div className="bg-cream rounded-3xl p-6 lg:p-8 border border-sage-100" data-testid="teacher-reviews">
      <h2 className="font-display text-2xl text-ink mb-4">Öğrenci yorumları <span className="text-base text-ink/50">({items.length})</span></h2>
      {withText.length === 0 ? (
        <p className="text-sm text-ink/60">Henüz yazılı yorum yok; öğrenciler yalnızca puan verdi.</p>
      ) : (
        <ul className="space-y-4">
          {withText.map((r) => (
            <li key={r.id} data-testid="review-item" className="border-b border-rule last:border-0 pb-4 last:pb-0">
              <div className="flex items-center gap-2 text-sm">
                <span className="flex" aria-label={`${r.rating} yıldız`}>{[1, 2, 3, 4, 5].map((n) => <Star key={n} size={14} className={n <= r.rating ? "fill-yellow-500 text-yellow-500" : "text-sage-300"} />)}</span>
                <span className="font-medium text-ink">{r.author}</span>
                <span className="text-xs text-ink/50">· {timeAgo(r.createdAt)}</span>
                <ReportButton targetType="REVIEW" targetId={r.id} subject={`Değerlendirme · ${r.author}`} label="Bildir" className="ml-auto inline-flex items-center gap-1.5 text-xs text-ink/50 hover:text-red-600 min-h-[32px]" />
              </div>
              <p className="mt-1.5 text-sm text-ink/80 whitespace-pre-line break-words">{r.comment}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
