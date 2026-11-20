"use client"

import { useEffect } from "react"
import Link from "next/link"
import { Eye, Flag, Radio, ShieldAlert, Users } from "lucide-react"
import { Button, Card, Empty, ErrorNote, Pill, SectionTitle, Spinner, api, ago, useConfirm, useLoader, useToast } from "./ui"
import { TeacherBadge } from "@/components/teacher-badge"

interface Item {
  id: string
  title: string
  startedAt: string
  viewerCount: number
  supervised: boolean
  openReports: number
  violations24h: number
  teacher: { id: string; name: string | null; trial: boolean }
  workshop: { slug: string; title: string } | null
}

/** "Canlı İzleme": everything on air, trial-phase (supervised) broadcasts first. Officials watch unseen from here. */
export function MonitorTab({ onChanged }: { onChanged: () => void }) {
  const { data, error, loading, reload } = useLoader<{ broadcasts: Item[]; supervisedCount: number }>(() => api("/api/admin/live-monitor"), [])
  const { ask, dialog } = useConfirm()
  const { show, toast } = useToast()

  useEffect(() => {
    const t = setInterval(reload, 10_000)
    return () => clearInterval(t)
  }, [reload])

  return (
    <div className="space-y-6" data-testid="tab-monitor">
      <SectionTitle title="Canlı izleme" hint="Deneme sürecindeki öğretmenlerin yayınları üstte görünür. “Gizli izle” ile yayını izleyici listesinde görünmeden izler, öğretmene ya da odaya mesaj gönderir, sohbeti kısıtlar, yayını kapatır ve öğretmeni onaylarsınız. Her izleme denetim kaydına yazılır." />
      {error && <ErrorNote message={error} onRetry={reload} />}
      {!data && loading ? <Spinner /> : data ? (
        data.broadcasts.length === 0 ? <Empty icon={<Radio size={28} />}>Şu an yayın yok. Bir deneme öğretmeni yayına başladığında burada ve zil bildiriminde görünür.</Empty> : (
          <div className="grid lg:grid-cols-2 gap-3">
            {data.broadcasts.map((b) => (
              <Card key={b.id} className={`p-4 ${b.supervised ? "border-saffron-300 bg-saffron-100/40" : ""}`} data-testid="monitor-card" data-supervised={b.supervised ? "1" : "0"}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{b.title}</p>
                    <p className="text-sm text-sage-600 flex flex-wrap items-center gap-x-2 gap-y-1 mt-0.5">{b.teacher.name} <TeacherBadge trial={b.teacher.trial} size="sm" /></p>
                    <p className="text-xs text-sage-500 mt-1 flex flex-wrap items-center gap-3">
                      <span className="inline-flex items-center gap-1"><Users size={12} /> {b.viewerCount} izleyici</span>
                      <span>{ago(b.startedAt)} başladı</span>
                      {b.openReports > 0 && <span className="inline-flex items-center gap-1 text-red-600 font-semibold"><Flag size={12} /> {b.openReports} açık rapor</span>}
                      {b.violations24h > 0 && <span className="inline-flex items-center gap-1 text-amber-700 font-semibold"><ShieldAlert size={12} /> {b.violations24h} politika ihlali (24 sa)</span>}
                    </p>
                  </div>
                  <Pill tone={b.supervised ? "amber" : "red"}>{b.supervised ? "Denetimli" : "Canlı"}</Pill>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  <Link href={`/admin/izle/${b.id}`} data-testid="monitor-watch" className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold bg-ink text-cream hover:bg-sage-800"><Eye size={15} /> Gizli izle</Link>
                  <Button tone="danger" data-testid="monitor-close" onClick={() => ask({
                    title: "Yayını kapat", description: `“${b.title}” hemen sonlandırılır ve tüm izleyicilerin bağlantısı kesilir.`, confirmLabel: "Yayını kapat", tone: "danger",
                    input: { label: "Neden (denetim kaydına yazılır)", min: 3 },
                    onConfirm: async (reason) => { await api(`/api/admin/live-rooms/${b.id}/close`, { method: "POST", json: { reason } }); show("Yayın kapatıldı"); reload(); onChanged() },
                  })}>Kapat</Button>
                </div>
              </Card>
            ))}
          </div>
        )
      ) : null}
      {dialog}
      {toast}
    </div>
  )
}
