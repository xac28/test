"use client"

import { useState } from "react"
import { Film } from "lucide-react"
import { Button, Card, Empty, ErrorNote, Pager, Pill, Segmented, SectionTitle, Spinner, Table, api, fmtBytes, fmtDateTime, useConfirm, useLoader, useToast } from "./ui"

const TONE: Record<string, string> = { READY: "green", RECORDING: "blue", FAILED: "red", EXPIRED: "gray" }
const LABEL: Record<string, string> = { READY: "Hazır", RECORDING: "Kaydediliyor", FAILED: "Başarısız", EXPIRED: "Silindi / süresi doldu" }

interface Resp {
  recordings: { id: string; roomName: string; status: string; sizeBytes: number; durationSec: number | null; startedAt: string; expiresAt: string; deletedAt: string | null; kind: string; teacher: string | null; student: string | null }[]
  total: number; page: number; pageSize: number; storage: { files: number; bytes: number }
}

const dur = (s: number | null) => (s ? `${Math.floor(s / 60)} dk ${s % 60} sn` : "—")

export function RecordingsTab() {
  const [status, setStatus] = useState("all")
  const [page, setPage] = useState(1)
  const { ask, dialog } = useConfirm()
  const { show, toast } = useToast()
  const { data, error, loading, reload } = useLoader<Resp>(() => api(`/api/admin/recordings?status=${status}&page=${page}`), [status, page])

  return (
    <div className="space-y-5" data-testid="tab-recordings">
      <SectionTitle title="Ders kayıtları" hint="Yalnızca üst bilgi gösterilir: yönetici kayıtları izleyemez veya indiremez (gizlilik). Kurallara aykırı bir kaydı kalıcı olarak silebilirsiniz. Kayıtlar 30 gün sonra kendiliğinden silinir." />
      {data && <Card className="p-4 text-sm flex gap-6"><span><strong>{data.storage.files}</strong> dosya</span><span><strong>{fmtBytes(data.storage.bytes)}</strong> kullanılan alan</span></Card>}
      <Segmented value={status} onChange={(v) => { setStatus(v); setPage(1) }} options={[{ id: "all", label: "Tümü" }, { id: "READY", label: "Hazır" }, { id: "RECORDING", label: "Kaydediliyor" }, { id: "FAILED", label: "Başarısız" }, { id: "EXPIRED", label: "Silinmiş" }]} />
      {error && <ErrorNote message={error} onRetry={reload} />}
      {!data && loading ? <Spinner /> : data && data.recordings.length === 0 ? <Empty icon={<Film size={32} />}>Kayıt yok.</Empty> : data ? (
        <div className={loading ? "opacity-60" : ""}>
          <Table head={["Tür", "Eğitmen / öğrenci", "Başlangıç", "Süre", "Boyut", "Silinme", "Durum", ""]}>
            {data.recordings.map((r) => (
              <tr key={r.id} data-testid="recording-row">
                <td className="px-4 py-3">{r.kind}<p className="text-[11px] text-sage-400 font-mono">{r.id.slice(-8).toUpperCase()}</p></td>
                <td className="px-4 py-3">{r.teacher ?? "—"}{r.student && <p className="text-xs text-sage-500">{r.student}</p>}</td>
                <td className="px-4 py-3 whitespace-nowrap text-xs">{fmtDateTime(r.startedAt)}</td>
                <td className="px-4 py-3 whitespace-nowrap text-xs">{dur(r.durationSec)}</td>
                <td className="px-4 py-3 whitespace-nowrap text-xs">{fmtBytes(r.sizeBytes)}</td>
                <td className="px-4 py-3 whitespace-nowrap text-xs text-sage-500">{fmtDateTime(r.deletedAt ?? r.expiresAt)}</td>
                <td className="px-4 py-3"><Pill tone={TONE[r.status]}>{LABEL[r.status]}</Pill></td>
                <td className="px-4 py-3 text-right">
                  {!r.deletedAt && (
                    <Button tone="ghost" className="!text-red-600" data-testid="delete-recording" onClick={() => ask({
                      title: "Kaydı kalıcı olarak sil", description: "Dosya sunucudan silinir; eğitmen ve öğrenci artık indiremez. Bu işlem geri alınamaz.",
                      confirmLabel: "Sil", tone: "danger", input: { label: "Silme nedeni", min: 3 },
                      onConfirm: async (reason) => { await api(`/api/admin/recordings/${r.id}`, { method: "DELETE", json: { reason } }); show("Kayıt silindi"); reload() },
                    })}>Sil</Button>
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
