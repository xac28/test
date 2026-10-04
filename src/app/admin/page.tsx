import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { AdminTabs } from "@/components/admin-tabs"
import { Users, BookOpen, Clock, Calendar, FileText, Video } from "lucide-react"

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const session = await auth()
  if (!session?.user) redirect("/")
  if (session.user.role !== "ADMIN") redirect("/dashboard")

  const pendingApplications = await db.teacherApplication.findMany({
    where: { status: "PENDING" },
    include: { user: true },
    orderBy: { submittedAt: "desc" },
  })

  const recentActions = await db.teacherApplication.findMany({
    where: { status: { in: ["APPROVED", "REJECTED"] } },
    include: { user: true },
    orderBy: { reviewedAt: "desc" },
    take: 10,
  })

  const stats = {
    totalUsers: await db.user.count(),
    totalTeachers: await db.teacher.count(),
    totalBookings: await db.booking.count(),
    pendingApps: pendingApplications.length,
    activeLiveRooms: await db.liveRoom.count({ where: { isActive: true } }),
  }

  const allUsers = await db.user.findMany({
    orderBy: { createdAt: "desc" }
  })

  const now = new Date()
  const activeRooms = await db.liveRoom.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "desc" }
  })

  const activeBookings = await db.booking.findMany({
    where: {
      status: "CONFIRMED",
      startTime: { lte: now },
      endTime: { gte: now }
    },
    include: {
      student: true,
      teacher: { include: { user: true } }
    },
    orderBy: { startTime: "asc" }
  })

  // Calculate financials based on CONFIRMED and COMPLETED bookings
  const paidBookings = await db.booking.findMany({
    where: { status: { in: ["CONFIRMED", "COMPLETED"] } },
    include: { teacher: true }
  })

  let totalVolume = 0
  let platformRevenue = 0
  let pendingPayouts = 0

  paidBookings.forEach(b => {
    totalVolume += b.price
    const comm = b.price * b.teacher.commissionRate
    platformRevenue += comm
    if (!b.teacher.stripeConnectId) {
      pendingPayouts += (b.price - comm)
    }
  })

  const financials = { totalVolume, platformRevenue, pendingPayouts }

  const reports = await db.report.findMany({
    include: { reporter: true, reported: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  })

  const logs = await db.auditLog.findMany({
    include: { actor: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  })

  const pendingPayoutCount = await db.payoutRequest.count({ where: { status: "PENDING" } })

  const trialTeachers = await db.teacher.findMany({
    where: { isTrialMode: true },
    include: { user: true },
    orderBy: { id: "desc" }
  })

  const approvedTeachers = (
    await db.teacher.findMany({
      where: { isTrialMode: false },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { id: "desc" },
      take: 100,
    })
  ).map((t) => ({ id: t.id, name: t.user.name, email: t.user.email, trialReviewedAt: t.trialReviewedAt }))

  return (
    <div className="space-y-8 animate-fade-in stagger-children relative">
      {/* Premium Header */}
      <div className="relative overflow-hidden rounded-3xl bg-sage-900 text-white p-8 shadow-xl shadow-sage-900/20">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <svg width="200" height="200" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 22h20L12 2z"/></svg>
        </div>
        <div className="relative z-10">
          <p className="text-sage-300 text-sm font-bold tracking-widest uppercase mb-2">Yönetim Merkezi</p>
          <h1 className="text-4xl font-display text-white mb-2">Yönetim Paneli</h1>
          <p className="text-sage-400 max-w-lg">Kullanıcıları yönetin, öğretmen başvurularını inceleyin, canlı odaları izleyin ve ödeme taleplerini anlık olarak onaylayın.</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 stagger-children">
        {[
          { label: "Kullanıcı", value: stats.totalUsers, icon: Users, color: "text-blue-500", bg: "bg-blue-500/10" },
          { label: "Öğretmen", value: stats.totalTeachers, icon: BookOpen, color: "text-indigo-500", bg: "bg-indigo-500/10" },
          { label: "Deneme Odası", value: trialTeachers.length, icon: Clock, color: "text-amber-500", bg: "bg-amber-500/10", alert: trialTeachers.length > 0 },
          { label: "Rezervasyon", value: stats.totalBookings, icon: Calendar, color: "text-emerald-500", bg: "bg-emerald-500/10" },
          { label: "Bekleyen Başvuru", value: stats.pendingApps, icon: FileText, color: "text-orange-500", bg: "bg-orange-500/10", alert: stats.pendingApps > 0 },
          { label: "Canlı Oda", value: stats.activeLiveRooms, icon: Video, color: "text-red-500", bg: "bg-red-500/10", alert: stats.activeLiveRooms > 0 },
        ].map((stat, i) => {
          const Icon = stat.icon
          return (
            <div key={i} className="glass-card p-5 rounded-2xl border border-sage-200/60 card-hover text-center relative overflow-hidden group">
              {stat.alert && <span className={`absolute top-3 right-3 w-2.5 h-2.5 ${stat.color.replace('text-', 'bg-')} rounded-full animate-pulse shadow-sm`}></span>}
              <div className={`mx-auto w-12 h-12 ${stat.bg} ${stat.color} rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110`}>
                <Icon size={24} />
              </div>
              <p className="text-3xl font-display text-sage-900 animate-count">{stat.value}</p>
              <p className="text-[11px] text-sage-500 font-bold uppercase tracking-widest mt-1">{stat.label}</p>
            </div>
          )
        })}
      </div>

      <div className="mt-8">
        <AdminTabs 
          pendingApplications={JSON.parse(JSON.stringify(pendingApplications))} 
          recentActions={JSON.parse(JSON.stringify(recentActions))}
          users={JSON.parse(JSON.stringify(allUsers))}
          activeRooms={JSON.parse(JSON.stringify(activeRooms))}
          activeBookings={JSON.parse(JSON.stringify(activeBookings))}
          financials={financials}
          reports={JSON.parse(JSON.stringify(reports))}
          logs={JSON.parse(JSON.stringify(logs))}
          trialTeachers={JSON.parse(JSON.stringify(trialTeachers))}
          approvedTeachers={JSON.parse(JSON.stringify(approvedTeachers))}
          pendingPayoutCount={pendingPayoutCount}
        />
      </div>
    </div>
  )
}
