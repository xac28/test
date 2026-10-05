import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-api"
import { OPEN_STATUSES } from "@/lib/reports"

export const dynamic = "force-dynamic"

// GET /api/admin/badges — the small numbers next to the tabs
export async function GET(req: Request) {
  const g = await requireAdmin(req)
  if ("response" in g) return g.response
  const [applications, trials, payouts, reports, urgentReports, liveNow, pendingPosts, openSupport, aiUnknown, reviewReports, policyToday, supervisedLive] = await Promise.all([
    db.teacherApplication.count({ where: { status: "PENDING" } }),
    db.teacher.count({ where: { isTrialMode: true } }),
    db.payoutRequest.count({ where: { status: "PENDING" } }),
    db.report.count({ where: { status: { in: OPEN_STATUSES } } }),
    db.report.count({ where: { status: { in: OPEN_STATUSES }, priority: "URGENT" } }),
    db.liveRoom.count({ where: { isActive: true } }),
    db.post.count({ where: { status: "PENDING" } }),
    db.supportTicket.count({ where: { status: "OPEN", awaitingStaff: true } }),
    db.aiInteraction.count({ where: { kind: "unknown", taught: false, dismissed: false } }),
    db.report.count({ where: { targetType: "REVIEW", status: { in: OPEN_STATUSES } } }),
    db.policyViolation.count({ where: { counted: true, forgiven: false, createdAt: { gte: new Date(Date.now() - 86_400_000) } } }),
    db.liveRoom.count({ where: { isActive: true, supervised: true } }),
  ])
  return NextResponse.json({ applications, trials, payouts, reports, urgentReports, liveNow, pendingPosts, openSupport, aiUnknown, reviewReports, policyToday, supervisedLive })
}
