"use client"

import { useState } from "react"
import { Sparkles } from "lucide-react"
import { Button, Empty, ErrorNote, Pager, Pill, SearchBox, Segmented, SectionTitle, Spinner, Table, api, fmtDateTime, useConfirm, useDebounced, useLoader, useToast } from "./ui"

const TONE: Record<string, string> = { PUBLISHED: "green", DRAFT: "gray", CANCELLED: "red" }
const LABEL: Record<string, string> = { PUBLISHED: "Yayında", DRAFT: "Taslak", CANCELLED: "İptal" }

interface Resp {
  workshops: { id: string; slug: string; title: string; status: string; mode: string; startsAt: string | null; priceUsd: number; capacity: number; enrollments: number; openReports: number; teacher: { id: string; name: string | null } }[]
  total: number; page: number; pageSize: number
}

export function WorkshopsTab({ onOpenUser, onChanged }: { onOpenUser: (id: string) => void; onChanged: () => void }) {
  const [status, setStatus] = useState("all")
  const [q, setQ] = useState("")
  const [page, setPage] = useState(1)
  const dq = useDebounced(q)
  const { ask, dialog } = useConfirm()
  const { show, toast } = useToast()
  const { data, error, loading, reload } = useLoader<Resp>(() => api(`/api/admin/workshops?status=${status}&q=${encodeURIComponent(dq)}&page=${page}`), [status, dq, page])

  return (
    <div className="space-y-5" data-testid="tab-workshops">
      <SectionTitle title="Atölyeler" hint="Eğitmenlerin yayınladığı atölyeler. Kurallara aykırı olanı yayından kaldırabilirsiniz (eğitmen düzeltip yeniden yayınlayabilir)." />
      <div className="flex flex-wrap items-center gap-3">
        <SearchBox value={q} onChange={(v) => { setQ(v); setPage(1) }} placeholder="Başlık veya eğitmen…" testid="workshop-search" />
        <Segmented value={status} onChange={(v) => { setStatus(v); setPage(1) }} options={[{ id: "all", label: "Tümü" }, { id: "PUBLISHED", label: "Yayında" }, { id: "DRAFT", label: "Taslak" }, { id: "CANCELLED", label: "İptal" }]} />
      </div>
      {error && <ErrorNote message={error} onRetry={reload} />}
      {!data && loading ? <Spinner /> : data && data.workshops.length === 0 ? <Empty icon={<Sparkles size={32} />}>Atölye yok.</Empty> : data ? (
        <div className={loading ? "opacity-60" : ""}>
          <Table head={["Atölye", "Eğitmen", "Tarih", "Kayıt", "Rapor", "Durum", ""]}>
            {data.workshops.map((w) => (
              <tr key={w.id} data-testid="workshop-row">
                <td className="px-4 py-3 max-w-xs"><a href={`/atolyeler/${w.slug}`} target="_blank" rel="noreferrer" className="font-medium hover:underline">{w.title}</a><p className="text-xs text-sage-500">{w.mode === "LIVE" ? "Canlı" : "Kayıtlı"} · {w.priceUsd > 0 ? `$${w.priceUsd}` : "Ücretsiz"}</p></td>
                <td className="px-4 py-3"><button className="hover:underline" onClick={() => onOpenUser(w.teacher.id)}>{w.teacher.name}</button></td>
                <td className="px-4 py-3 whitespace-nowrap text-xs text-sage-500">{w.startsAt ? fmtDateTime(w.startsAt) : "—"}</td>
                <td className="px-4 py-3">{w.enrollments}{w.mode === "LIVE" && <span className="text-sage-500"> / {w.capacity}</span>}</td>
                <td className="px-4 py-3">{w.openReports > 0 ? <Pill tone="orange">{w.openReports} açık</Pill> : <span className="text-sage-300">—</span>}</td>
                <td className="px-4 py-3"><Pill tone={TONE[w.status]}>{LABEL[w.status]}</Pill></td>
                <td className="px-4 py-3 text-right">
                  {w.status === "PUBLISHED" && (
                    <Button tone="ghost" className="!text-red-600" data-testid="unpublish-workshop" onClick={() => ask({
                      title: "Atölyeyi yayından kaldır", description: `“${w.title}” taslağa alınır ve listelerden kalkar. Mevcut kayıtlar silinmez.`,
                      confirmLabel: "Yayından kaldır", tone: "danger", input: { label: "Neden", min: 3 },
                      onConfirm: async (reason) => { await api(`/api/admin/workshops/${w.id}/unpublish`, { method: "POST", json: { reason } }); show("Atölye yayından kaldırıldı"); reload(); onChanged() },
                    })}>Yayından kaldır</Button>
                  )}
                </td>
              </tr>
            ))}
          </Table>
          <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
        </div>
      ) : null}
      {dialog}{toast}
    </div>
  )
}
