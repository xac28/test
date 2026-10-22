"use client"

import { useState } from "react"
import { Star, Trash2, Undo2 } from "lucide-react"
import { Button, Empty, ErrorNote, Pager, Pill, SearchBox, SectionTitle, Segmented, Spinner, Table, ago, api, fmtDateTime, useConfirm, useDebounced, useLoader, useToast } from "./ui"

/** Teacher reviews written by students: hide abusive ones (they stop counting toward the rating), restore mistakes. */
export function ReviewsTab({ onChanged, onOpenUser }: { onChanged: () => void; onOpenUser: (id: string) => void }) {
  const [status, setStatus] = useState("VISIBLE")
  const [reported, setReported] = useState(false)
  const [q, setQ] = useState("")
  const [page, setPage] = useState(1)
  const dq = useDebounced(q)
  const { show, toast } = useToast()
  const { ask, dialog } = useConfirm()
  const { data, error, loading, reload } = useLoader<any>(
    () => api(`/api/admin/reviews?${new URLSearchParams({ status, page: String(page), ...(dq && { q: dq }), ...(reported && { reported: "1" }) })}`),
    [status, dq, page, reported],
  )
  const done = (m: string) => { show(m); reload(); onChanged() }
  const c = data?.statusCounts
  return (
    <div className="space-y-4" data-testid="tab-reviews">
      <SectionTitle title="Değerlendirmeler" hint="Öğrencilerin eğitmenlere yazdığı yorumlar. Kaldırılan değerlendirme puan ortalamasından ve profilden çıkar; sahibine nedeni bildirilir." />
      <div className="flex flex-wrap items-center gap-3">
        <Segmented testid="review-status" value={status} onChange={(v) => { setStatus(v); setPage(1) }} options={[{ id: "VISIBLE", label: "Yayında", count: c?.VISIBLE }, { id: "REMOVED", label: "Kaldırılan", count: c?.REMOVED }, { id: "all", label: "Tümü" }]} />
        <label className="inline-flex items-center gap-1.5 text-sm text-sage-700"><input type="checkbox" checked={reported} onChange={(e) => { setReported(e.target.checked); setPage(1) }} data-testid="review-reported" /> Yalnızca bildirilenler</label>
        <SearchBox value={q} onChange={(v) => { setQ(v); setPage(1) }} placeholder="Yorum, öğrenci veya eğitmen…" testid="review-search" />
      </div>
      {error && <ErrorNote message={error} onRetry={reload} />}
      {!data && loading ? <Spinner /> : data && data.reviews.length === 0 ? <Empty icon={<Star size={32} />}>Bu filtreyle eşleşen değerlendirme yok.</Empty> : data ? (
        <div className={loading ? "opacity-60" : ""}>
          <Table head={["Puan", "Yorum", "Öğrenci → Eğitmen", "Zaman", ""]}>
            {data.reviews.map((r: any) => (
              <tr key={r.id} data-testid="review-row" className="align-top">
                <td className="px-4 py-3 whitespace-nowrap font-semibold">{r.rating} <span className="text-yellow-600">★</span></td>
                <td className="px-4 py-3 max-w-sm">
                  <p className="break-words whitespace-pre-line">{r.comment || <span className="text-sage-500">(yazılı yorum yok)</span>}</p>
                  <span className="flex flex-wrap gap-1 mt-1">{r.openReports > 0 && <Pill tone="red">{r.openReports} açık rapor</Pill>}{r.status === "REMOVED" && <Pill tone="red">Kaldırıldı: {r.removedReason}</Pill>}</span>
                </td>
                <td className="px-4 py-3"><button className="underline" onClick={() => onOpenUser(r.student.id)}>{r.student.name ?? r.student.email}</button> <span className="text-sage-500">→</span> {r.teacher.name}</td>
                <td className="px-4 py-3 whitespace-nowrap text-xs text-sage-500" title={fmtDateTime(r.createdAt)}>{ago(r.createdAt)}</td>
                <td className="px-4 py-3 text-right">
                  {r.status === "VISIBLE" ? (
                    <Button data-testid="review-remove" onClick={() => ask({
                      title: "Değerlendirmeyi kaldır", description: "Puan ortalamasından ve profilden çıkar; öğrenciye nedeniyle birlikte bildirim gider.", confirmLabel: "Kaldır", tone: "danger",
                      input: { label: "Neden (öğrenciye gösterilir)", min: 3, multiline: true },
                      onConfirm: async (reason) => { await api(`/api/admin/reviews/${r.id}`, { method: "POST", json: { action: "remove", reason } }); done("Değerlendirme kaldırıldı") },
                    })}><Trash2 size={14} /> Kaldır</Button>
                  ) : (
                    <Button data-testid="review-restore" onClick={async () => { try { await api(`/api/admin/reviews/${r.id}`, { method: "POST", json: { action: "restore" } }); done("Geri yüklendi") } catch (e: any) { show(e.message) } }}><Undo2 size={14} /> Geri yükle</Button>
                  )}
                </td>
              </tr>
            ))}
          </Table>
          <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
        </div>
      ) : null}
      {dialog}
      {toast}
    </div>
  )
}
