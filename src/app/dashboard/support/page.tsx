"use client"

import { useEffect, useState } from "react"
import { LifeBuoy } from "lucide-react"
import { SupportChat } from "@/components/support-chat"
import { timeAgo } from "@/components/notification-bell"

interface T { id: string; subject: string; status: string; createdAt: string; lastMessageAt: string; rating: number | null }

export default function SupportPage() {
  const [tickets, setTickets] = useState<T[]>([])
  useEffect(() => {
    fetch("/api/support", { cache: "no-store" }).then((r) => (r.ok ? r.json() : { tickets: [] })).then((d) => setTickets(d.tickets ?? [])).catch(() => {})
  }, [])
  const past = tickets.filter((t) => t.status === "CLOSED")
  return (
    <div className="max-w-3xl space-y-8">
      <header>
        <h1 className="font-display text-3xl md:text-[2.5rem] leading-[1.1] text-ink flex items-center gap-3"><LifeBuoy size={30} /> Canlı destek</h1>
        <p className="text-sage-600 mt-2">Bir sorunun mu var? Yaz, ekibimiz buradan yanıtlasın. Hızlı cevaplar için sağ alttaki <strong>Rehber</strong>'e de sorabilirsin.</p>
      </header>
      <div className="bg-paper border border-rule rounded-xl overflow-hidden flex flex-col h-[28rem]">
        <SupportChat className="flex-1" />
      </div>
      {past.length > 0 && (
        <section>
          <h2 className="text-[15px] font-semibold text-ink mb-3">Geçmiş görüşmeler</h2>
          <ul className="divide-y divide-rule border border-rule rounded-xl bg-paper" data-testid="support-history">
            {past.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                <span className="truncate">{t.subject}</span>
                <span className="text-xs text-sage-500 shrink-0">{t.rating ? `${"★".repeat(t.rating)} · ` : ""}{timeAgo(t.lastMessageAt)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
