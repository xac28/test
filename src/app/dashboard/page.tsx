import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import Link from "next/link"
import { ArrowRight, Star, Video } from "lucide-react"
import { ReviewButton } from "@/components/review-button"
import { BADGES } from "@/lib/badges"
import { DashboardNotify } from "@/components/dashboard-notify"
import { RecordingsList } from "@/components/recordings-list"
import { Portrait } from "@/components/person-avatar"
import { BadgeGlyph } from "@/components/panel/badge-glyph"
import { Dot, EmptyNote, PageHeader, Panel, PanelHeader, StatStrip, accentBtn, primaryBtn, quietBtn } from "@/components/panel/ui"
import { notSuspended } from "@/lib/policy"
import { firstName, fmtDate, fmtDay, fmtTime, greetingTr, untilTr } from "@/lib/format-tr"

export const dynamic = "force-dynamic"

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user) redirect("/")

  const user = await db.user.findUnique({ where: { id: session.user.id } })
  const profileComplete = user?.profileCompleted ?? false

  if (!profileComplete) {
    redirect("/dashboard/profile")
  }

  const now = new Date()

  const upcomingBookings = await db.booking.findMany({
    where: {
      studentId: session.user.id,
      endTime: { gte: now },
      status: { in: ["CONFIRMED", "PENDING"] },
    },
    include: { teacher: { include: { user: true } } },
    orderBy: { startTime: "asc" },
    take: 6,
  })

  const pastBookings = await db.booking.findMany({
    where: {
      studentId: session.user.id,
      endTime: { lt: now },
      status: "COMPLETED",
    },
    include: {
      teacher: { include: { user: true } },
      review: true,
    },
    orderBy: { startTime: "desc" },
    take: 5,
  })

  const totalSessions = await db.booking.count({
    where: { studentId: session.user.id, status: "COMPLETED" },
  })

  const earned: string[] = (() => { try { return user?.badges ? JSON.parse(user.badges) : [] } catch { return [] } })()
  const nextBadge = BADGES.find((b) => !earned.includes(b.id))
  const [next, ...later] = upcomingBookings
  const nextIsNow = !!next && new Date(next.startTime) <= now && new Date(next.endTime) >= now

  // Someone with nothing booked yet is shown real teachers instead of an empty box
  const suggested = upcomingBookings.length === 0
    ? await db.teacher.findMany({
        where: { isTrialMode: false, user: notSuspended() },
        include: { user: { select: { name: true, image: true } } },
        orderBy: { id: "asc" },
        take: 3,
      })
    : []

  const summary = next
    ? nextIsNow ? "Dersin şu an devam ediyor." : `Sıradaki dersin ${untilTr(next.startTime)}.`
    : "Henüz planlanmış bir dersin yok."

  return (
    <div className="pb-12">
      <DashboardNotify />
      <PageHeader
        title={`${greetingTr(now)}, ${firstName(session.user.name) || "hoş geldin"}`}
        description={summary}
        actions={<Link href="/teachers" className={upcomingBookings.length ? quietBtn : accentBtn}>Eğitmen bul <ArrowRight size={16} aria-hidden /></Link>}
      />

      <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start">
        <div className="space-y-6 min-w-0">
          {/* what is next */}
          <Panel data-testid="next-lesson">
            <PanelHeader title="Sıradaki ders" />
            {next ? (
              <div className="px-5 pb-5">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
                  <Portrait src={next.teacher.user.image} name={next.teacher.user.name} seed={next.teacher.user.id} size={52} />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink truncate">{next.teacher.user.name}</p>
                    <p className="text-sm text-sage-600 mt-0.5">{fmtDay(next.startTime)} · {fmtTime(next.startTime)}</p>
                    <p className="text-[13px] mt-1 flex items-center gap-1.5 text-sage-600">
                      {nextIsNow ? <><Dot tone="live" /> Şu an canlı</> : next.status === "CONFIRMED" ? <><Dot tone="ok" /> Onaylandı · {untilTr(next.startTime)}</> : <><Dot tone="wait" /> Eğitmen onayı bekleniyor</>}
                    </p>
                  </div>
                  {next.status === "CONFIRMED" && (
                    <Link href={`/room?bookingId=${next.id}`} className={nextIsNow ? accentBtn : primaryBtn}>
                      <Video size={16} aria-hidden /> {nextIsNow ? "Derse katıl" : "Bekleme odasına gir"}
                    </Link>
                  )}
                </div>
              </div>
            ) : (
              <EmptyNote
                title="İlk dersini ayır"
                action={suggested.length === 0 ? <Link href="/teachers" className={accentBtn}>Eğitmenlere göz at <ArrowRight size={16} aria-hidden /></Link> : undefined}
              >
                Bir eğitmen seç, uygun saati ayır. İlk deneme dersi yarı fiyatına.
              </EmptyNote>
            )}
            {suggested.length > 0 && (
              <ul className="divide-y divide-rule border-t border-rule">
                {suggested.map((t) => (
                  <li key={t.id}>
                    <Link href={`/teachers/${t.id}`} className="flex items-center gap-3.5 px-5 py-3 hover:bg-white transition-colors">
                      <Portrait src={t.user.image} name={t.user.name} seed={t.userId} size={40} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-ink truncate">{t.user.name}</span>
                        <span className="block text-[13px] text-sage-500 truncate">{(() => { try { return (JSON.parse(t.specialties || "[]") as string[]).slice(0, 2).join(" · ") } catch { return "" } })() || "Yoga eğitmeni"}</span>
                      </span>
                      <span className="text-sm tabular-nums text-sage-700">${t.hourlyRate.toFixed(0)}</span>
                      <ArrowRight size={15} className="text-sage-400" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {later.length > 0 && (
            <Panel>
              <PanelHeader title="Diğer yaklaşan dersler" />
              <ul className="divide-y divide-rule border-t border-rule">
                {later.map((b: any) => (
                  <li key={b.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5">
                    <Portrait src={b.teacher.user.image} name={b.teacher.user.name} seed={b.teacher.user.id} size={36} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink truncate">{b.teacher.user.name}</p>
                      <p className="text-[13px] text-sage-500">{fmtDay(b.startTime)} · {fmtTime(b.startTime)}</p>
                    </div>
                    <span className="text-[13px] text-sage-600 inline-flex items-center gap-1.5">{b.status === "CONFIRMED" ? <><Dot tone="ok" /> Onaylandı</> : <><Dot tone="wait" /> Onay bekliyor</>}</span>
                    {b.status === "CONFIRMED" && <Link href={`/room?bookingId=${b.id}`} className={quietBtn}>Odayı aç</Link>}
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          {pastBookings.length > 0 && (
            <Panel>
              <PanelHeader title="Geçmiş dersler" description="Son tamamlanan derslerin" />
              <ul className="divide-y divide-rule border-t border-rule">
                {pastBookings.map((b: any) => (
                  <li key={b.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5">
                    <Portrait src={b.teacher.user.image} name={b.teacher.user.name} seed={b.teacher.user.id} size={36} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink truncate">{b.teacher.user.name}</p>
                      <p className="text-[13px] text-sage-500">{fmtDate(b.startTime)}</p>
                    </div>
                    {b.review ? (
                      <span className="inline-flex items-center gap-1 text-[13px] text-sage-700" aria-label={`Puanın: ${b.review.rating} / 5`}>
                        <Star size={14} className="text-saffron-500 fill-saffron-400" aria-hidden /> {b.review.rating}/5
                      </span>
                    ) : (
                      <ReviewButton bookingId={b.id} teacherName={b.teacher.user.name} />
                    )}
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          <RecordingsList role="student" />
        </div>

        {/* rhythm + badges */}
        <aside className="space-y-6 min-w-0">
          <StatStrip
            min={88}
            items={[
              { label: "Seri", value: user?.currentStreak || 0, hint: "gün" },
              { label: "Puan", value: user?.points || 0 },
              { label: "Ders", value: totalSessions },
            ]}
          />
          <Panel data-testid="badges">
            <PanelHeader title="Rozetler" description={`${earned.length} / ${BADGES.length} kazanıldı`} />
            <div className="px-5 pb-5 space-y-4">
              {earned.length > 0 && (
                <ul className="flex flex-wrap gap-2">
                  {BADGES.filter((b) => earned.includes(b.id)).map((b) => (
                    <li key={b.id} className="inline-flex items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50 text-teal-800 text-[13px] font-medium pl-2 pr-3 py-1">
                      <BadgeGlyph id={b.id} size={15} /> {b.nametr}
                    </li>
                  ))}
                </ul>
              )}
              {nextBadge && (
                <div className="flex items-start gap-3 rounded-lg bg-white border border-rule px-3.5 py-3">
                  <span className="mt-0.5 w-8 h-8 shrink-0 rounded-full bg-sage-100 text-sage-500 flex items-center justify-center"><BadgeGlyph id={nextBadge.id} size={16} /></span>
                  <div className="min-w-0">
                    <p className="text-[13px] text-sage-500">Sıradaki rozet</p>
                    <p className="text-sm font-medium text-ink">{nextBadge.nametr}</p>
                    <p className="text-[13px] text-sage-600 mt-0.5">{nextBadge.descriptiontr}</p>
                  </div>
                </div>
              )}
              <details className="group">
                <summary className="cursor-pointer text-[13px] font-medium text-teal-700 hover:text-teal-900 list-none inline-flex items-center gap-1 min-h-[32px]">
                  Tüm rozetleri göster <span className="text-sage-400 group-open:hidden" aria-hidden>+</span><span className="text-sage-400 hidden group-open:inline" aria-hidden>−</span>
                </summary>
                <ul className="mt-2 divide-y divide-rule">
                  {BADGES.map((b) => {
                    const got = earned.includes(b.id)
                    return (
                      <li key={b.id} className={`flex items-center gap-3 py-2.5 ${got ? "" : "opacity-60"}`}>
                        <span className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center ${got ? "bg-teal-100 text-teal-700" : "bg-sage-100 text-sage-400"}`}><BadgeGlyph id={b.id} size={14} /></span>
                        <span className="min-w-0">
                          <span className="block text-[13px] font-medium text-ink">{b.nametr}{got && <span className="sr-only"> (kazanıldı)</span>}</span>
                          <span className="block text-xs text-sage-500">{b.descriptiontr}</span>
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </details>
            </div>
          </Panel>
        </aside>
      </div>
    </div>
  )
}
