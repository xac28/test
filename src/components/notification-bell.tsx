"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Bell, CheckCheck, Heart, Image as ImageIcon, MessageCircle, ShieldAlert, Flag, VolumeX } from "lucide-react"

export interface NotificationItem {
  id: string
  type: string
  title: string
  body: string | null
  href: string | null
  count: number
  read: boolean
  createdAt: string
}

export const NOTIFICATION_REFRESH = "aya:notifications"
export const refreshNotifications = () => typeof window !== "undefined" && window.dispatchEvent(new Event(NOTIFICATION_REFRESH))

export function NotificationIcon({ type }: { type: string }) {
  const cls = "shrink-0"
  switch (type) {
    case "POST_LIKE": return <Heart size={16} className={`${cls} text-clay-500`} />
    case "POST_COMMENT": return <MessageCircle size={16} className={`${cls} text-sage-600`} />
    case "POST_APPROVED": return <ImageIcon size={16} className={`${cls} text-emerald-600`} />
    case "POST_REMOVED": case "COMMENT_REMOVED": return <ShieldAlert size={16} className={`${cls} text-clay-600`} />
    case "WARNING": return <ShieldAlert size={16} className={`${cls} text-amber-600`} />
    case "REPORT_UPDATE": return <Flag size={16} className={`${cls} text-sage-600`} />
    case "MUTED": return <VolumeX size={16} className={`${cls} text-clay-600`} />
    default: return <Bell size={16} className={`${cls} text-sage-500`} />
  }
}

export function timeAgo(d: string) {
  const s = Math.max(0, (Date.now() - new Date(d).getTime()) / 1000)
  if (s < 60) return "az önce"
  if (s < 3600) return `${Math.floor(s / 60)} dk`
  if (s < 86400) return `${Math.floor(s / 3600)} sa`
  return `${Math.floor(s / 86400)} g`
}

/** Bell in the navbar: unread count, the latest notifications, mark-all-read. Polls every 30 s. */
export function NotificationBell() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const [items, setItems] = useState<NotificationItem[] | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  const load = useCallback(async (withItems: boolean) => {
    try {
      const res = await fetch(`/api/notifications?limit=${withItems ? 8 : 1}`, { cache: "no-store" })
      if (!res.ok) return
      const d = await res.json()
      setUnread(d.unread)
      if (withItems) setItems(d.notifications)
    } catch {}
  }, [])

  useEffect(() => {
    load(false)
    const t = setInterval(() => load(false), 30_000)
    const onRefresh = () => load(open)
    window.addEventListener(NOTIFICATION_REFRESH, onRefresh)
    return () => {
      clearInterval(t)
      window.removeEventListener(NOTIFICATION_REFRESH, onRefresh)
    }
  }, [load, open])

  useEffect(() => {
    if (!open) return
    load(true)
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false)
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    document.addEventListener("mousedown", close)
    document.addEventListener("keydown", esc)
    return () => {
      document.removeEventListener("mousedown", close)
      document.removeEventListener("keydown", esc)
    }
  }, [open, load])

  const markAll = async () => {
    setItems((l) => l && l.map((n) => ({ ...n, read: true })))
    setUnread(0)
    await fetch("/api/notifications/read", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).catch(() => {})
  }

  const openItem = async (n: NotificationItem) => {
    setOpen(false)
    if (!n.read) {
      setUnread((u) => Math.max(0, u - 1))
      fetch("/api/notifications/read", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [n.id] }) }).catch(() => {})
    }
    if (n.href) router.push(n.href)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={unread ? `Bildirimler, ${unread} okunmamış` : "Bildirimler"}
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid="bell"
        className="relative w-10 h-10 flex items-center justify-center rounded-full border border-transparent hover:border-rule text-ink transition"
      >
        <Bell size={19} />
        {unread > 0 && (
          <span data-testid="bell-count" className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-accent text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div role="menu" data-testid="bell-menu" className="absolute right-[-3.5rem] sm:right-0 mt-2 w-[min(22rem,calc(100vw-1.5rem))] bg-paper border border-ink shadow-xl z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-rule">
            <p className="font-display text-lg">Bildirimler</p>
            <button onClick={markAll} disabled={!unread} className="text-xs font-semibold text-sage-600 hover:text-ink disabled:opacity-40 inline-flex items-center gap-1" data-testid="mark-all-read">
              <CheckCheck size={14} /> Hepsini okundu yap
            </button>
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {items === null ? (
              <p className="px-4 py-8 text-sm text-sage-500 text-center">Yükleniyor…</p>
            ) : items.length === 0 ? (
              <p className="px-4 py-8 text-sm text-sage-500 text-center" data-testid="bell-empty">Henüz bildirimin yok.</p>
            ) : (
              items.map((n) => (
                <button key={n.id} onClick={() => openItem(n)} data-testid="bell-item" className={`w-full text-left flex gap-3 px-4 py-3 border-b border-rule last:border-0 hover:bg-sage-100/60 ${n.read ? "" : "bg-clay-50/70"}`}>
                  <span className="mt-0.5"><NotificationIcon type={n.type} /></span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-sm leading-snug ${n.read ? "text-sage-700" : "font-semibold text-ink"}`}>{n.title}</span>
                    {n.body && <span className="block text-xs text-sage-600 mt-0.5 line-clamp-2">{n.body}</span>}
                    <span className="block text-[11px] text-sage-500 mt-1">{timeAgo(n.createdAt)}</span>
                  </span>
                  {!n.read && <span className="mt-1.5 w-2 h-2 rounded-full bg-accent shrink-0" aria-label="okunmadı" />}
                </button>
              ))
            )}
          </div>
          <Link href="/dashboard/notifications" onClick={() => setOpen(false)} className="block text-center text-sm font-semibold py-3 border-t border-rule hover:bg-sage-100/60">
            Tüm bildirimler
          </Link>
        </div>
      )}
    </div>
  )
}
