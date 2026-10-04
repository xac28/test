"use client"

import { useRouter } from "next/navigation"
import { CheckCheck, Loader2 } from "lucide-react"
import { NotificationIcon, NotificationItem, refreshNotifications, timeAgo } from "@/components/notification-bell"
import { useInfinite } from "@/components/community/parts"

export default function NotificationsPage() {
  const router = useRouter()
  const feed = useInfinite<NotificationItem>("/api/notifications?limit=20", [])
  const unread = feed.items?.filter((n) => !n.read).length ?? 0

  const markAll = async () => {
    feed.setItems((l) => l && l.map((n) => ({ ...n, read: true })))
    await fetch("/api/notifications/read", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).catch(() => {})
    refreshNotifications()
  }
  const open = async (n: NotificationItem) => {
    if (!n.read) {
      feed.setItems((l) => l && l.map((x) => (x.id === n.id ? { ...x, read: true } : x)))
      fetch("/api/notifications/read", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [n.id] }) }).then(refreshNotifications).catch(() => {})
    }
    if (n.href) router.push(n.href)
  }

  return (
    <div className="max-w-3xl space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-2">Hesabım</p>
          <h1 className="font-display text-4xl text-ink">Bildirimler</h1>
          <p className="text-sage-600 mt-2">Beğeniler, yorumlar, paylaşım onayları ve yönetimden gelen haberler.</p>
        </div>
        <button onClick={markAll} disabled={!unread} data-testid="mark-all-page" className="inline-flex items-center gap-2 px-4 py-2 min-h-[44px] border border-rule rounded-md text-sm font-medium disabled:opacity-40 hover:border-ink"><CheckCheck size={16} /> Hepsini okundu yap</button>
      </header>

      {feed.items === null ? (
        <Loader2 className="animate-spin text-sage-500" />
      ) : feed.error && feed.items.length === 0 ? (
        <p role="alert" className="text-clay-600">Bildirimler yüklenemedi. <button className="underline" onClick={feed.reload}>Tekrar dene</button></p>
      ) : feed.items.length === 0 ? (
        <p data-testid="no-notifications" className="text-sage-500 border border-dashed border-rule rounded-xl p-10 text-center">Henüz bildirimin yok. Topluluğa bir fotoğraf paylaştığında beğeni ve yorumlar burada görünür.</p>
      ) : (
        <>
          <ul className="bg-paper border border-rule rounded-xl divide-y divide-rule overflow-hidden" data-testid="notification-list">
            {feed.items.map((n) => (
              <li key={n.id}>
                <button onClick={() => open(n)} data-testid="notification-row" className={`w-full text-left flex gap-4 px-5 py-4 hover:bg-sage-100/60 ${n.read ? "" : "bg-clay-50/70"}`}>
                  <span className="mt-0.5"><NotificationIcon type={n.type} /></span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-sm ${n.read ? "text-sage-700" : "font-semibold text-ink"}`}>{n.title}</span>
                    {n.body && <span className="block text-sm text-sage-600 mt-0.5">{n.body}</span>}
                    <span className="block text-xs text-sage-500 mt-1">{timeAgo(n.createdAt)}</span>
                  </span>
                  {!n.read && <span className="mt-1.5 w-2 h-2 rounded-full bg-accent shrink-0" aria-label="okunmadı" />}
                </button>
              </li>
            ))}
          </ul>
          {feed.more && (
            <div className="flex justify-center">
              <button onClick={feed.loadMore} disabled={feed.loading} className="px-6 py-2.5 min-h-[44px] border border-ink rounded-md text-sm font-medium hover:bg-ink hover:text-cream transition-colors">Daha fazla</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
