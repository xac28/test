import { TeacherBadge } from "@/components/teacher-badge"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import Link from "next/link"
import { ArrowRight, ExternalLink, Star, Video } from "lucide-react"
import { GoLiveButton } from "@/components/go-live-button"
import { StripeConnectButton } from "@/components/stripe-connect-button"
import { TeacherVideoManager } from "@/components/teacher-video-manager"
import { TeacherProfileEditor } from "@/components/teacher-profile-editor"
import { RecordingsList } from "@/components/recordings-list"
import { Portrait } from "@/components/person-avatar"
import { Checklist, Dot, EmptyNote, PageHeader, Panel, PanelHeader, StatStrip, accentBtn, primaryBtn, quietBtn } from "@/components/panel/ui"
import { firstName, fmtDate, fmtDay, fmtTime, greetingTr, untilTr } from "@/lib/format-tr"

export const dynamic = "force-dynamic"

export default async function TeachDashboardPage() {
  const session = await auth()
  if (!session?.user) redirect("/")
  if (session.user.role !== "TEACHER" && session.user.role !== "ADMIN") redirect("/dashboard")

  let teacher = await db.teacher.findUnique({
    where: { userId: session.user.id },
  })

  // Auto-provision a Teacher profile for ADMINs so they can test the system
  if (!teacher && session.user.role === "ADMIN") {
    teacher = await db.teacher.create({
      data: {
        userId: session.user.id,
        bio: "Admin Test Profile",
        hourlyRate: 0,
        isTrialMode: false, // Bypass trial for admins
      }
    })
  }

  if (!teacher) {
    return (
      <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
        <div className="glass-card p-10 rounded-3xl text-center max-w-md w-full border border-sage-100">
          <p className="text-sage-600 text-lg mb-6">Eğitmen profili bulunamadı.</p>
          <Link href="/become-teacher" className="bg-sage-600 text-white px-8 py-3 rounded-full btn-press inline-block font-medium w-full text-center hover:bg-sage-700 transition">Eğitmenlik için başvur</Link>
        </div>
      </div>
    )
  }

  const now = new Date()

  const [upcomingBookings, completedBookings, totalCompleted, allCompleted, videos, uniqueStudents, activeLiveRoom, availabilityCount, appDevices] = await Promise.all([
    db.booking.findMany({
      where: { teacherId: teacher.id, endTime: { gte: now }, status: { in: ["CONFIRMED", "PENDING"] } },
      include: { student: true },
      orderBy: { startTime: "asc" },
      take: 6,
    }),
    db.booking.findMany({
      where: { teacherId: teacher.id, status: "COMPLETED" },
      orderBy: { startTime: "desc" },
      take: 5,
      include: { student: true, review: true },
    }),
    db.booking.count({ where: { teacherId: teacher.id, status: "COMPLETED" } }),
    db.booking.findMany({ where: { teacherId: teacher.id, status: "COMPLETED" }, select: { price: true } }),
    db.teacherVideo.findMany({ where: { teacherId: teacher.id }, orderBy: { createdAt: "desc" } }),
    db.booking.groupBy({ by: ["studentId"], where: { teacherId: teacher.id } }),
    db.liveRoom.findFirst({ where: { teacherId: teacher.id, isActive: true } }),
    db.availability.count({ where: { teacherId: teacher.id } }),
    db.streamerDevice.count({ where: { userId: session.user.id, revokedAt: null, expiresAt: { gt: now } } }),
  ])
  const grossEarnings = allCompleted.reduce((sum, b) => sum + b.price, 0)
  const netEarnings = grossEarnings * (1 - teacher.commissionRate)

  const setup = [
    { done: (teacher.bio ?? "").trim().length >= 40 && teacher.bio !== "Admin Test Profile", title: "Profil metnini yaz", text: "Öğrenciler seni burada tanır: deneyimini ve tarzını anlat.", href: "#profil", cta: "Yaz" },
    { done: videos.length > 0, title: "Bir tanıtım videosu ekle", text: "Kısa bir video, profilini ziyaret edenlerin güvenini artırır.", href: "#videolar", cta: "Ekle" },
    { done: availabilityCount > 0, title: "Müsait olduğun saatleri seç", text: "Öğrenciler yalnızca açtığın saatlere randevu alabilir.", href: "/teach/availability", cta: "Saatleri seç" },
    { done: !!teacher.stripeConnectId, title: "Ödeme hesabını bağla", text: "Kazancın doğrudan hesabına geçer.", href: "#odeme", cta: "Bağla" },
    { done: appDevices > 0, title: "Masaüstü yayın uygulamasını kur", text: "Daha kararlı ve yüksek kaliteli yayın için (isteğe bağlı).", href: "/teach/uygulama", cta: "Kur" },
  ]
  const doneCount = setup.filter((x) => x.done).length
  const [next, ...later] = upcomingBookings
  const nextIsNow = !!next && new Date(next.startTime) <= now && new Date(next.endTime) >= now
  const summary = activeLiveRoom
    ? "Şu anda canlı yayındasın."
    : next ? (nextIsNow ? "Bir dersin şu an devam ediyor." : `Sıradaki dersin ${untilTr(next.startTime)}.`) : "Yaklaşan dersin yok."

  return (
    <div className="pb-12">
      <PageHeader
        title={`${greetingTr(now)}, ${firstName(session.user.name) || "hoş geldin"}`}
        description={summary}
        meta={<TeacherBadge trial={teacher.isTrialMode} />}
        actions={<Link href={`/teachers/${teacher.id}`} className={quietBtn}>Herkese açık profilim <ExternalLink size={15} aria-hidden /></Link>}
      />

      <div className="space-y-6">
        {teacher.isTrialMode && (
          <Panel className="border-l-4 !border-l-saffron-500" data-testid="trial-panel">
            <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-5">
              <div className="min-w-0">
                <h2 className="text-[15px] font-semibold text-ink">Deneme Aşamasındasınız</h2>
                <p className="mt-1.5 text-sm text-sage-700 max-w-2xl leading-relaxed">
                  Başvurun onaylandı. Deneme sürecinde <strong>canlı yayın açabilirsin</strong>; yayınların AYA yetkilileri tarafından canlı izlenir ve gerekirse sana mesaj gönderebilirler. Yayınları beğenirlerse <strong>“Onaylı öğretmen”</strong> rozetini alırsın; atölye ve rezervasyon da o zaman açılır. İstersen yetkililerle <strong>5 dakikalık özel bir deneme yayını</strong> da yapabilirsin.
                </p>
                {teacher.trialNote && (
                  <p className="mt-3 text-sm text-clay-700 border-l-2 border-clay-400 pl-3 max-w-2xl" data-testid="trial-note">
                    Son değerlendirme notu: {teacher.trialNote}
                  </p>
                )}
              </div>
              <Link href={`/room/trial/${teacher.id}`} className={`${primaryBtn} shrink-0`}>Deneme yayınını başlat</Link>
            </div>
          </Panel>
        )}

        {/* going live: trial-phase teachers too (their broadcasts are supervised) */}
        <GoLiveButton activeLiveRoom={activeLiveRoom ? JSON.parse(JSON.stringify(activeLiveRoom)) : null} />

        <StatStrip
          items={[
            { label: "Net kazanç", value: `$${netEarnings.toFixed(2)}`, hint: `brüt $${grossEarnings.toFixed(2)}`, tone: netEarnings > 0 ? "good" : undefined },
            { label: "Tamamlanan ders", value: totalCompleted },
            { label: "Öğrenci", value: uniqueStudents.length },
            { label: "Komisyon", value: `%${(teacher.commissionRate * 100).toFixed(0)}`, hint: "her dersten kesilir" },
          ]}
        />

        {doneCount < setup.length && (
          <Panel data-testid="setup-checklist">
            <PanelHeader title="Başlarken" description={`${doneCount} / ${setup.length} adım tamamlandı`} />
            <div className="px-5 pb-3"><div className="h-1.5 rounded-full bg-sage-100 overflow-hidden"><div className="h-full bg-teal-600 rounded-full" style={{ width: `${(doneCount / setup.length) * 100}%` }} /></div></div>
            <div className="border-t border-rule"><Checklist items={setup} /></div>
          </Panel>
        )}

        {/* the checklist's payout step jumps here */}
        {!teacher.stripeConnectId && <div id="odeme" className="scroll-mt-24"><StripeConnectButton isConnected={false} /></div>}

        <div className="grid xl:grid-cols-2 gap-6 items-start">
          <Panel>
            <PanelHeader title="Yaklaşan dersler" />
            {upcomingBookings.length === 0 ? (
              <EmptyNote title="Yaklaşan ders yok">Öğrenciler profilin üzerinden, açtığın saatlere randevu alabilir.</EmptyNote>
            ) : (
              <ul className="divide-y divide-rule border-t border-rule">
                {upcomingBookings.map((b: any) => {
                  const isNow = new Date(b.startTime) <= now && new Date(b.endTime) >= now
                  return (
                    <li key={b.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5">
                      <Portrait src={b.student.image} name={b.student.name} seed={b.student.id} size={36} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-ink truncate">{b.student.name || "Öğrenci"}</p>
                        <p className="text-[13px] text-sage-500">{fmtDay(b.startTime)} · {fmtTime(b.startTime)} · <span className="tabular-nums">${b.price.toFixed(2)}</span></p>
                      </div>
                      {b.status === "CONFIRMED" ? (
                        <Link href={`/room?bookingId=${b.id}`} className={isNow ? accentBtn : quietBtn}><Video size={15} aria-hidden /> {isNow ? "Dersi başlat" : "Odayı aç"}</Link>
                      ) : (
                        <span className="text-[13px] text-sage-600 inline-flex items-center gap-1.5"><Dot tone="wait" /> Ödeme bekleniyor</span>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </Panel>

          <Panel>
            <PanelHeader title="Son dersler" href="/teach/bookings" hrefLabel="Tüm dersler" />
            {completedBookings.length === 0 ? (
              <EmptyNote title="Henüz tamamlanan ders yok">Tamamlanan dersler, öğrenci puanları ve kazancın burada görünür.</EmptyNote>
            ) : (
              <ul className="divide-y divide-rule border-t border-rule">
                {completedBookings.map((b: any) => (
                  <li key={b.id} className="flex items-center gap-4 px-5 py-3.5">
                    <Portrait src={b.student.image} name={b.student.name} seed={b.student.id} size={36} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink truncate">{b.student.name || "Öğrenci"}</p>
                      <p className="text-[13px] text-sage-500">{fmtDate(b.startTime)}</p>
                    </div>
                    {b.review && <span className="inline-flex items-center gap-1 text-[13px] text-sage-700" aria-label={`Puan: ${b.review.rating} / 5`}><Star size={14} className="text-saffron-500 fill-saffron-400" aria-hidden /> {b.review.rating}/5</span>}
                    <span className="text-sm font-medium tabular-nums text-teal-700">+${(b.price * (1 - teacher.commissionRate)).toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <RecordingsList role="teacher" />

        <div id="profil" className="scroll-mt-24"><TeacherProfileEditor initialBio={teacher.bio ?? ""} /></div>
        <div id="videolar" className="scroll-mt-24"><TeacherVideoManager initialVideos={JSON.parse(JSON.stringify(videos))} /></div>
      </div>
    </div>
  )
}
