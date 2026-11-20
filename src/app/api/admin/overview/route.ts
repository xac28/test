import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-api"
import { OPEN_STATUSES } from "@/lib/reports"
import { livekitRoomService } from "@/lib/livekit"

export const dynamic = "force-dynamic"
const DAY = 86_400_000
const DAYS = 14

function series(dates: Date[]): { day: string; count: number }[] {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const buckets: { day: string; count: number }[] = []
  for (let i = DAYS - 1; i >= 0; i--) buckets.push({ day: new Date(start.getTime() - i * DAY).toISOString().slice(0, 10), count: 0 })
  const index = new Map(buckets.map((b, i) => [b.day, i]))
  for (const d of dates) {
    const local = new Date(d)
    local.setHours(0, 0, 0, 0)
    const i = index.get(local.toISOString().slice(0, 10))
    if (i !== undefined) buckets[i].count++
  }
  return buckets
}

async function check<T>(fn: () => Promise<T>, ms = 2500): Promise<boolean> {
  try {
    await Promise.race([fn(), new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))])
    return true
  } catch {
    return false
  }
}

// GET /api/admin/overview — the action queue, platform numbers, 14-day trend and system health
export async function GET(req: Request) {
  const g = await requireAdmin(req)
  if ("response" in g) return g.response

  const since = new Date(Date.now() - DAYS * DAY)
  const week = new Date(Date.now() - 7 * DAY)
  const [
    users, teachers, trialTeachers, bookings, bookings7d, pendingApps, pendingPayouts, openReports, urgentReports,
    liveNow, bannedUsers, newUsers, newBookings, newReports, recentAudit, paid, workshopsPublished, evasions24h, oldestOpen,
  ] = await Promise.all([
    db.user.count(),
    db.teacher.count(),
    db.teacher.count({ where: { isTrialMode: true } }),
    db.booking.count(),
    db.booking.count({ where: { createdAt: { gte: week } } }),
    db.teacherApplication.count({ where: { status: "PENDING" } }),
    db.payoutRequest.aggregate({ where: { status: "PENDING" }, _count: { _all: true }, _sum: { amount: true } }),
    db.report.count({ where: { status: { in: OPEN_STATUSES } } }),
    db.report.count({ where: { status: { in: OPEN_STATUSES }, priority: "URGENT" } }),
    db.liveRoom.count({ where: { isActive: true } }),
    db.user.count({ where: { banned: true } }),
    db.user.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
    db.booking.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
    db.report.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
    db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 8, include: { actor: { select: { name: true } } } }),
    db.booking.findMany({ where: { status: { in: ["CONFIRMED", "COMPLETED"] } }, select: { price: true, teacher: { select: { commissionRate: true } } } }),
    db.workshop.count({ where: { status: "PUBLISHED" } }),
    db.banEvasionLog.count({ where: { createdAt: { gte: new Date(Date.now() - DAY) } } }),
    db.report.findFirst({ where: { status: { in: OPEN_STATUSES } }, orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
  ])

  let volume = 0
  let revenue = 0
  for (const b of paid) {
    volume += b.price
    revenue += b.price * b.teacher.commissionRate
  }

  const [dbOk, livekitOk] = await Promise.all([
    check(() => db.$queryRaw`SELECT 1`),
    check(() => livekitRoomService().listRooms()),
  ])
  const health = [
    { id: "db", label: "Veritabanı", ok: dbOk, detail: dbOk ? "Bağlantı sağlıklı" : "Veritabanına ulaşılamıyor" },
    { id: "livekit", label: "Canlı yayın sunucusu (LiveKit)", ok: livekitOk, detail: livekitOk ? "Yanıt veriyor" : "Yanıt vermiyor — yayınlar çalışmaz" },
    { id: "email", label: "E-posta (SMTP)", ok: !!(process.env.SMTP_USER && process.env.SMTP_PASS), detail: process.env.SMTP_USER ? "Yapılandırıldı" : "SMTP_USER / SMTP_PASS tanımlı değil — bildirim e-postaları gönderilmez" },
    { id: "payments", label: "Ödeme sağlayıcı", ok: !!(process.env.STRIPE_SECRET_KEY?.startsWith("sk_") || process.env.IYZICO_API_KEY), detail: process.env.STRIPE_SECRET_KEY || process.env.IYZICO_API_KEY ? "Anahtar tanımlı" : "Anahtar yok — rezervasyonlar test modunda otomatik onaylanır" },
    { id: "https", label: "Güvenli bağlantı (HTTPS)", ok: (process.env.NEXTAUTH_URL || "").startsWith("https://"), detail: (process.env.NEXTAUTH_URL || "").startsWith("https://") ? "NEXTAUTH_URL https" : "NEXTAUTH_URL https değil (yalnızca geliştirme için uygun)" },
  ]

  return NextResponse.json({
    queue: {
      urgentReports,
      openReports,
      oldestOpenReportAt: oldestOpen?.createdAt ?? null,
      pendingApplications: pendingApps,
      trialTeachers,
      pendingPayouts: pendingPayouts._count._all,
      pendingPayoutAmount: pendingPayouts._sum.amount ?? 0,
    },
    totals: { users, teachers, bookings, bookings7d, workshopsPublished, liveNow, bannedUsers, evasions24h, volume, revenue },
    series: { users: series(newUsers.map((u) => u.createdAt)), bookings: series(newBookings.map((u) => u.createdAt)), reports: series(newReports.map((u) => u.createdAt)) },
    recentAudit: recentAudit.map((a) => ({ id: a.id, action: a.action, reason: a.reason, targetId: a.targetId, actor: a.actor?.name ?? "Sistem", createdAt: a.createdAt })),
    health,
  })
}
