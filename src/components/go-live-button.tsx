"use client"

import Link from "next/link"

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
      <div className="glass-card p-6 rounded-3xl border-2 border-green-300/50 bg-green-50/30">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
              </span>
              <span className="text-green-700 font-semibold text-lg">Şu anda canlısınız</span>
            </div>
            <span className="text-sage-500 text-sm">
              &ldquo;{activeLiveRoom.title}&rdquo; — {new Date(activeLiveRoom.createdAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })} başladı
            </span>
          </div>
          <Link href="/live/studio" className="bg-green-600 text-white px-5 py-2.5 rounded-full font-medium hover:bg-green-700 transition btn-press text-sm">
            Stüdyoya dön
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="glass-card p-6 rounded-3xl border border-sage-100/50">
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div className="flex-1">
          <h3 className="text-xl font-display text-sage-900 mb-1">Canlı yayına çık</h3>
          <p className="text-sage-500 text-sm">Randevu gerekmeden anında yayın başlatın — 1080p&apos;ye kadar, sohbet ve ders kaydıyla.</p>
        </div>
        <Link href="/live/studio" data-testid="go-live-link" className="bg-accent text-white px-6 py-2.5 rounded-full font-medium hover:bg-accent-dark transition btn-press flex items-center gap-2 whitespace-nowrap">
          Yayın stüdyosunu aç
        </Link>
      </div>
    </div>
  )
}
