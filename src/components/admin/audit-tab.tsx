"use client"

import { Fragment, useEffect, useState } from "react"
import { Activity, AlertTriangle, ChevronDown, ChevronRight, History, Info, OctagonAlert, RefreshCw } from "lucide-react"
import { auditLabel } from "@/lib/audit-labels"
import { Card, DownloadCsv, Empty, ErrorNote, Pager, Pill, SearchBox, SectionTitle, Segmented, Select, Spinner, Stat, Table, ago, api, fmtDateTime, useDebounced, useLoader } from "./ui"

type View = "events" | "admin"

const LEVEL_TONE: Record<string, string> = { info: "blue", warn: "amber", error: "red" }
const LEVEL_TR: Record<string, string> = { info: "Bilgi", warn: "Uyarı", error: "Hata" }
export const TYPE_TR: Record<string, string> = {
  AUTH_LOGIN: "Giriş", AUTH_FAIL: "Başarısız giriş", AUTH_REGISTER: "Yeni üye", UPLOAD: "Yükleme", AI_UNKNOWN: "Rehber bilmedi", AI_FEEDBACK: "Rehber geri bildirimi",
  SUPPORT: "Canlı destek", PAYMENT: "Ödeme", LIVE: "Canlı yayın", SECURITY: "Güvenlik", API_ERROR: "Sistem hatası", SYSTEM: "Sistem",
}
const GROUP_TR: Record<string, string> = {
  REPORT: "Raporlar", POST: "Fotoğraflar", COMMENT: "Yorumlar", REVIEW: "Değerlendirmeler", SUPPORT: "Canlı destek", AI: "Yapay zeka", BAN: "Yasaklar", UNBAN: "Yasak kaldırma",
  BLOCKED: "Yasaklı kelimeler", UNMUTE: "Susturma", PAYOUT: "Ödemeler", CLOSE: "Yayın kapatma", REMOVE: "İçerik kaldırma",
}

/** "Günlükler": what the system did (sign-ins, uploads, guide gaps, errors) and what the admins did. */
export function AuditTab() {
  const [view, setView] = useState<View>("events")
  return (
    <div className="space-y-5" data-testid="tab-audit">
      <SectionTitle title="Günlükler" hint="Sistem olayları (girişler, yüklemeler, Rehber, destek, güvenlik) ve yönetici işlemlerinin değiştirilemez geçmişi: kim, neyi, ne zaman, neden yaptı." />
      <Segmented testid="log-view" value={view} onChange={setView} options={[{ id: "events", label: "Sistem olayları" }, { id: "admin", label: "Yönetici işlemleri" }]} />
      {view === "events" ? <Events /> : <AdminActions />}
    </div>
  )
}

function Bars({ hours }: { hours: { t: string; total: number; problems: number }[] }) {
  const max = Math.max(1, ...hours.map((h) => h.total))
  return (
    <div className="flex items-end gap-[3px] h-16" role="img" aria-label="Son 24 saatte saat başına olay sayısı" data-testid="log-chart">
      {hours.map((h) => (
        <div key={h.t} title={`${new Date(h.t).getHours()}:00 · ${h.total} olay${h.problems ? `, ${h.problems} sorun` : ""}`} className="flex-1 flex flex-col justify-end h-full">
          <div className="w-full rounded-sm bg-sage-300" style={{ height: `${(h.total / max) * 100}%`, minHeight: h.total ? 3 : 1 }}>
            {h.problems > 0 && <div className="w-full rounded-sm bg-red-500" style={{ height: `${(h.problems / h.total) * 100}%` }} />}
          </div>
        </div>
      ))}
    </div>
  )
}

function Events() {
  const [q, setQ] = useState("")
  const [type, setType] = useState("")
  const [level, setLevel] = useState("")
  const [range, setRange] = useState("24h")
  const [page, setPage] = useState(1)
  const [live, setLive] = useState(false)
  const [open, setOpen] = useState<string | null>(null)
  const dq = useDebounced(q)
  const qs = new URLSearchParams({ range, ...(dq && { q: dq }), ...(type && { type }), ...(level && { level }) })
  const { data, error, loading, reload } = useLoader<any>(() => api(`/api/admin/logs?${qs}&page=${page}`), [dq, type, level, range, page])
  useEffect(() => {
    if (!live) return
    const t = setInterval(reload, 5000)
    return () => clearInterval(t)
  }, [live, reload])
  const s = data?.stats

  return (
    <div className="space-y-4" data-testid="log-events">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Son 24 saat olay" value={s ? (s.byLevel.info ?? 0) + (s.byLevel.warn ?? 0) + (s.byLevel.error ?? 0) : "—"} />
        <Stat label="Uyarı" value={s?.byLevel.warn ?? 0} tone={s?.byLevel.warn ? "amber" : undefined} />
        <Stat label="Hata" value={s?.byLevel.error ?? 0} tone={s?.byLevel.error ? "red" : undefined} />
        <Card className="p-3">{s ? <Bars hours={s.hours} /> : <Spinner />}<p className="text-xs text-sage-500 mt-1">Saat başına olay (kırmızı: uyarı/hata)</p></Card>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SearchBox value={q} onChange={(v) => { setQ(v); setPage(1) }} placeholder="Olay, kullanıcı, e-posta veya IP…" testid="log-search" />
        <Select label="Tür" value={type} onChange={(v) => { setType(v); setPage(1) }} testid="log-type">
          <option value="">Tüm türler</option>
          {data?.types.map((t: any) => <option key={t.type} value={t.type}>{TYPE_TR[t.type] ?? t.type} ({t.count})</option>)}
        </Select>
        <Select label="Seviye" value={level} onChange={(v) => { setLevel(v); setPage(1) }} testid="log-level">
          <option value="">Tüm seviyeler</option><option value="info">Bilgi</option><option value="warn">Uyarı</option><option value="error">Hata</option>
        </Select>
        <Select label="Dönem" value={range} onChange={(v) => { setRange(v); setPage(1) }} testid="log-range">
          <option value="1h">Son 1 saat</option><option value="24h">Son 24 saat</option><option value="7d">Son 7 gün</option><option value="30d">Son 30 gün</option><option value="all">Tümü</option>
        </Select>
        <label className="inline-flex items-center gap-1.5 text-sm text-sage-700"><input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} data-testid="log-live" /> <RefreshCw size={13} className={live ? "animate-spin" : ""} /> Canlı izle</label>
        <DownloadCsv href={`/api/admin/logs?${qs}&format=csv`} />
      </div>
      {error && <ErrorNote message={error} onRetry={reload} />}
      {!data && loading ? <Spinner /> : data && data.events.length === 0 ? <Empty icon={<Activity size={32} />}>Bu filtreyle olay bulunamadı.</Empty> : data ? (
        <div className={loading ? "opacity-60" : ""}>
          <Table head={["", "Zaman", "Tür", "Olay", "Kullanıcı", "IP"]}>
            {data.events.map((e: any) => (
              <Fragment key={e.id}>
                <tr data-testid="log-row" onClick={() => setOpen(open === e.id ? null : e.id)} className="align-top cursor-pointer hover:bg-sage-50">
                  <td className="pl-4 py-3 w-6 text-sage-400">{e.meta ? (open === e.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : null}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-xs text-sage-500" title={fmtDateTime(e.createdAt)}>{fmtDateTime(e.createdAt)}</td>
                  <td className="px-4 py-3 whitespace-nowrap"><Pill tone={LEVEL_TONE[e.level]} title={LEVEL_TR[e.level]}>{e.level === "error" ? <OctagonAlert size={11} /> : e.level === "warn" ? <AlertTriangle size={11} /> : <Info size={11} />} {TYPE_TR[e.type] ?? e.type}</Pill></td>
                  <td className="px-4 py-3 break-words max-w-md">{e.message}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-xs">{e.user ? (e.user.name ?? e.user.email ?? e.user.id.slice(-6)) : "—"}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-xs font-mono text-sage-500">{e.ip ?? "—"}</td>
                </tr>
                {open === e.id && e.meta && (
                  <tr><td colSpan={6} className="px-6 pb-3 bg-sage-50"><pre className="text-xs font-mono whitespace-pre-wrap break-all text-sage-700" data-testid="log-meta">{JSON.stringify(e.meta, null, 2)}</pre></td></tr>
                )}
              </Fragment>
            ))}
          </Table>
          <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
        </div>
      ) : null}
    </div>
  )
}

function AdminActions() {
  const [q, setQ] = useState("")
  const [action, setAction] = useState("")
  const [prefix, setPrefix] = useState("")
  const [range, setRange] = useState("")
  const [page, setPage] = useState(1)
  const dq = useDebounced(q)
  const qs = new URLSearchParams({ ...(dq && { q: dq }), ...(action && { action }), ...(prefix && !action && { prefix }), ...(range && { range }) })
  const { data, error, loading, reload } = useLoader<any>(() => api(`/api/admin/audit?${qs}&page=${page}`), [dq, action, prefix, range, page])
  return (
    <div className="space-y-4" data-testid="log-admin">
      <div className="flex flex-wrap gap-3">
        <SearchBox value={q} onChange={(v) => { setQ(v); setPage(1) }} placeholder="Ayrıntı, hedef no veya yönetici adı…" testid="audit-search" />
        <Select label="Konu" value={prefix} onChange={(v) => { setPrefix(v); setAction(""); setPage(1) }} testid="audit-group">
          <option value="">Tüm konular</option>
          {Object.entries(GROUP_TR).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </Select>
        <Select label="İşlem türü" value={action} onChange={(v) => { setAction(v); setPage(1) }} testid="audit-action">
          <option value="">Tüm işlemler</option>
          {data?.actions.map((a: any) => <option key={a.action} value={a.action}>{a.action} ({a.count})</option>)}
        </Select>
        <Select label="Dönem" value={range} onChange={(v) => { setRange(v); setPage(1) }} testid="audit-range">
          <option value="">Tüm zamanlar</option><option value="24h">Son 24 saat</option><option value="7d">Son 7 gün</option><option value="30d">Son 30 gün</option>
        </Select>
        <DownloadCsv href={`/api/admin/audit?${qs}&format=csv`} />
      </div>
      {error && <ErrorNote message={error} onRetry={reload} />}
      {!data && loading ? <Spinner /> : data && data.logs.length === 0 ? <Empty icon={<History size={32} />}>Kayıt bulunamadı.</Empty> : data ? (
        <div className={loading ? "opacity-60" : ""}>
          <Table head={["Zaman", "Yönetici", "İşlem", "Ayrıntı"]}>
            {data.logs.map((l: any) => (
              <tr key={l.id} data-testid="audit-row" className="align-top">
                <td className="px-4 py-3 whitespace-nowrap text-xs text-sage-500" title={fmtDateTime(l.createdAt)}>{fmtDateTime(l.createdAt)}<p className="text-xs">{ago(l.createdAt)}</p></td>
                <td className="px-4 py-3 whitespace-nowrap">{l.actor}{l.actorEmail && <p className="text-xs text-sage-500">{l.actorEmail}</p>}</td>
                <td className="px-4 py-3"><Pill title={l.action}>{auditLabel(l.action)}</Pill><p className="text-xs text-sage-400 font-mono mt-0.5">{l.action}</p></td>
                <td className="px-4 py-3 text-sage-700 break-words max-w-md">{l.reason || "—"}{l.targetId && <p className="text-xs text-sage-500 font-mono">{l.targetId}</p>}</td>
              </tr>
            ))}
          </Table>
          <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
        </div>
      ) : null}
    </div>
  )
}
