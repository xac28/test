import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import Link from "next/link"
import { Calendar, Clock, ArrowRight, Sparkles, Flame, Trophy, Award, History, PlayCircle, Star, BadgeCheck, Zap } from "lucide-react"
import { ReviewButton } from "@/components/review-button"
import { BADGES } from "@/lib/badges"
import { DashboardNotify } from "@/components/dashboard-notify"
import { RecordingsList } from "@/components/recordings-list"

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
      startTime: { gte: now },
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

  return (
    <div className="space-y-12 animate-fade-in stagger-children pb-12">
      <DashboardNotify />
      {/* Premium Welcome Header */}
      <div className="relative overflow-hidden rounded-[2rem] bg-sage-900 text-white p-8 md:p-12 shadow-2xl shadow-sage-900/20">
        <div className="absolute top-0 right-0 w-full h-full opacity-10 pointer-events-none">
          <svg className="absolute right-0 top-0 h-full w-1/2" viewBox="0 0 100 100" preserveAspectRatio="none" fill="none" stroke="currentColor" strokeWidth="0.5">
            <path d="M0,100 C30,60 70,40 100,0 L100,100 Z" fill="currentColor" opacity="0.2"/>
            <path d="M20,100 C50,50 80,30 100,0 L100,100 Z" fill="currentColor" opacity="0.4"/>
          </svg>
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-8">
          <div>
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest text-sage-200 mb-4 border border-white/10">
              <Sparkles size={14} className="text-amber-400" /> Öğrenci Paneli
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-display text-white mb-2 leading-tight">Tekrar hoş geldiniz,<br/><span className="text-sage-200 italic">{session.user.name || "Student"}</span></h1>
            <p className="text-sage-500 max-w-md">İlerlemenizi takip edin, derslerinizi yönetin ve yolculuğunuza devam edin.</p>
          </div>
          
          <div className="flex items-center gap-4 sm:gap-6 bg-white/5 backdrop-blur-xl p-4 rounded-3xl border border-white/10">
            <div className="text-center px-4">
              <div className="w-12 h-12 mx-auto bg-orange-500/20 text-orange-400 rounded-2xl flex items-center justify-center mb-2 shadow-inner border border-orange-500/30">
                <Flame size={24} />
              </div>
              <p className="text-2xl font-display text-white animate-count">{user?.currentStreak || 0}</p>
              <p className="text-[10px] text-sage-500 uppercase tracking-widest font-bold">Günlük seri</p>
            </div>
            <div className="w-px h-16 bg-white/10"></div>
            <div className="text-center px-4">
              <div className="w-12 h-12 mx-auto bg-amber-500/20 text-amber-400 rounded-2xl flex items-center justify-center mb-2 shadow-inner border border-amber-500/30">
                <Trophy size={24} />
              </div>
              <p className="text-2xl font-display text-white animate-count" style={{ animationDelay: '100ms' }}>{user?.points || 0}</p>
              <p className="text-[10px] text-sage-500 uppercase tracking-widest font-bold">Puan</p>
            </div>
            <div className="w-px h-16 bg-white/10 hidden sm:block"></div>
            <div className="text-center px-4 hidden sm:block">
              <div className="w-12 h-12 mx-auto bg-sage-500/20 text-sage-300 rounded-2xl flex items-center justify-center mb-2 shadow-inner border border-sage-500/30">
                <PlayCircle size={24} />
              </div>
              <p className="text-2xl font-display text-white animate-count" style={{ animationDelay: '200ms' }}>{totalSessions}</p>
              <p className="text-[10px] text-sage-500 uppercase tracking-widest font-bold">Ders</p>
            </div>
          </div>
        </div>
      </div>

      {/* Gamification / Badges Section */}
      <div className="bg-white rounded-3xl p-8 border border-sage-200/60 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5 text-sage-500 transform translate-x-4 -translate-y-4">
          <Award size={120} />
        </div>
        <div className="relative z-10 flex items-center justify-between mb-8">
          <div>
            <h2 className="font-display text-3xl text-sage-900 flex items-center gap-3">
              <Award className="text-amber-500" size={28} /> Başarı Rozetleri
            </h2>
            <p className="text-sage-500 text-sm mt-1">Seri tutarak ve ders tamamlayarak rozetlerin kilidini açın.</p>
          </div>
        </div>
        <div className="relative z-10 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {BADGES.map(badge => {
            const isUnlocked = user?.badges ? JSON.parse(user.badges).includes(badge.id) : false
            return (
              <div 
                key={badge.id}
                className={`group p-5 rounded-2xl flex flex-col items-center justify-center text-center transition-all duration-300 ${
                  isUnlocked 
                    ? "bg-gradient-to-b from-white to-amber-50 border border-amber-200 shadow-sm hover:-translate-y-1 hover:shadow-md hover:border-amber-300"
                    : "bg-sage-50/50 border border-sage-100 opacity-60 grayscale hover:grayscale-0 transition-all duration-500"
                }`}
              >
                <div className={`text-4xl mb-3 transition-transform duration-300 ${isUnlocked ? 'group-hover:scale-110 group-hover:-rotate-3' : ''}`}>
                  {badge.icon}
                </div>
                <p className={`text-xs font-bold uppercase tracking-wider line-clamp-2 ${isUnlocked ? "text-amber-900" : "text-sage-500"}`}>
                  {badge.nametr}
                </p>
                {isUnlocked && <div className="mt-2 w-1.5 h-1.5 bg-amber-400 rounded-full shadow-[0_0_8px_rgba(251,191,36,0.8)]"></div>}
              </div>
            )
          })}
        </div>
      </div>

      {/* Upcoming */}
      <section>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-display text-sage-900 flex items-center gap-3">
              <Calendar className="text-indigo-500" size={28} /> Yaklaşan Dersler
            </h2>
            <p className="text-sage-500 text-sm mt-1">Planlanmış birebir canlı dersleriniz.</p>
          </div>
          <Link href="/teachers" className="hidden sm:flex bg-white border border-sage-200 text-sage-700 hover:text-sage-900 hover:border-sage-300 px-5 py-2.5 rounded-xl text-sm font-bold items-center gap-2 transition-all shadow-sm btn-press">
            Find More Teachers <ArrowRight size={16} />
          </Link>
        </div>

        {upcomingBookings.length === 0 ? (
          <div className="glass-card p-12 rounded-3xl shadow-sm border border-sage-200/60 text-center animate-scale-in bg-gradient-to-br from-white to-sage-50/50">
            <div className="w-20 h-20 bg-sage-100 text-sage-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
              <Zap size={32} />
            </div>
            <h3 className="text-2xl font-display text-sage-900 mb-2">Matınız sizi bekliyor.</h3>
            <p className="text-sage-500 mb-8 max-w-sm mx-auto">Book your first session with a certified teacher to start your personalized journey.</p>
            <Link href="/teachers" className="inline-flex items-center gap-2 bg-sage-900 text-white px-8 py-3.5 rounded-xl hover:bg-sage-800 transition-all font-bold shadow-lg shadow-sage-900/20 btn-press">
              Browse Teachers <ArrowRight size={18} />
            </Link>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3 stagger-children">
            {upcomingBookings.map((booking: any) => {
              const isNow = new Date(booking.startTime) <= now && new Date(booking.endTime) >= now
              const isConfirmed = booking.status === "CONFIRMED"

              return (
                <div key={booking.id} className={`glass-card p-6 rounded-3xl shadow-sm border ${isNow ? 'border-green-300 bg-green-50/30' : 'border-sage-200/60'} card-hover group flex flex-col`}>
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-sage-100 rounded-full overflow-hidden flex-shrink-0 border-2 border-white shadow-md relative">
                        {booking.teacher.user.image ? (
                          <img src={booking.teacher.user.image} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-sage-500 font-display text-xl">
                            {(booking.teacher.user.name || "T")[0]}
                          </div>
                        )}
                        {isConfirmed && <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>}
                      </div>
                      <div>
                        <h3 className="font-bold text-sage-900 text-lg group-hover:text-sage-700 transition-colors">{booking.teacher.user.name}</h3>
                        <p className="text-xs font-bold uppercase tracking-widest text-sage-500 mt-0.5">Yoga dersi</p>
                      </div>
                    </div>
                    {isNow && (
                      <span className="flex items-center gap-1.5 bg-red-50 text-red-700 px-3 py-1 rounded-full text-[10px] font-bold tracking-widest border border-red-200/50 shadow-sm uppercase">
                        <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" /> Live Now
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-sm text-sage-700 mb-6 p-4 bg-white/60 backdrop-blur-sm rounded-2xl border border-sage-100/50">
                    <span className="flex items-center gap-2 font-semibold">
                      <Calendar size={16} className="text-sage-500" />
                      {new Date(booking.startTime).toLocaleDateString("en-US", { month: "long", day: "numeric" })}
                    </span>
                    <span className="flex items-center gap-2 font-semibold bg-sage-100/50 px-2.5 py-1 rounded-lg">
                      <Clock size={14} className="text-sage-500" />
                      {new Date(booking.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>

                  <div className="mt-auto">
                    {isConfirmed ? (
                      <Link
                        href={`/room?bookingId=${booking.id}`}
                        className={`block text-center w-full px-4 py-3.5 rounded-xl transition-all font-bold btn-press flex items-center justify-center gap-2 ${
                          isNow 
                            ? 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/20' 
                            : 'bg-sage-800 text-white hover:bg-sage-900 shadow-md shadow-sage-800/20'
                        }`}
                      >
                        {isNow ? <><PlayCircle size={18}/> Canlı derse katıl</> : "Bekleme odasına gir"}
                      </Link>
                    ) : (
                      <div className="text-center w-full bg-orange-50 text-orange-700 px-4 py-3.5 rounded-xl text-xs font-bold border border-orange-100/50 uppercase tracking-wider flex items-center justify-center gap-2">
                        <Clock size={14}/> Awaiting Confirmation
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Past Sessions */}
      {pastBookings.length > 0 && (
        <section className="pt-8 border-t border-sage-200/60">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-display text-sage-900 flex items-center gap-3">
              <History className="text-sage-500" size={24} /> Practice History
            </h2>
          </div>
          <div className="glass-card rounded-3xl shadow-sm border border-sage-200/60 overflow-hidden">
            {pastBookings.map((booking: any, i: number) => (
              <div key={booking.id} className={`flex flex-col sm:flex-row sm:items-center justify-between p-5 hover:bg-white/60 transition-colors gap-4 ${i < pastBookings.length - 1 ? "border-b border-sage-100/50" : ""}`}>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-sage-100 shadow-inner border border-white rounded-full flex items-center justify-center overflow-hidden">
                    {booking.teacher.user.image ? (
                      <img src={booking.teacher.user.image} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-sage-600 font-display text-lg font-bold">{(booking.teacher.user.name || "T")[0]}</span>
                    )}
                  </div>
                  <div>
                    <p className="font-bold text-sage-900">{booking.teacher.user.name}</p>
                    <p className="text-sm font-medium text-sage-500 flex items-center gap-1.5 mt-0.5">
                      <Calendar size={12}/> {new Date(booking.startTime).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 sm:ml-auto pl-16 sm:pl-0">
                  {booking.review ? (
                    <div className="flex items-center gap-1 bg-yellow-50 px-3 py-1.5 rounded-full border border-yellow-100/50">
                      <Star size={14} className="text-yellow-500 fill-yellow-500" />
                      <span className="text-yellow-700 text-xs font-bold">{booking.review.rating}.0</span>
                    </div>
                  ) : (
                    <ReviewButton bookingId={booking.id} teacherName={booking.teacher.user.name} />
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <RecordingsList role="student" />
    </div>
  )
}
