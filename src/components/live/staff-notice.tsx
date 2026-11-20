"use client"

import { useEffect } from "react"
import { ShieldAlert, X } from "lucide-react"

/** A message from the officials, shown on top of the studio (to the teacher) or of the viewer page (to everybody). */
export function StaffNoticeBanner({ notice, onDismiss }: { notice: { text: string; audience: "teacher" | "all"; ts: number } | null; onDismiss: () => void }) {
  useEffect(() => {
    if (!notice) return
    // a notice stays until it is read, but never longer than a minute
    const t = setTimeout(onDismiss, 60_000)
    return () => clearTimeout(t)
  }, [notice, onDismiss])
  if (!notice) return null
  return (
    <div role="alert" data-testid="staff-notice" className="fixed top-3 left-1/2 -translate-x-1/2 z-[200] w-[min(92vw,640px)] bg-saffron-300 text-ink rounded-2xl shadow-2xl border border-saffron-400 px-5 py-4 flex items-start gap-3">
      <ShieldAlert size={22} className="shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-wider opacity-70">{notice.audience === "all" ? "Yetkili duyurusu" : "Yetkili mesajı · yalnızca sana görünür"}</p>
        <p className="mt-0.5 text-base leading-snug break-words" data-testid="staff-notice-text">{notice.text}</p>
      </div>
      <button type="button" onClick={onDismiss} aria-label="Mesajı kapat" data-testid="staff-notice-close" className="shrink-0 w-10 h-10 -m-2 flex items-center justify-center rounded-full hover:bg-black/10"><X size={18} /></button>
    </div>
  )
}
