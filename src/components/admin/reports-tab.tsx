"use client"

import { useState } from "react"
import { AlertTriangle, Ban, CheckCircle2, Eye, Flag, MessageSquareWarning, Radio, ShieldOff, Trash2, XCircle } from "lucide-react"
import {
  ADMIN_ACTION_LABEL_TR, CATEGORY_LABEL_TR, ESCALATION_THRESHOLD, ESCALATION_WINDOW_DAYS, PRIORITY_LABEL_TR, REPORT_CATEGORIES,
  STATUS_LABEL_TR, TARGET_LABEL_TR, AdminAction,
} from "@/lib/reports"
import {
  Button, Card, Drawer, DownloadCsv, Empty, ErrorNote, Pager, Pill, SearchBox, Segmented, Select, SectionTitle, Spinner, Table,
  ago, api, fmtDateTime, useConfirm, useDebounced, useLoader, useToast,
} from "./ui"

const PRIORITY_TONE: Record<string, string> = { URGENT: "red", HIGH: "orange", NORMAL: "gray", LOW: "blue" }
const STATUS_TONE: Record<string, string> = { PENDING: "amber", REVIEWED: "blue", RESOLVED: "green", DISMISSED: "gray" }

interface Row {
  id: string
  category: string
  targetType: string
  priority: string
  status: string
  reason: string
  createdAt: string
  reporter: { id: string; name: string | null; email: string | null } | null
  reported: { id: string; name: string | null; email: string | null; role: string; banned: boolean } | null
  reportedOpenCount: number
}
interface ListResp {
  reports: Row[]
  total: number
  page: number
  pageSize: number
  statusCounts: Record<string, number>
}

export function ReportsTab({ onChanged, onOpenUser }: { onChanged: () => void; onOpenUser: (id: string) => void }) {
  const [status, setStatus] = useState("open")
  const [category, setCategory] = useState("")
  const [priority, setPriority] = useState("")
  const [q, setQ] = useState("")
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [openId, setOpenId] = useState<string | null>(null)
  const dq = useDebounced(q)
  const { show, toast } = useToast()
  const { ask, dialog } = useConfirm()

  const qs = new URLSearchParams({ status, ...(category && { category }), ...(priority && { priority }), ...(dq && { q: dq }) })
  const { data, error, loading, reload } = useLoader<ListResp>(() => api(`/api/admin/reports?${qs}&page=${page}`), [status, category, priority, dq, page])

  const counts = data?.statusCounts
  const open = (counts?.PENDING ?? 0) + (counts?.REVIEWED ?? 0)
  const changed = () => {
    setSelected(new Set())
    reload()
    onChanged()
  }

  const bulk = (to: "REVIEWED" | "DISMISSED" | "RESOLVED") => {
    const ids = Array.from(selected)
    ask({
      title: `${ids.length} raporu "${STATUS_LABEL_TR[to]}" yap`,
      description: to === "REVIEWED" ? "Raporlar inceleniyor durumuna alınır." : "Raporlar kapatılır ve bildirenlere genel bir sonuç mesajı gönderilir. Eğitmen/kullanıcıya hiçbir yaptırım uygulanmaz.",
      confirmLabel: "Uygula",
      onConfirm: async () => {
        const r = await api("/api/admin/reports/bulk", { method: "POST", json: { ids, status: to } })
        show(`${r.updated} rapor güncellendi`)
        changed()
      },
    })
  }

  const rows = data?.reports ?? []
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id))

  return (
    <div className="space-y-5" data-testid="tab-reports">
      <SectionTitle
        title="Raporlar"
        hint="Kullanıcıların bildirdiği içerikler. Acil ve yüksek öncelikliler üstte; aynı kişiye 3 farklı kullanıcı rapor verirse otomatik acil olur."
        actions={<DownloadCsv href={`/api/admin/reports?${qs}&format=csv`} />}
      />

      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          testid="report-status"
          value={status}
          onChange={(v) => { setStatus(v); setPage(1) }}
          options={[
            { id: "open", label: "Açık", count: counts ? open : undefined },
            { id: "PENDING", label: "Yeni", count: counts?.PENDING },
            { id: "REVIEWED", label: "İnceleniyor", count: counts?.REVIEWED },
            { id: "RESOLVED", label: "Sonuçlandı", count: counts?.RESOLVED },
            { id: "DISMISSED", label: "Geçersiz", count: counts?.DISMISSED },
            { id: "all", label: "Tümü" },
          ]}
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SearchBox value={q} onChange={(v) => { setQ(v); setPage(1) }} placeholder="Ad, e-posta, açıklama veya rapor no…" testid="report-search" />
        <Select label="Kategori" value={category} onChange={(v) => { setCategory(v); setPage(1) }} testid="report-category">
          <option value="">Tüm kategoriler</option>
          {Object.entries(REPORT_CATEGORIES).map(([id, d]) => <option key={id} value={id}>{d.label}</option>)}
        </Select>
        <Select label="Öncelik" value={priority} onChange={(v) => { setPriority(v); setPage(1) }} testid="report-priority">
          <option value="">Tüm öncelikler</option>
          {Object.entries(PRIORITY_LABEL_TR).map(([id, l]) => <option key={id} value={id}>{l}</option>)}
        </Select>
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 bg-ink text-cream rounded-xl px-4 py-2.5 text-sm" data-testid="bulk-bar">
          <span className="font-semibold">{selected.size} seçili</span>
          <Button tone="ghost" className="!text-cream hover:!bg-white/10" onClick={() => bulk("REVIEWED")}>İncelemeye al</Button>
          <Button tone="ghost" className="!text-cream hover:!bg-white/10" onClick={() => bulk("DISMISSED")} data-testid="bulk-dismiss">Geçersiz say</Button>
          <button className="ml-auto underline" onClick={() => setSelected(new Set())}>Seçimi temizle</button>
        </div>
      )}

      {error && <ErrorNote message={error} onRetry={reload} />}
      {!data && loading ? (
        <Spinner />
      ) : data && rows.length === 0 ? (
        <Empty icon={<Flag size={32} />}>{status === "open" ? "Açık rapor yok. Harika! 🎉" : "Bu filtreyle eşleşen rapor yok."}</Empty>
      ) : data ? (
        <div className={loading ? "opacity-60 transition-opacity" : ""}>
          <Table head={["", "Öncelik", "Konu", "Raporlayan → Raporlanan", "Açıklama", "Zaman", "Durum"]}>
            {rows.map((r) => (
              <tr key={r.id} data-testid="report-row" onClick={() => setOpenId(r.id)} className="hover:bg-sage-50 cursor-pointer align-top">
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    aria-label="Seç"
                    checked={selected.has(r.id)}
                    onChange={() => setSelected((s) => { const n = new Set(s); n.has(r.id) ? n.delete(r.id) : n.add(r.id); return n })}
                    disabled={r.status === "RESOLVED" || r.status === "DISMISSED"}
                  />
                </td>
                <td className="px-4 py-3"><Pill tone={PRIORITY_TONE[r.priority]}>{PRIORITY_LABEL_TR[r.priority]}</Pill></td>
                <td className="px-4 py-3">
                  <p className="font-medium text-ink">{CATEGORY_LABEL_TR(r.category)}</p>
                  <p className="text-xs text-sage-500">{TARGET_LABEL_TR[r.targetType] ?? r.targetType}</p>
                </td>
                <td className="px-4 py-3">
                  <p className="text-ink">{r.reporter?.name ?? "—"} <span className="text-sage-400">→</span> <strong>{r.reported?.name ?? "—"}</strong></p>
                  <p className="text-xs text-sage-500 flex items-center gap-1.5 flex-wrap">
                    {r.reported?.email}
                    {r.reported?.banned && <Pill tone="red">Yasaklı</Pill>}
                    {r.reportedOpenCount > 1 && <Pill tone="amber" title="Bu kişiye ait açık rapor sayısı">{r.reportedOpenCount} açık rapor</Pill>}
                  </p>
                </td>
                <td className="px-4 py-3 max-w-xs"><p className="line-clamp-2 text-sage-700">{r.reason}</p></td>
                <td className="px-4 py-3 whitespace-nowrap text-xs text-sage-500" title={fmtDateTime(r.createdAt)}>{ago(r.createdAt)}</td>
                <td className="px-4 py-3"><Pill tone={STATUS_TONE[r.status]}>{STATUS_LABEL_TR[r.status]}</Pill></td>
              </tr>
            ))}
          </Table>
          <div className="flex items-center gap-2 mt-2 text-xs text-sage-500">
            <input type="checkbox" id="sel-all" checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(rows.filter((r) => r.status === "PENDING" || r.status === "REVIEWED").map((r) => r.id)))} />
            <label htmlFor="sel-all">Bu sayfadaki açık raporların tümünü seç</label>
          </div>
          <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
        </div>
      ) : null}

      {openId && (
        <ReportDrawer
          id={openId}
          onClose={() => setOpenId(null)}
          onChanged={changed}
          onOpenReport={setOpenId}
          onOpenUser={(id) => { setOpenId(null); onOpenUser(id) }}
        />
      )}
      {dialog}
      {toast}
    </div>
  )
}

interface Detail {
  report: {
    id: string; category: string; targetType: string; targetId: string | null; priority: string; status: string; reason: string
    evidence: any; adminNote: string | null; resolution: string | null; handledAt: string | null; createdAt: string
  }
  handledByName: string | null
  reporter: { id: string; name: string | null; email: string | null; createdAt: string; totalReports: number; dismissedReports: number }
  reported: null | {
    id: string; name: string | null; email: string | null; role: string; banned: boolean; banReason: string | null
    warnings: number; distinctReporters: number; teacher: { id: string; isTrialMode: boolean } | null
  }
  siblings: { id: string; category: string; targetType: string; status: string; priority: string; createdAt: string; reporter: { name: string | null } }[]
  target: null | { kind: string; id: string; title?: string; slug?: string; isActive?: boolean; status?: string }
  timeline: { id: string; action: string; reason: string | null; actor: string; createdAt: string }[]
}

function ReportDrawer({ id, onClose, onChanged, onOpenReport, onOpenUser }: { id: string; onClose: () => void; onChanged: () => void; onOpenReport: (id: string) => void; onOpenUser: (id: string) => void }) {
  const { data, error, loading, reload } = useLoader<Detail>(() => api(`/api/admin/reports/${id}`), [id])
  const { ask, dialog } = useConfirm()
  const { show, toast } = useToast()
  const [note, setNote] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const refreshed = (clearNote = true) => {
    // never throw away what the admin is typing because an unrelated status change finished
    if (clearNote) setNote(null)
    reload()
    onChanged()
  }

  const patch = async (body: Record<string, unknown>, okMsg: string) => {
    setBusy(true)
    try {
      await api(`/api/admin/reports/${id}`, { method: "PATCH", json: body })
      show(okMsg)
      refreshed("adminNote" in body)
    } catch (e: any) {
      show(e.message)
    } finally {
      setBusy(false)
    }
  }

  const act = (action: AdminAction, spec: { title: string; description: string; confirmLabel: string; label: string; min: number; tone?: "danger" | "primary"; multiline?: boolean }) =>
    ask({
      title: spec.title,
      description: spec.description,
      confirmLabel: spec.confirmLabel,
      tone: spec.tone ?? "danger",
      input: { label: spec.label, min: spec.min, multiline: spec.multiline ?? true },
      onConfirm: async (value) => {
        await api(`/api/admin/reports/${id}/action`, { method: "POST", json: { action, note: value } })
        show(ADMIN_ACTION_LABEL_TR[action])
        refreshed()
      },
    })

  if (!data) {
    return (
      <Drawer title="Rapor" onClose={onClose} testid="report-drawer">
        {error ? <ErrorNote message={error} onRetry={reload} /> : <Spinner />}
      </Drawer>
    )
  }

  const { report: r, reporter, reported, target } = data
  const closed = r.status === "RESOLVED" || r.status === "DISMISSED"
  const evidence = r.evidence || {}
  const isTeacher = !!reported?.teacher
  const escalated = !!reported && reported.distinctReporters >= ESCALATION_THRESHOLD
  const noteValue = note ?? r.adminNote ?? ""
  const roomLive = target?.kind === "live" && target.isActive
  const workshopLive = target?.kind === "workshop" && target.status === "PUBLISHED"

  return (
    <Drawer
      title={CATEGORY_LABEL_TR(r.category)}
      subtitle={<span>{TARGET_LABEL_TR[r.targetType] ?? r.targetType} · No {r.id.slice(-8).toUpperCase()} · {fmtDateTime(r.createdAt)}</span>}
      onClose={onClose}
      testid="report-drawer"
    >
      <div className={`space-y-6 ${loading ? "opacity-60" : ""}`}>
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone={PRIORITY_TONE[r.priority]}>{PRIORITY_LABEL_TR[r.priority]} öncelik</Pill>
          <Pill tone={STATUS_TONE[r.status]}>{STATUS_LABEL_TR[r.status]}</Pill>
          {!closed && (
            <Select label="Önceliği değiştir" value={r.priority} onChange={(v) => patch({ priority: v }, "Öncelik güncellendi")}>
              {Object.entries(PRIORITY_LABEL_TR).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </Select>
          )}
        </div>

        {escalated && !closed && (
          <div role="alert" data-testid="escalation-banner" className="flex gap-3 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800">
            <AlertTriangle className="shrink-0" size={18} />
            <div>
              <p className="font-semibold">{reported!.distinctReporters} farklı kullanıcı son {ESCALATION_WINDOW_DAYS} günde bu kişiyi bildirdi.</p>
              <p className="mt-0.5">{isTeacher ? "Eğitmenin onayını kaldırmayı veya hesabı kısıtlamayı değerlendirin." : "Hesabı kısıtlamayı değerlendirin."}</p>
            </div>
          </div>
        )}

        <section>
          <h4 className="text-xs font-bold uppercase tracking-wider text-sage-500 mb-2">Bildirenin açıklaması</h4>
          <Card className="p-4 text-sm whitespace-pre-line break-words" data-testid="report-reason">{r.reason}</Card>
        </section>

        {(evidence.label || evidence.message) && (
          <section>
            <h4 className="text-xs font-bold uppercase tracking-wider text-sage-500 mb-2">Kanıt / bağlam</h4>
            <Card className="p-4 text-sm space-y-2">
              {evidence.label && <p><span className="text-sage-500">İçerik:</span> {evidence.label}</p>}
              {evidence.teacher && <p><span className="text-sage-500">Eğitmen:</span> {evidence.teacher}</p>}
              {evidence.message && (
                <blockquote className="border-l-4 border-accent bg-sage-50 px-3 py-2">
                  <span className="font-semibold">{evidence.message.senderName}: </span>{evidence.message.text}
                  <p className="text-[11px] text-sage-400 mt-1">{fmtDateTime(evidence.message.sentAt)}{evidence.reporterSupplied && " · bildiren kişinin sunduğu içerik, sunucu doğrulaması yok"}</p>
                </blockquote>
              )}
              {target && (
                <p className="text-xs text-sage-500">
                  Şu an: {target.kind === "live" ? (target.isActive ? "yayın sürüyor" : "yayın sona ermiş") : target.status === "PUBLISHED" ? "atölye yayında" : `atölye ${target.status}`}
                  {target.kind === "workshop" && target.slug && <> · <a className="underline" target="_blank" rel="noreferrer" href={`/atolyeler/${target.slug}`}>sayfayı aç</a></>}
                </p>
              )}
            </Card>
          </section>
        )}

        <div className="grid sm:grid-cols-2 gap-3">
          <Card className="p-4 text-sm">
            <h4 className="text-xs font-bold uppercase tracking-wider text-sage-500 mb-2">Bildiren</h4>
            <p className="font-medium">{reporter.name ?? "—"}</p>
            <p className="text-xs text-sage-500 break-all">{reporter.email}</p>
            <p className="text-xs text-sage-500 mt-2">
              {reporter.totalReports} bildirim · {reporter.dismissedReports} geçersiz sayıldı
              {reporter.totalReports >= 3 && reporter.dismissedReports / reporter.totalReports >= 0.6 && <Pill tone="amber"> güvenilirlik düşük</Pill>}
            </p>
            <button className="text-xs underline mt-2" onClick={() => onOpenUser(reporter.id)}>Kullanıcıyı aç</button>
          </Card>
          <Card className="p-4 text-sm">
            <h4 className="text-xs font-bold uppercase tracking-wider text-sage-500 mb-2">Bildirilen</h4>
            {reported ? (
              <>
                <p className="font-medium">{reported.name ?? "—"} <Pill tone="indigo">{isTeacher ? (reported.teacher!.isTrialMode ? "Eğitmen (onaysız)" : "Eğitmen") : reported.role}</Pill></p>
                <p className="text-xs text-sage-500 break-all">{reported.email}</p>
                <p className="text-xs text-sage-500 mt-2">{reported.warnings} uyarı · {reported.distinctReporters} farklı bildiren</p>
                {reported.banned && <p className="text-xs text-red-600 mt-1">Yasaklı: {reported.banReason}</p>}
                <button className="text-xs underline mt-2" onClick={() => onOpenUser(reported.id)}>Kullanıcıyı aç</button>
              </>
            ) : (
              <p className="text-sage-500">Kullanıcı belirlenemedi.</p>
            )}
          </Card>
        </div>

        {data.siblings.length > 0 && (
          <section>
            <h4 className="text-xs font-bold uppercase tracking-wider text-sage-500 mb-2">Aynı kişiye ait diğer raporlar ({data.siblings.length})</h4>
            <ul className="space-y-1.5">
              {data.siblings.map((s) => (
                <li key={s.id}>
                  <button onClick={() => onOpenReport(s.id)} className="w-full text-left flex items-center gap-2 text-sm px-3 py-2 rounded-lg border border-rule bg-paper hover:bg-sage-50">
                    <Pill tone={STATUS_TONE[s.status]}>{STATUS_LABEL_TR[s.status]}</Pill>
                    <span className="flex-1 truncate">{CATEGORY_LABEL_TR(s.category)} · {s.reporter.name}</span>
                    <span className="text-xs text-sage-400">{ago(s.createdAt)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h4 className="text-xs font-bold uppercase tracking-wider text-sage-500 mb-2">İç not (bildirene gösterilmez)</h4>
          <textarea
            value={noteValue}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            data-testid="admin-note"
            maxLength={2000}
            placeholder="İnceleme notlarınız…"
            className="w-full px-3 py-2 bg-white border border-rule rounded-lg text-sm focus:outline-none focus:border-sage-500"
          />
          <div className="flex justify-end mt-2">
            <Button disabled={busy || note === null || note === (r.adminNote ?? "")} onClick={() => patch({ adminNote: noteValue }, "Not kaydedildi")} data-testid="save-note">Notu kaydet</Button>
          </div>
        </section>

        {closed ? (
          <section className="space-y-3">
            <Card className="p-4 text-sm" data-testid="report-closed-info">
              <p className="font-semibold">{STATUS_LABEL_TR[r.status]}</p>
              {r.resolution && <p className="mt-1">{r.resolution}</p>}
              <p className="text-xs text-sage-500 mt-1">{data.handledByName ?? "—"} · {fmtDateTime(r.handledAt)}</p>
            </Card>
            <Button disabled={busy} onClick={() => patch({ status: "PENDING" }, "Rapor yeniden açıldı")} data-testid="reopen">Yeniden aç</Button>
          </section>
        ) : (
          <section className="space-y-4">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-sage-500 mb-2">Durum</h4>
              <div className="flex flex-wrap gap-2">
                {r.status === "PENDING" && <Button disabled={busy} onClick={() => patch({ status: "REVIEWED" }, "İncelemeye alındı")} data-testid="mark-reviewed"><Eye size={14} /> İncelemeye al</Button>}
                <Button disabled={busy} onClick={() => patch({ status: "DISMISSED" }, "Rapor geçersiz sayıldı")} data-testid="dismiss"><XCircle size={14} /> Geçersiz say</Button>
                <Button disabled={busy} onClick={() => patch({ status: "RESOLVED" }, "Rapor kapatıldı")} data-testid="resolve"><CheckCircle2 size={14} /> İşlem gerekmedi, kapat</Button>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-sage-500 mb-2">Yaptırım (raporu da kapatır)</h4>
              <div className="flex flex-wrap gap-2">
                {reported && reported.role !== "ADMIN" && (
                  <Button
                    data-testid="act-warn"
                    onClick={() => act("warn", { title: "Kullanıcıyı uyar", description: "Mesaj panelinde uyarı olarak görünür ve e-postayla gönderilir.", confirmLabel: "Uyarıyı gönder", label: "Uyarı metni", min: 10, tone: "primary" })}
                  >
                    <MessageSquareWarning size={14} /> Uyar
                  </Button>
                )}
                {target?.kind === "live" && (
                  <Button disabled={!roomLive} data-testid="act-close-room" onClick={() => act("close_room", { title: "Yayını kapat", description: "Yayın hemen sonlandırılır, tüm izleyicilerin bağlantısı kesilir.", confirmLabel: "Yayını kapat", label: "Not (isteğe bağlı)", min: 0 })}>
                    <Radio size={14} /> {roomLive ? "Yayını kapat" : "Yayın sona ermiş"}
                  </Button>
                )}
                {target?.kind === "workshop" && (
                  <Button disabled={!workshopLive} data-testid="act-unpublish" onClick={() => act("unpublish_workshop", { title: "Atölyeyi yayından kaldır", description: "Atölye taslağa alınır; eğitmen düzenleyip yeniden yayınlayabilir.", confirmLabel: "Yayından kaldır", label: "Not (isteğe bağlı)", min: 0 })}>
                    <Trash2 size={14} /> {workshopLive ? "Atölyeyi yayından kaldır" : "Atölye yayında değil"}
                  </Button>
                )}
                {isTeacher && !reported!.teacher!.isTrialMode && (
                  <Button data-testid="act-revoke" onClick={() => act("revoke_teacher", { title: "Eğitmen onayını kaldır", description: "Eğitmen yeniden deneme moduna döner; yeni rezervasyon alamaz ve yayına çıkmadan önce tekrar onaylanmalıdır.", confirmLabel: "Onayı kaldır", label: "Gerekçe (eğitmene iletilir)", min: 5 })}>
                    <ShieldOff size={14} /> Onayı kaldır
                  </Button>
                )}
                {reported && reported.role !== "ADMIN" && !reported.banned && (
                  <Button tone="danger" data-testid="act-ban" onClick={() => act("ban", { title: "Kullanıcıyı yasakla", description: "Hesap kilitlenir, oturumları kapanır, dersleri iptal edilir ve bilinen IP adresleri engellenir (yerel/özel ağlar hariç). Aynı kullanıcıya ait diğer açık raporlar da kapanır.", confirmLabel: "Yasakla", label: "Yasaklama gerekçesi", min: 5 })}>
                    <Ban size={14} /> Yasakla
                  </Button>
                )}
              </div>
            </div>
          </section>
        )}

        {data.timeline.length > 0 && (
          <section>
            <h4 className="text-xs font-bold uppercase tracking-wider text-sage-500 mb-2">Geçmiş</h4>
            <ol className="space-y-2 border-l border-rule pl-4">
              {data.timeline.map((t) => (
                <li key={t.id} className="text-sm">
                  <p><span className="font-medium">{t.actor}</span> <span className="text-sage-500">· {t.action.replace(/_/g, " ").toLowerCase()}</span></p>
                  {t.reason && <p className="text-xs text-sage-500">{t.reason}</p>}
                  <p className="text-[11px] text-sage-400">{fmtDateTime(t.createdAt)}</p>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>
      {dialog}
      {toast}
    </Drawer>
  )
}
