"use client"

import { useState } from "react"
import { Calendar } from "lucide-react"
import { Button, DownloadCsv, Empty, ErrorNote, Pager, Pill, SearchBox, Segmented, SectionTitle, Select, Spinner, Table, api, fmtDateTime, fmtMoney, useConfirm, useDebounced, useLoader, useToast } from "./ui"

const TONE: Record<string, string> = { PENDING: "amber", CONFIRMED: "green", COMPLETED: "blue", CANCELLED: "gray" }
const LABEL: Record<string, string> = { PENDING: "Ödeme bekliyor", CONFIRMED: "Onaylı", COMPLETED: "Tamamlandı", CANCELLED: "İptal" }

interface Resp {
  bookings: { id: string; status: string; price: number; startTime: string; endTime: string; student: { id: string; name: string | null; email: string | null }; teacher: { id: string; userId: string; name: string | null } }[]
  total: number; page: number; pageSize: number; statusCounts: Record<string, number>
}

export function BookingsTab({ onOpenUser, onChanged }: { onOpenUser: (id: string) => void; onChanged: () => void }) {
  const [status, setStatus] = useState("all")
  const [when, setWhen] = useState("")
  const [q, setQ] = useState("")
  const [page, setPage] = useState(1)
  const dq = useDebounced(q)
  const { ask, dialog } = useConfirm()
  const { show, toast } = useToast()
  const qs = new URLSearchParams({ status, ...(when && { when }), ...(dq && { q: dq }) })
  const { data, error, loading, reload } = useLoader<Resp>(() => api(`/api/admin/bookings?${qs}&page=${page}`), [status, when, dq, page])
  const c = data?.statusCounts ?? {}

  return (
    <div className="space-y-5" data-testid="tab-bookings">
      <SectionTitle title="Rezervasyonlar" hint="Birebir dersler. Bir sorun olduğunda yönetici olarak iptal edebilirsiniz; iade ödeme sağlayıcıdan elle yapılır." actions={<DownloadCsv href={`/api/admin/bookings?${qs}&format=csv`} />} />
      <Segmented testid="booking-status" value={status} onChange={(v) => { setStatus(v); setPage(1) }} options={[
        { id: "all", label: "Tümü" },
        { id: "PENDING", label: "Ödeme bekliyor", count: c.PENDING },
        { id: "CONFIRMED", label: "Onaylı", count: c.CONFIRMED },
        { id: "COMPLETED", label: "Tamamlandı", count: c.COMPLETED },
        { id: "CANCELLED", label: "İptal", count: c.CANCELLED },
      ]} />
      <div className="flex flex-wrap gap-3">
        <SearchBox value={q} onChange={(v) => { setQ(v); setPage(1) }} placeholder="Öğrenci, eğitmen veya rezervasyon no…" testid="booking-search" />
        <Select label="Zaman" value={when} onChange={(v) => { setWhen(v); setPage(1) }}>
          <option value="">Tüm zamanlar</option>
          <option value="upcoming">Yaklaşan</option>
          <option value="past">Geçmiş</option>
        </Select>
      </div>
      {error && <ErrorNote message={error} onRetry={reload} />}
      {!data && loading ? <Spinner /> : data && data.bookings.length === 0 ? <Empty icon={<Calendar size={32} />}>Rezervasyon bulunamadı.</Empty> : data ? (
        <div className={loading ? "opacity-60" : ""}>
          <Table head={["Ders", "Öğrenci", "Eğitmen", "Ücret", "Durum", ""]}>
            {data.bookings.map((b) => (
              <tr key={b.id} data-testid="booking-row">
                <td className="px-4 py-3 whitespace-nowrap">{fmtDateTime(b.startTime)}<p className="text-xs text-sage-500 font-mono">{b.id.slice(-8).toUpperCase()}</p></td>
                <td className="px-4 py-3"><button className="underline-offset-2 hover:underline text-left" onClick={() => onOpenUser(b.student.id)}>{b.student.name ?? "—"}</button><p className="text-xs text-sage-500">{b.student.email}</p></td>
                <td className="px-4 py-3"><button className="underline-offset-2 hover:underline" onClick={() => onOpenUser(b.teacher.userId)}>{b.teacher.name ?? "—"}</button></td>
                <td className="px-4 py-3">{fmtMoney(b.price)}</td>
                <td className="px-4 py-3"><Pill tone={TONE[b.status]}>{LABEL[b.status]}</Pill></td>
                <td className="px-4 py-3 text-right">
                  {(b.status === "PENDING" || b.status === "CONFIRMED") && (
                    <Button tone="ghost" className="!text-red-600" data-testid="cancel-booking" onClick={() => ask({
                      title: "Rezervasyonu iptal et",
                      description: `${b.student.name ?? "Öğrenci"} ile ${b.teacher.name ?? "eğitmen"} arasındaki ${fmtDateTime(b.startTime)} dersi iptal edilir. Ücret iadesi ödeme sağlayıcıdan elle yapılmalıdır.`,
                      confirmLabel: "İptal et", tone: "danger", input: { label: "İptal nedeni", min: 3 },
                      onConfirm: async (reason) => { await api(`/api/admin/bookings/${b.id}/cancel`, { method: "POST", json: { reason } }); show("Rezervasyon iptal edildi"); reload(); onChanged() },
                    })}>İptal et</Button>
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
