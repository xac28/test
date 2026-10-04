"use client"

import { useState } from "react"
import { History } from "lucide-react"
import { DownloadCsv, Empty, ErrorNote, Pager, Pill, SearchBox, SectionTitle, Select, Spinner, Table, api, fmtDateTime, useDebounced, useLoader } from "./ui"

interface Resp {
  logs: { id: string; action: string; targetId: string | null; reason: string | null; createdAt: string; actor: string }[]
  total: number; page: number; pageSize: number; actions: { action: string; count: number }[]
}

export function AuditTab() {
  const [q, setQ] = useState("")
  const [action, setAction] = useState("")
  const [page, setPage] = useState(1)
  const dq = useDebounced(q)
  const qs = new URLSearchParams({ ...(dq && { q: dq }), ...(action && { action }) })
  const { data, error, loading, reload } = useLoader<Resp>(() => api(`/api/admin/audit?${qs}&page=${page}`), [dq, action, page])

  return (
    <div className="space-y-5" data-testid="tab-audit">
      <SectionTitle title="Denetim kayıtları" hint="Yönetici ve sistem işlemlerinin değiştirilemez geçmişi. Kim, neyi, ne zaman ve neden yaptı." actions={<DownloadCsv href={`/api/admin/audit?${qs}&format=csv`} />} />
      <div className="flex flex-wrap gap-3">
        <SearchBox value={q} onChange={(v) => { setQ(v); setPage(1) }} placeholder="Ayrıntı, hedef no veya yönetici adı…" testid="audit-search" />
        <Select label="İşlem türü" value={action} onChange={(v) => { setAction(v); setPage(1) }} testid="audit-action">
          <option value="">Tüm işlemler</option>
          {data?.actions.map((a) => <option key={a.action} value={a.action}>{a.action} ({a.count})</option>)}
        </Select>
      </div>
      {error && <ErrorNote message={error} onRetry={reload} />}
      {!data && loading ? <Spinner /> : data && data.logs.length === 0 ? <Empty icon={<History size={32} />}>Kayıt bulunamadı.</Empty> : data ? (
        <div className={loading ? "opacity-60" : ""}>
          <Table head={["Zaman", "Yönetici", "İşlem", "Ayrıntı"]}>
            {data.logs.map((l) => (
              <tr key={l.id} data-testid="audit-row" className="align-top">
                <td className="px-4 py-3 whitespace-nowrap text-xs text-sage-500">{fmtDateTime(l.createdAt)}</td>
                <td className="px-4 py-3 whitespace-nowrap">{l.actor}</td>
                <td className="px-4 py-3"><Pill>{l.action}</Pill></td>
                <td className="px-4 py-3 text-sage-700 break-words max-w-md">{l.reason || "—"}{l.targetId && <p className="text-[11px] text-sage-400 font-mono">{l.targetId}</p>}</td>
              </tr>
            ))}
          </Table>
          <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
        </div>
      ) : null}
    </div>
  )
}
