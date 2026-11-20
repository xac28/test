"use client"

import { AlertTriangle, CheckCircle2, ChevronRight, XCircle } from "lucide-react"
import { Card, ErrorNote, Pill, SectionTitle, Spinner, ago, api, fmtMoney, useLoader } from "./ui"
import { StatStrip } from "@/components/panel/ui"
import { useAdminBadges } from "./tab-defs"
import { auditLabel } from "@/lib/audit-labels"

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
      <p className="mt-1 text-[1.65rem] leading-none font-semibold tabular-nums tracking-tight text-ink">{total}</p>
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
  const badges = useAdminBadges()
  if (error) return <ErrorNote message={error} onRetry={reload} />
  if (!data) return <Spinner />
  const { queue: q, totals: t } = data

  const items = [
    { tab: "reports", label: "Acil raporlar", value: q.urgentReports, tone: "red", hint: "Hemen bakılmalı" },
    { tab: "support", label: "Canlı destek", value: badges?.openSupport ?? 0, tone: "red", hint: "Yanıt bekleyen görüşme" },
    { tab: "reports", label: "Açık raporlar", value: q.openReports, tone: "amber", hint: q.oldestOpenReportAt ? `En eskisi ${ago(q.oldestOpenReportAt)}` : "Bekleyen yok" },
    { tab: "applications", label: "Eğitmen başvuruları", value: q.pendingApplications, tone: "amber", hint: "İnceleme bekliyor" },
    { tab: "trials", label: "Deneme odası", value: q.trialTeachers, tone: "amber", hint: "Onaysız eğitmen" },
    { tab: "payouts", label: "Ödeme talepleri", value: q.pendingPayouts, tone: "amber", hint: q.pendingPayouts ? fmtMoney(q.pendingPayoutAmount) : "Bekleyen yok" },
    { tab: "community", label: "Onay bekleyen fotoğraf", value: badges?.pendingPosts ?? 0, tone: "amber", hint: "Topluluk paylaşımı" },
    { tab: "ai", label: "Rehberin bilmedikleri", value: badges?.aiUnknown ?? 0, tone: "amber", hint: "Öğretilmeyi bekliyor" },
  ]
  const waiting = items.filter((i) => i.value > 0).length

  return (
    <div className="space-y-8" data-testid="tab-overview">
      <SectionTitle title="Genel bakış" hint={waiting ? `${waiting} başlıkta bekleyen iş var. Üstteki en acil olanlar.` : "Bekleyen iş yok. Platform sakin."} />

      <section aria-label="Bekleyen işler">
        <ul className="bg-paper border border-rule rounded-xl divide-y divide-rule overflow-hidden">
          {items.map((i) => (
            <li key={i.label}>
              <button
                onClick={() => goTo(i.tab)}
                data-testid={`queue-${i.tab}-${i.label === "Acil raporlar" ? "urgent" : "all"}`}
                className="w-full flex items-center gap-4 px-5 py-3 text-left hover:bg-white transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink"
              >
                <span aria-hidden className={`w-2 h-2 rounded-full shrink-0 ${i.value === 0 ? "bg-sage-300" : i.tone === "red" ? "bg-clay-500" : "bg-saffron-500"}`} />
                <span className="min-w-0 flex-1">
                  <span className={`block text-sm font-medium ${i.value === 0 ? "text-sage-600" : "text-ink"}`}>{i.label}</span>
                  <span className="block text-[13px] text-sage-500">{i.hint}</span>
                </span>
                <span className={`text-xl font-semibold tabular-nums ${i.value === 0 ? "text-sage-400" : i.tone === "red" ? "text-clay-600" : "text-ink"}`}>{i.value}</span>
                <ChevronRight size={16} className="text-sage-400 shrink-0" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      </section>

      <StatStrip
        items={[
          { label: "Kullanıcı", value: t.users, hint: `${t.teachers} eğitmen` },
          { label: "Rezervasyon", value: t.bookings, hint: `son 7 günde ${t.bookings7d}` },
          { label: "Canlı şimdi", value: t.liveNow, hint: `${t.workshopsPublished} atölye yayında`, tone: t.liveNow ? "good" : undefined },
          { label: "Yasaklı hesap", value: t.bannedUsers, hint: t.evasions24h ? `son 24 saatte ${t.evasions24h} aşma denemesi` : "aşma denemesi yok", tone: t.evasions24h ? "bad" : undefined },
          { label: "Toplam hacim", value: fmtMoney(t.volume) },
          { label: "Platform geliri", value: fmtMoney(t.revenue), hint: "komisyon", tone: "good" },
        ]}
      />

      <section>
        <h3 className="text-[15px] font-semibold text-ink mb-3">Son 14 gün</h3>
        <div className="grid md:grid-cols-3 gap-3">
          <Card className="p-4"><p className="text-[13px] text-sage-500">Yeni kullanıcı</p><Bars data={data.series.users} color="bg-teal-500" /></Card>
          <Card className="p-4"><p className="text-[13px] text-sage-500">Yeni rezervasyon</p><Bars data={data.series.bookings} color="bg-teal-500" /></Card>
          <Card className="p-4"><p className="text-[13px] text-sage-500">Yeni rapor</p><Bars data={data.series.reports} color="bg-clay-500" /></Card>
        </div>
      </section>

      <div className="grid lg:grid-cols-2 gap-6">
        <section>
          <h3 className="text-[15px] font-semibold text-ink mb-3">Sistem sağlığı</h3>
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
            <h3 className="text-[15px] font-semibold text-ink">Son yönetici işlemleri</h3>
            <button onClick={() => goTo("audit")} className="text-[13px] font-medium text-teal-700 hover:text-teal-900 cursor-pointer">Tümü</button>
          </div>
          <Card className="divide-y divide-rule">
            {data.recentAudit.length === 0 ? <p className="p-4 text-sm text-sage-500">Henüz kayıt yok.</p> : data.recentAudit.map((a) => (
              <div key={a.id} className="p-3.5 text-sm">
                <div className="flex items-center gap-2"><Pill title={a.action}>{auditLabel(a.action)}</Pill><span className="text-xs text-sage-500 ml-auto">{ago(a.createdAt)}</span></div>
                <p className="mt-1"><span className="font-medium">{a.actor}</span>{a.reason && <span className="text-sage-500"> · {a.reason.slice(0, 90)}</span>}</p>
              </div>
            ))}
          </Card>
        </section>
      </div>
    </div>
  )
}
