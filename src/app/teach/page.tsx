import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import Link from "next/link"
import { Calendar, Clock, DollarSign, Users, TrendingUp, ArrowRight, PlayCircle, Star, Zap, History, ShieldCheck } from "lucide-react"
import { GoLiveButton } from "@/components/go-live-button"
import { StripeConnectButton } from "@/components/stripe-connect-button"
import { TeacherVideoManager } from "@/components/teacher-video-manager"
import { RecordingsList } from "@/components/recordings-list"

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
          <p className="text-sage-600 text-lg mb-6">Teacher profile not found.</p>
          <Link href="/become-teacher" className="bg-sage-600 text-white px-8 py-3 rounded-full btn-press inline-block font-medium w-full text-center hover:bg-sage-700 transition">Apply to Teach</Link>
        </div>
      </div>
    )
  }

  const now = new Date()

  const upcomingBookings = await db.booking.findMany({
    where: {
      teacherId: teacher.id,
      startTime: { gte: now },
      status: { in: ["CONFIRMED", "PENDING"] },
    },
    include: { student: true },
    orderBy: { startTime: "asc" },
    take: 6,
  })

  const completedBookings = await db.booking.findMany({
    where: { teacherId: teacher.id, status: "COMPLETED" },
    orderBy: { startTime: "desc" },
    take: 5,
    include: { student: true, review: true },
  })

  const totalCompleted = await db.booking.count({
    where: { teacherId: teacher.id, status: "COMPLETED" },
  })

  // Calculate earnings
  const allCompleted = await db.booking.findMany({
    where: { teacherId: teacher.id, status: "COMPLETED" },
    select: { price: true },
  })
  const grossEarnings = allCompleted.reduce((sum, b) => sum + b.price, 0)
  const netEarnings = grossEarnings * (1 - teacher.commissionRate)

  const videos = await db.teacherVideo.findMany({
    where: { teacherId: teacher.id },
    orderBy: { createdAt: "desc" }
  })

  // Unique students
  const uniqueStudents = await db.booking.groupBy({
    by: ["studentId"],
    where: { teacherId: teacher.id },
  })

  // Active live room
  const activeLiveRoom = await db.liveRoom.findFirst({
    where: { teacherId: teacher.id, isActive: true },
  })

  return (
    <div className="space-y-12 animate-fade-in stagger-children pb-12">
      {/* Premium Header */}
      <div className="relative overflow-hidden rounded-[2rem] bg-sage-900 text-white p-8 md:p-12 shadow-2xl shadow-sage-900/20">
        {teacher.isTrialMode && (
          <div className="absolute top-0 right-0 bg-gradient-to-r from-amber-400 to-orange-500 text-white text-xs font-bold px-6 py-1.5 rounded-bl-2xl shadow-md z-20 flex items-center gap-1.5 uppercase tracking-widest">
            <Zap size={14}/> Trial Mode
          </div>
        )}
        <div className="absolute top-0 right-0 w-full h-full opacity-10 pointer-events-none">
          <svg className="absolute right-0 top-0 h-full w-1/2" viewBox="0 0 100 100" preserveAspectRatio="none" fill="none" stroke="currentColor" strokeWidth="0.5">
            <path d="M0,100 C30,60 70,40 100,0 L100,100 Z" fill="currentColor" opacity="0.2"/>
            <path d="M20,100 C50,50 80,30 100,0 L100,100 Z" fill="currentColor" opacity="0.4"/>
          </svg>
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-8">
          <div>
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest text-sage-200 mb-4 border border-white/10">
              <ShieldCheck size={14} className="text-green-400" /> Instructor Portal
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-display text-white mb-2 leading-tight">Welcome back,<br/><span className="text-sage-200 italic">{session.user.name || "Teacher"}</span></h1>
            <p className="text-sage-400 max-w-md">Manage your classes, track earnings, and engage with your students globally.</p>
          </div>
        </div>
      </div>

      {teacher.isTrialMode && (
        <div className="bg-amber-50 border border-amber-200 p-6 rounded-3xl shadow-sm relative overflow-hidden">
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h2 className="text-xl font-bold text-amber-900 mb-2 flex items-center gap-2">
                <span className="bg-amber-200 text-amber-800 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">1</span> 
                Deneme Aşamasındasınız
              </h2>
              <p className="text-amber-800/80 text-sm max-w-2xl leading-relaxed">
                Tebrikler, eğitmenlik başvurunuz onaylandı! Ancak platformda öğrencilere ders açmaya başlamadan önce Namaste yetkilileriyle <strong>5 dakikalık bir deneme canlı yayını</strong> yapmanız gerekmektedir. Bu yayın sonrası profiliniz tamamen aktif olacaktır.
              </p>
            </div>
            <Link 
              href={`/room/trial-${teacher.id}`}
              className="whitespace-nowrap bg-amber-500 hover:bg-amber-600 text-white px-6 py-3 rounded-full font-medium transition shadow-lg shadow-amber-500/20 flex items-center gap-2"
            >
              Deneme Yayınını Başlat
            </Link>
          </div>
          <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-amber-400 opacity-10 rounded-full blur-3xl"></div>
        </div>
      )}

      {/* Go Live Now — Instant Session */}
      {!teacher.isTrialMode && (
        <GoLiveButton activeLiveRoom={activeLiveRoom ? JSON.parse(JSON.stringify(activeLiveRoom)) : null} />
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 stagger-children">
        <div className="glass-card p-6 md:p-8 rounded-3xl shadow-sm border border-sage-200/60 card-hover bg-gradient-to-b from-white to-sage-50/30 group">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-green-100/50 text-green-600 rounded-2xl flex items-center justify-center shadow-inner border border-green-200 group-hover:scale-110 transition-transform">
              <DollarSign size={24} />
            </div>
          </div>
          <p className="text-4xl lg:text-5xl font-display text-sage-900 animate-count">${netEarnings.toFixed(2)}</p>
          <p className="text-[10px] md:text-xs text-sage-500 uppercase tracking-widest mt-2 font-bold">Net Earnings</p>
        </div>
        <div className="glass-card p-6 md:p-8 rounded-3xl shadow-sm border border-sage-200/60 card-hover bg-gradient-to-b from-white to-sage-50/30 group">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-blue-100/50 text-blue-600 rounded-2xl flex items-center justify-center shadow-inner border border-blue-200 group-hover:scale-110 transition-transform">
              <Calendar size={24} />
            </div>
          </div>
          <p className="text-4xl lg:text-5xl font-display text-sage-900 animate-count" style={{ animationDelay: '100ms' }}>{totalCompleted}</p>
          <p className="text-[10px] md:text-xs text-sage-500 uppercase tracking-widest mt-2 font-bold">Total Sessions</p>
        </div>
        <div className="glass-card p-6 md:p-8 rounded-3xl shadow-sm border border-sage-200/60 card-hover bg-gradient-to-b from-white to-sage-50/30 group">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-purple-100/50 text-purple-600 rounded-2xl flex items-center justify-center shadow-inner border border-purple-200 group-hover:scale-110 transition-transform">
              <Users size={24} />
            </div>
          </div>
          <p className="text-4xl lg:text-5xl font-display text-sage-900 animate-count" style={{ animationDelay: '200ms' }}>{uniqueStudents.length}</p>
          <p className="text-[10px] md:text-xs text-sage-500 uppercase tracking-widest mt-2 font-bold">Students</p>
        </div>
        <div className="glass-card p-6 md:p-8 rounded-3xl shadow-sm border border-sage-200/60 card-hover bg-gradient-to-b from-white to-sage-50/30 group">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-orange-100/50 text-orange-600 rounded-2xl flex items-center justify-center shadow-inner border border-orange-200 group-hover:scale-110 transition-transform">
              <TrendingUp size={24} />
            </div>
          </div>
          <p className="text-4xl lg:text-5xl font-display text-sage-900 animate-count" style={{ animationDelay: '300ms' }}>{(teacher.commissionRate * 100).toFixed(0)}%</p>
          <p className="text-[10px] md:text-xs text-sage-500 uppercase tracking-widest mt-2 font-bold">Commission</p>
        </div>
      </div>

      {/* Stripe Connect Notice */}
      <StripeConnectButton isConnected={!!teacher.stripeConnectId} />

      {/* Upcoming */}
      <section>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-display text-sage-900 flex items-center gap-3">
              <Calendar className="text-indigo-500" size={28} /> Upcoming Classes
            </h2>
            <p className="text-sage-500 text-sm mt-1">Your scheduled live sessions with students.</p>
          </div>
        </div>
        {upcomingBookings.length === 0 ? (
          <div className="glass-card p-12 rounded-3xl shadow-sm border border-sage-200/60 text-center animate-scale-in bg-gradient-to-br from-white to-sage-50/50">
            <div className="w-20 h-20 bg-sage-100 text-sage-400 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
              <Calendar size={32} />
            </div>
            <p className="text-sage-500 text-lg">No upcoming classes. Students can book you through your profile.</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 stagger-children">
            {upcomingBookings.map((booking: any) => {
              const isNow = new Date(booking.startTime) <= now && new Date(booking.endTime) >= now
              const isConfirmed = booking.status === "CONFIRMED"

              return (
                <div key={booking.id} className={`glass-card p-6 rounded-3xl shadow-sm border ${isNow ? 'border-green-300 bg-green-50/30' : 'border-sage-200/60'} card-hover group flex flex-col`}>
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-sage-100 rounded-full overflow-hidden flex-shrink-0 border-2 border-white shadow-md relative">
                        {booking.student.image ? (
                          <img src={booking.student.image} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-sage-500 font-display text-xl">
                            {(booking.student.name || "S")[0]}
                          </div>
                        )}
                        {isConfirmed && <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>}
                      </div>
                      <div>
                        <h3 className="font-bold text-sage-900 text-lg group-hover:text-sage-700 transition-colors">{booking.student.name || "Student"}</h3>
                        <p className="text-xs font-bold uppercase tracking-widest text-green-600 mt-0.5">${booking.price.toFixed(2)}</p>
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
                      <Calendar size={16} className="text-sage-400" />
                      {new Date(booking.startTime).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
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
                        {isNow ? <><PlayCircle size={18}/> Start Live Class</> : "Open Class Room"}
                      </Link>
                    ) : (
                      <div className="text-center w-full bg-orange-50 text-orange-700 px-4 py-3.5 rounded-xl text-xs font-bold border border-orange-100/50 uppercase tracking-wider flex items-center justify-center gap-2">
                        <Clock size={14}/> Pending Payment
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
      {completedBookings.length > 0 && (
        <section className="pt-8 border-t border-sage-200/60">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-display text-sage-900 flex items-center gap-3">
              <History className="text-sage-500" size={24} /> Recent Sessions
            </h2>
          </div>
          <div className="glass-card rounded-3xl shadow-sm border border-sage-200/60 overflow-hidden">
            {completedBookings.map((booking: any, i: number) => (
              <div key={booking.id} className={`flex flex-col sm:flex-row sm:items-center justify-between p-5 hover:bg-white/60 transition-colors gap-4 ${i < completedBookings.length - 1 ? "border-b border-sage-100/50" : ""}`}>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-sage-100 shadow-inner border border-white rounded-full flex items-center justify-center overflow-hidden">
                    {booking.student.image ? (
                      <img src={booking.student.image} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-sage-600 font-display text-lg font-bold">{(booking.student.name || "S")[0]}</span>
                    )}
                  </div>
                  <div>
                    <p className="font-bold text-sage-900">{booking.student.name || "Student"}</p>
                    <p className="text-sm font-medium text-sage-500 flex items-center gap-1.5 mt-0.5">
                      <Calendar size={12}/> {new Date(booking.startTime).toLocaleDateString("en-US", { month: "long", day: "numeric" })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 sm:ml-auto pl-16 sm:pl-0">
                  {booking.review && (
                    <div className="flex items-center gap-1 bg-yellow-50 px-3 py-1.5 rounded-full border border-yellow-100/50">
                      <Star size={14} className="text-yellow-500 fill-yellow-500" />
                      <span className="text-yellow-700 text-xs font-bold">{booking.review.rating}.0</span>
                    </div>
                  )}
                  <span className="text-green-700 font-bold px-3 py-1.5 bg-green-50 rounded-full shadow-sm border border-green-200 flex items-center gap-1">
                    <DollarSign size={14}/> {(booking.price * (1 - teacher.commissionRate)).toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <RecordingsList role="teacher" />

      {/* Video Management Section */}
      <TeacherVideoManager initialVideos={JSON.parse(JSON.stringify(videos))} />
    </div>
  )
}
