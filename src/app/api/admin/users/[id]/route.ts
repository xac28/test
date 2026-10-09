import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-api"
import { isBannableIp } from "@/lib/ban-engine"

export const dynamic = "force-dynamic"

// GET /api/admin/users/:id — profile, teacher state, reports, warnings, IP history and recent admin actions
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const g = await requireAdmin(req)
  if ("response" in g) return g.response
  const id = params.id
  const user = await db.user.findUnique({
    where: { id },
    select: {
      id: true, name: true, email: true, image: true, role: true, phone: true, country: true, createdAt: true,
      banned: true, banReason: true, bannedAt: true, termsAcceptedAt: true, termsVersion: true, profileCompleted: true,
      teacher: { select: { id: true, isTrialMode: true, trialNote: true, trialReviewedAt: true, hourlyRate: true, commissionRate: true } },
    },
  })
  if (!user) return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 })

  const [studentBookings, teacherBookings, enrollments, reportsMade, reportsAgainst, warnings, ipLogs, audit, evasions] = await Promise.all([
    db.booking.count({ where: { studentId: id } }),
    user.teacher ? db.booking.count({ where: { teacherId: user.teacher.id } }) : 0,
    db.workshopEnrollment.count({ where: { userId: id } }),
    db.report.count({ where: { reporterId: id } }),
    db.report.findMany({
      where: { reportedId: id },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, category: true, targetType: true, status: true, priority: true, createdAt: true },
    }),
    db.userWarning.findMany({ where: { userId: id }, orderBy: { createdAt: "desc" }, take: 10, select: { id: true, message: true, createdAt: true, acknowledgedAt: true } }),
    db.userIpLog.findMany({ where: { userId: id }, orderBy: { lastSeenAt: "desc" }, take: 10 }),
    db.auditLog.findMany({ where: { targetId: id }, orderBy: { createdAt: "desc" }, take: 15, include: { actor: { select: { name: true } } } }),
    db.banEvasionLog.count({ where: { matchedUserId: id } }),
  ])
  const bannedIps = ipLogs.length
    ? await db.ipBan.findMany({ where: { isActive: true, ipAddress: { in: ipLogs.map((l) => l.ipAddress) } }, select: { ipAddress: true } })
    : []
  const bannedSet = new Set(bannedIps.map((b) => b.ipAddress))

  return NextResponse.json({
    user,
    stats: { studentBookings, teacherBookings, enrollments, reportsMade, evasions },
    reportsAgainst,
    warnings,
    ips: ipLogs.map((l) => ({ ip: l.ipAddress, lastSeenAt: l.lastSeenAt, hits: l.hitCount, banned: bannedSet.has(l.ipAddress), bannable: isBannableIp(l.ipAddress) })),
    audit: audit.map((a) => ({ id: a.id, action: a.action, reason: a.reason, actor: a.actor?.name ?? "Sistem", createdAt: a.createdAt })),
  })
}
