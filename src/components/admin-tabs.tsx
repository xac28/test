"use client"

import { useCallback, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { BadgeCheck, DollarSign, FileText, History, TrendingUp, AlertTriangle, Activity } from "lucide-react"
import { AdminApplicationsTable } from "./admin-applications"
import { AdminPayouts } from "./admin-payouts"
import { AdminArticles } from "./admin-articles"
import { AdminTrials } from "./admin-trials"
import { ADMIN_TABS, ADMIN_TAB_IDS, BADGE_TONE, refreshAdminBadges, useAdminBadges } from "./admin/tab-defs"
import { OverviewTab } from "./admin/overview-tab"
import { ReportsTab } from "./admin/reports-tab"
import { PolicyTab } from "./admin/policy-tab"
import { SupportTab } from "./admin/support-tab"
import { AiTab } from "./admin/ai-tab"
import { ReviewsTab } from "./admin/reviews-tab"
import { CommunityTab } from "./admin/community-tab"
import { UsersTab, UserDrawer } from "./admin/users-tab"
import { BookingsTab } from "./admin/bookings-tab"
import { WorkshopsTab } from "./admin/workshops-tab"
import { RecordingsTab } from "./admin/recordings-tab"
import { SecurityTab } from "./admin/security-tab"
import { AuditTab } from "./admin/audit-tab"
import { RoomsTab } from "./admin/rooms-tab"
import { Card, SectionTitle, Stat, fmtMoney } from "./admin/ui"

/**
 * The admin workspace. The URL (?tab=…) is the single source of truth for the open tab, so the sidebar,
 * the mobile tab bar, deep links, back/forward and reloads all agree.
 */
export function AdminTabs({ pendingApplications, recentActions, financials, trialTeachers, approvedTeachers }: any) {
  const router = useRouter()
  const params = useSearchParams()
  const requested = params.get("tab") || "overview"
  const tab = ADMIN_TAB_IDS.includes(requested) ? requested : "overview"
  const badges = useAdminBadges()
  const [userId, setUserId] = useState<string | null>(null)
  const [usersRefresh, setUsersRefresh] = useState(0)

  const goTo = useCallback((id: string) => router.push(`/admin?tab=${id}`, { scroll: false }), [router])
  const changed = useCallback(() => {
    refreshAdminBadges()
    setUsersRefresh((n) => n + 1)
  }, [])

  return (
    <div className="space-y-6">
      {/* Mobile / tablet tab bar — on desktop the sidebar carries the same list */}
      <nav aria-label="Yönetim bölümleri" className="md:hidden -mx-1 flex overflow-x-auto gap-1.5 pb-1 hide-scrollbar" data-testid="admin-tabbar">
        {ADMIN_TABS.map((t) => {
          const b = badges && t.badge?.(badges)
          const Icon = t.icon
          const active = t.id === tab
          return (
            <button
              key={t.id}
              onClick={() => goTo(t.id)}
              aria-current={active ? "page" : undefined}
              className={`shrink-0 inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-sm border transition ${active ? "bg-ink text-cream border-ink" : "bg-paper border-rule text-sage-700"}`}
            >
              <Icon size={15} /> {t.label}
              {b && <span className={`min-w-5 h-5 px-1.5 rounded-full text-[11px] font-bold flex items-center justify-center ${BADGE_TONE[b.tone]}`}>{b.value}</span>}
            </button>
          )
        })}
      </nav>

      <div key={tab} className="animate-fade-up">
        {tab === "overview" && <OverviewTab goTo={goTo} />}
        {tab === "reports" && <ReportsTab onChanged={changed} onOpenUser={setUserId} />}
        {tab === "community" && <CommunityTab onChanged={changed} onOpenUser={setUserId} />}
        {tab === "policy" && <PolicyTab onChanged={changed} onOpenUser={setUserId} />}
        {tab === "support" && <SupportTab onChanged={changed} onOpenUser={setUserId} />}
        {tab === "ai" && <AiTab onChanged={changed} />}
        {tab === "reviews" && <ReviewsTab onChanged={changed} onOpenUser={setUserId} />}
        {tab === "users" && <UsersTab onOpenUser={setUserId} refreshKey={usersRefresh} />}
        {tab === "security" && <SecurityTab onOpenUser={setUserId} />}
        {tab === "audit" && <AuditTab />}
        {tab === "bookings" && <BookingsTab onOpenUser={setUserId} onChanged={changed} />}
        {tab === "workshops" && <WorkshopsTab onOpenUser={setUserId} onChanged={changed} />}
        {tab === "recordings" && <RecordingsTab />}
        {tab === "rooms" && <RoomsTab onChanged={changed} />}

        {tab === "applications" && (
          <div className="space-y-8">
            <SectionTitle title="Bekleyen başvurular" hint="Yeni eğitmen başvurularını inceleyin; onaylananlar deneme odası aşamasına geçer." />
            {pendingApplications.length === 0 ? (
              <Card className="border-dashed p-12 text-center">
                <BadgeCheck size={44} className="mx-auto text-sage-300 mb-3" />
                <h3 className="text-lg font-medium text-sage-800">Hepsi tamam!</h3>
                <p className="text-sage-500 text-sm">Şu anda bekleyen başvuru yok.</p>
              </Card>
            ) : (
              <AdminApplicationsTable applications={pendingApplications} />
            )}
            {recentActions.length > 0 && (
              <section>
                <h3 className="text-xs font-bold uppercase tracking-widest text-sage-500 mb-3 flex items-center gap-2"><History size={14} /> Son kararlar</h3>
                <Card className="divide-y divide-rule overflow-hidden">
                  {recentActions.map((app: any) => (
                    <div key={app.id} className="flex items-center justify-between p-4 text-sm">
                      <div>
                        <p className="font-medium">{app.user.name}</p>
                        <p className="text-xs text-sage-500">{app.user.email}</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${app.status === "APPROVED" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                        {app.status === "APPROVED" ? "ONAYLANDI" : "REDDEDİLDİ"}
                      </span>
                    </div>
                  ))}
                </Card>
              </section>
            )}
          </div>
        )}

        {tab === "trials" && (
          <AdminTrials
            initialTrials={(trialTeachers || []).map((t: any) => ({
              id: t.id, name: t.user.name, email: t.user.email, specialties: t.specialties,
              trialNote: t.trialNote, createdAt: t.user.createdAt, inRoom: false,
            }))}
            approved={approvedTeachers || []}
          />
        )}

        {tab === "financials" && (
          <div className="space-y-5">
            <SectionTitle title="Platform finansı" hint="Onaylı ve tamamlanan rezervasyonlardan hesaplanır." />
            <div className="grid md:grid-cols-3 gap-3">
              <Stat label="Toplam hacim" value={fmtMoney(financials.totalVolume)} hint={<span className="inline-flex items-center gap-1"><TrendingUp size={12} /> brüt ciro</span>} />
              <Stat label="Platform geliri" value={fmtMoney(financials.platformRevenue)} tone="green" hint="komisyon" />
              <Stat label="Bekleyen hakedişler" value={fmtMoney(financials.pendingPayouts)} tone="amber" hint="Stripe Connect'i olmayan eğitmenlere elle ödenecek" />
            </div>
            <Card className="p-4 text-sm text-sage-600 flex gap-2"><AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-500" /> Ödeme taleplerini “Ödeme Talepleri” sekmesinden onaylayabilirsiniz.</Card>
          </div>
        )}

        {tab === "payouts" && <AdminPayouts onChange={() => { refreshAdminBadges(); router.refresh() }} />}
        {tab === "articles" && <AdminArticles />}
      </div>

      {userId && <UserDrawer id={userId} onClose={() => setUserId(null)} onChanged={changed} />}
    </div>
  )
}
