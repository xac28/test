"use client"

import { useEffect } from "react"
import { Radio, Video } from "lucide-react"
import { Button, Card, Empty, ErrorNote, Pill, SectionTitle, Spinner, api, ago, fmtDateTime, useConfirm, useLoader, useToast } from "./ui"

interface Resp {
  broadcasts: { id: string; roomName: string; title: string; startedAt: string; viewerCount: number; teacher: { id: string; name: string | null }; workshop: { slug: string; title: string } | null }[]
  lessons: { id: string; startTime: string; endTime: string; student: string | null; teacher: string | null }[]
}

export function RoomsTab({ onChanged }: { onChanged: () => void }) {
  const { data, error, loading, reload } = useLoader<Resp>(() => api("/api/admin/live-rooms"), [])
  const { ask, dialog } = useConfirm()
  const { show, toast } = useToast()

  // the picture of "who is on air" must stay fresh without a page reload
  useEffect(() => {
    const t = setInterval(reload, 15_000)
    return () => clearInterval(t)
  }, [reload])

  return (
    <div className="space-y-6" data-testid="tab-rooms">
      <SectionTitle title="Canlı oturumlar" hint="Şu an yayında olan eğitmenler ve devam eden birebir dersler. Liste 15 saniyede bir yenilenir." />
      {error && <ErrorNote message={error} onRetry={reload} />}
      {!data && loading ? <Spinner /> : data ? (
        <>
          <section className="space-y-3">
            <h3 className="text-xs font-bold text-sage-500 flex items-center gap-2"><Radio size={14} /> Canlı yayınlar ({data.broadcasts.length})</h3>
            {data.broadcasts.length === 0 ? <Empty icon={<Radio size={28} />}>Şu an yayın yok.</Empty> : (
              <div className="grid md:grid-cols-2 gap-3">
                {data.broadcasts.map((b) => (
                  <Card key={b.id} className="p-4" data-testid="broadcast-card">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{b.title}</p>
                        <p className="text-sm text-sage-500">{b.teacher.name} · {b.viewerCount} izleyici · {ago(b.startedAt)} başladı</p>
                        {b.workshop && <p className="text-xs text-sage-500 mt-0.5">Atölye: {b.workshop.title}</p>}
                      </div>
                      <Pill tone="red">Canlı</Pill>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <a href={`/live/${b.id}`} target="_blank" rel="noreferrer" className="px-3.5 py-2 rounded-lg text-sm font-semibold bg-paper border border-rule hover:bg-sage-50">İzle</a>
                      <Button tone="danger" data-testid="close-room" onClick={() => ask({
                        title: "Yayını kapat", description: `“${b.title}” hemen sonlandırılır ve tüm izleyicilerin bağlantısı kesilir.`, confirmLabel: "Yayını kapat", tone: "danger",
                        input: { label: "Neden (denetim kaydına yazılır)", min: 3 },
                        onConfirm: async (reason) => { await api(`/api/admin/live-rooms/${b.id}/close`, { method: "POST", json: { reason } }); show("Yayın kapatıldı"); reload(); onChanged() },
                      })}>Kapat</Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </section>
          <section className="space-y-3">
            <h3 className="text-xs font-bold text-sage-500 flex items-center gap-2"><Video size={14} /> Devam eden birebir dersler ({data.lessons.length})</h3>
            {data.lessons.length === 0 ? <Empty icon={<Video size={28} />}>Şu an devam eden ders yok.</Empty> : (
              <div className="grid md:grid-cols-2 gap-3">
                {data.lessons.map((l) => (
                  <Card key={l.id} className="p-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{l.teacher} ↔ {l.student}</p>
                      <p className="text-xs text-sage-500">{fmtDateTime(l.startTime)} – {fmtDateTime(l.endTime)}</p>
                    </div>
                    <a href={`/room?bookingId=${l.id}`} target="_blank" rel="noreferrer" className="px-3.5 py-2 rounded-lg text-sm font-semibold bg-paper border border-rule hover:bg-sage-50">İzle</a>
                  </Card>
                ))}
              </div>
            )}
          </section>
        </>
      ) : null}
      {dialog}{toast}
    </div>
  )
}
