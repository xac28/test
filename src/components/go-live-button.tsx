"use client"

import Link from "next/link"
import { Video } from "lucide-react"
import { Dot, accentBtn, primaryBtn } from "@/components/panel/ui"

interface LiveRoom {
  id: string
  roomName: string
  title: string
  isActive: boolean
  createdAt: string
}

export function GoLiveButton({ activeLiveRoom }: { activeLiveRoom: LiveRoom | null }) {
  if (activeLiveRoom) {
    return (
      <div className="bg-paper border border-rule border-l-4 !border-l-clay-500 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4" data-testid="go-live-active">
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-ink flex items-center gap-2"><Dot tone="live" /> Şu anda canlısın</p>
          <p className="text-sm text-sage-600 mt-1 truncate">
            &ldquo;{activeLiveRoom.title}&rdquo; · {new Date(activeLiveRoom.createdAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" })} başladı
          </p>
        </div>
        <Link href="/live/studio" className={primaryBtn}>Stüdyoya dön</Link>
      </div>
    )
  }

  return (
    <div className="bg-paper border border-rule rounded-xl p-5 flex flex-col sm:flex-row sm:items-center gap-4">
      <div className="flex-1 min-w-0">
        <h3 className="text-[15px] font-semibold text-ink">Canlı yayına çık</h3>
        <p className="text-sm text-sage-600 mt-1">Randevu gerekmeden anında yayın başlat: 1080p&apos;ye kadar, sohbet ve ders kaydıyla.</p>
      </div>
      <Link href="/live/studio" data-testid="go-live-link" className={accentBtn}><Video size={16} aria-hidden /> Yayın stüdyosunu aç</Link>
    </div>
  )
}
