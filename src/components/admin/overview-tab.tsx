"use client"

import { AlertTriangle, CheckCircle2, ChevronRight, XCircle } from "lucide-react"
import { Card, ErrorNote, Pill, SectionTitle, Spinner, Stat, ago, api, fmtMoney, useLoader } from "./ui"

interface Resp {
  queue: { urgentReports: number; openReports: number; oldestOpenReportAt: string | null; pendingApplications: number; trialTeachers: number; pendingPayouts: number; pendingPayoutAmount: number }
  totals: { users: number; teachers: number; bookings: number; bookings7d: number; workshopsPublished: number; liveNow: number; bannedUsers: number; evasions24h: number; volume: number; revenue: number }
  series: Record<"users" | "bookings" | "reports", { day: string; count: number }[]>
  recentAudit: { id: string; action: string; reason: string | null; actor: string; createdAt: string }[]
  health: { id: string; label: string; ok: boolean; detail: string }[]
}

function Bars({ data, color }: { data: { day: string; count: number }[]; color: string }) {
  const max = Math.max(1, ...data.map((d) => d.count))
  const total = data.reduce((s, d) => s + d.count, 0)
  return (
    <div>
      <p className="font-display text-3xl">{total}</p>
      <div className="flex items-end gap-[3px] h-14 mt-2" role="img" aria-label={`Son 14 gün toplam ${total}`}>
        {data.map((d) => (
          <div key={d.day} title={`${d.day}: ${d.count}`} className={`flex-1 rounded-sm ${color}`} style={{ height: `${Math.max(d.count ? 12 : 4, (d.count / max) * 100)}%`, opacity: d.count ? 1 : 0.25 }} />
        ))}
      </div>
    </div>
  )
}

export function OverviewTab({ goTo }: { goTo: (tab: string) => void }) {
  const { data, error, reload } = useLoader<Resp>(() => api("/api/admin/overview"), [])
  if (error) return <ErrorNote message={error} onRetry={reload} />
  if (!data) return <Spinner />
  const { queue: q, totals: t } = data

  const items = [
    { tab: "reports", label: "Acil raporlar", value: q.urgentReports, tone: "red", show: q.urgentReports > 0, hint: "Hemen bakılmalı" },
    { tab: "reports", label: "Açık raporlar", value: q.openReports, tone: "amber", show: true, hint: q.oldestOpenReportAt ? `en eskisi ${ago(q.oldestOpenReportAt)}` : "bekleyen yok" },
    { tab: "applications", label: "Eğitmen başvuruları", value: q.pendingApplications, tone: "amber", show: true, hint: "inceleme bekliyor" },
    { tab: "trials", label: "Deneme odası", value: q.trialTeachers, tone: "amber", show: true, hint: "onaysız eğitmen" },
    { tab: "payouts", label: "Ödeme talepleri", value: q.pendingPayouts, tone: "amber", show: true, hint: q.pendingPayouts ? fmtMoney(q.pendingPayoutAmount) : "bekleyen yok" },
  ]

  return (
    <div className="space-y-8" data-testid="tab-overview">
      <SectionTitle title="Genel bakış" hint="Önce yapılması gerekenler, ardından platformun durumu." />

      <section>
        <h3 className="text-xs font-bold uppercase tracking-widest text-sage-500 mb-3">Bekleyen işler</h3>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {items.map((i) => (
            <button key={i.label} onClick={() => goTo(i.tab)} data-testid={`queue-${i.tab}-${i.label === "Acil raporlar" ? "urgent" : "all"}`} className={`text-left rounded-xl border p-4 transition hover:shadow-md ${i.value > 0 ? (i.tone === "red" ? "border-red-300 bg-red-50" : "border-amber-200 bg-amber-50/60") : "border-rule bg-paper"} ${i.show ? "" : "hidden"}`}>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-sage-500">{i.label}</p>
              <p className={`font-display text-4xl mt-1 ${i.value > 0 ? (i.tone === "red" ? "text-red-600" : "text-amber-700") : "text-sage-400"}`}>{i.value}</p>
              <p className="text-xs text-sage-500 mt-1 flex items-center gap-1">{i.hint} <ChevronRight size={12} className="ml-auto" /></p>
            </button>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Kullanıcı" value={t.users} hint={`${t.teachers} eğitmen`} />
        <Stat label="Rezervasyon" value={t.bookings} hint={`son 7 günde ${t.bookings7d}`} />
        <Stat label="Canlı şimdi" value={t.liveNow} tone={t.liveNow ? "green" : undefined} hint={`${t.workshopsPublished} atölye yayında`} />
        <Stat label="Yasaklı hesap" value={t.bannedUsers} hint={t.evasions24h ? `son 24 saatte ${t.evasions24h} aşma denemesi` : "aşma denemesi yok"} tone={t.evasions24h ? "red" : undefined} />
        <Stat label="Toplam hacim" value={fmtMoney(t.volume)} />
        <Stat label="Platform geliri" value={fmtMoney(t.revenue)} hint="komisyon" tone="green" />
      </section>

      <section>
        <h3 className="text-xs font-bold uppercase tracking-widest text-sage-500 mb-3">Son 14 gün</h3>
        <div className="grid md:grid-cols-3 gap-3">
          <Card className="p-4"><p className="text-xs font-semibold uppercase tracking-wider text-sage-500">Yeni kullanıcı</p><Bars data={data.series.users} color="bg-indigo-400" /></Card>
          <Card className="p-4"><p className="text-xs font-semibold uppercase tracking-wider text-sage-500">Yeni rezervasyon</p><Bars data={data.series.bookings} color="bg-emerald-400" /></Card>
          <Card className="p-4"><p className="text-xs font-semibold uppercase tracking-wider text-sage-500">Yeni rapor</p><Bars data={data.series.reports} color="bg-red-400" /></Card>
        </div>
      </section>

      <div className="grid lg:grid-cols-2 gap-6">
        <section>
          <h3 className="text-xs font-bold uppercase tracking-widest text-sage-500 mb-3">Sistem sağlığı</h3>
          <Card className="divide-y divide-rule" data-testid="health">
            {data.health.map((h) => (
              <div key={h.id} className="flex items-start gap-3 p-3.5">
                {h.ok ? <CheckCircle2 size={18} className="text-green-500 mt-0.5 shrink-0" /> : h.id === "https" || h.id === "payments" ? <AlertTriangle size={18} className="text-amber-500 mt-0.5 shrink-0" /> : <XCircle size={18} className="text-red-500 mt-0.5 shrink-0" />}
                <div className="min-w-0">
                  <p className="text-sm font-medium">{h.label}</p>
                  <p className="text-xs text-sage-500">{h.detail}</p>
                </div>
              </div>
            ))}
          </Card>
        </section>
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold uppercase tracking-widest text-sage-500">Son yönetici işlemleri</h3>
            <button onClick={() => goTo("audit")} className="text-xs underline text-sage-500">Tümü</button>
          </div>
          <Card className="divide-y divide-rule">
            {data.recentAudit.length === 0 ? <p className="p-4 text-sm text-sage-500">Henüz kayıt yok.</p> : data.recentAudit.map((a) => (
              <div key={a.id} className="p-3.5 text-sm">
                <div className="flex items-center gap-2"><Pill>{a.action}</Pill><span className="text-xs text-sage-400 ml-auto">{ago(a.createdAt)}</span></div>
                <p className="mt-1"><span className="font-medium">{a.actor}</span>{a.reason && <span className="text-sage-500"> · {a.reason.slice(0, 90)}</span>}</p>
              </div>
            ))}
          </Card>
        </section>
      </div>
    </div>
  )
}
