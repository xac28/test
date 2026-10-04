"use client"

import { useEffect, useState } from "react"
import {
  Activity, Calendar, FileText, Film, Flag, History, LucideIcon, PlaySquare, ShieldAlert, Sparkles, Users, Video, Wallet, DollarSign, BookOpen, Images, LifeBuoy, Bot, Star,
} from "lucide-react"

export type AdminBadges = { applications: number; trials: number; payouts: number; reports: number; urgentReports: number; liveNow: number; pendingPosts: number; openSupport: number; aiUnknown: number; reviewReports: number }

export interface TabDef {
  id: string
  label: string
  icon: LucideIcon
  group: "Genel" | "Moderasyon" | "Topluluk" | "Operasyon"
  badge?: (b: AdminBadges) => { value: number; tone: "red" | "amber" | "green" } | null
}

export const ADMIN_TABS: TabDef[] = [
  { id: "overview", label: "Genel Bakış", icon: Activity, group: "Genel" },
  { id: "reports", label: "Raporlar", icon: Flag, group: "Moderasyon", badge: (b) => (b.reports ? { value: b.reports, tone: b.urgentReports ? "red" : "amber" } : null) },
  { id: "community", label: "Fotoğraflar", icon: Images, group: "Moderasyon", badge: (b) => (b.pendingPosts ? { value: b.pendingPosts, tone: "amber" } : null) },
  { id: "support", label: "Canlı Destek", icon: LifeBuoy, group: "Moderasyon", badge: (b) => (b.openSupport ? { value: b.openSupport, tone: "red" } : null) },
  { id: "ai", label: "Yapay Zeka", icon: Bot, group: "Moderasyon", badge: (b) => (b.aiUnknown ? { value: b.aiUnknown, tone: "amber" } : null) },
  { id: "reviews", label: "Değerlendirmeler", icon: Star, group: "Moderasyon", badge: (b) => (b.reviewReports ? { value: b.reviewReports, tone: "amber" } : null) },
  { id: "users", label: "Kullanıcılar", icon: Users, group: "Moderasyon" },
  { id: "security", label: "Güvenlik", icon: ShieldAlert, group: "Moderasyon" },
  { id: "audit", label: "Günlükler", icon: History, group: "Moderasyon" },
  { id: "applications", label: "Başvurular", icon: FileText, group: "Topluluk", badge: (b) => (b.applications ? { value: b.applications, tone: "amber" } : null) },
  { id: "trials", label: "Deneme Odaları", icon: PlaySquare, group: "Topluluk", badge: (b) => (b.trials ? { value: b.trials, tone: "amber" } : null) },
  { id: "workshops", label: "Atölyeler", icon: Sparkles, group: "Topluluk" },
  { id: "articles", label: "İçerikler", icon: BookOpen, group: "Topluluk" },
  { id: "rooms", label: "Canlı Oturumlar", icon: Video, group: "Operasyon", badge: (b) => (b.liveNow ? { value: b.liveNow, tone: "green" } : null) },
  { id: "bookings", label: "Rezervasyonlar", icon: Calendar, group: "Operasyon" },
  { id: "recordings", label: "Ders Kayıtları", icon: Film, group: "Operasyon" },
  { id: "payouts", label: "Ödeme Talepleri", icon: Wallet, group: "Operasyon", badge: (b) => (b.payouts ? { value: b.payouts, tone: "amber" } : null) },
  { id: "financials", label: "Finans", icon: DollarSign, group: "Operasyon" },
]
export const ADMIN_TAB_IDS = ADMIN_TABS.map((t) => t.id)
export const ADMIN_GROUPS = ["Genel", "Moderasyon", "Topluluk", "Operasyon"] as const

export const BADGE_REFRESH_EVENT = "aya:admin-badges"
export const refreshAdminBadges = () => typeof window !== "undefined" && window.dispatchEvent(new Event(BADGE_REFRESH_EVENT))

export const BADGE_TONE = { red: "bg-red-500 text-white", amber: "bg-amber-500 text-white", green: "bg-green-500 text-white" } as const

/** Numbers next to the tabs; refreshed every minute and whenever something in the panel changes. */
export function useAdminBadges(enabled = true): AdminBadges | null {
  const [b, setB] = useState<AdminBadges | null>(null)
  useEffect(() => {
    if (!enabled) return
    let alive = true
    const load = () =>
      fetch("/api/admin/badges", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => alive && d && setB(d))
        .catch(() => {})
    load()
    const t = setInterval(load, 60_000)
    window.addEventListener(BADGE_REFRESH_EVENT, load)
    return () => {
      alive = false
      clearInterval(t)
      window.removeEventListener(BADGE_REFRESH_EVENT, load)
    }
  }, [enabled])
  return b
}


