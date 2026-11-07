import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-api"
import { listActiveBroadcasts } from "@/lib/live-rooms"
import { OPEN_STATUSES } from "@/lib/reports"

export const dynamic = "force-dynamic"

// GET /api/admin/live-monitor — everything on air, trial-phase (supervised) broadcasts first, with the signals an official needs
export async function GET(req: Request) {
  const g = await requireAdmin(req)
  if ("response" in g) return g.response
  const broadcasts = await listActiveBroadcasts()
  const since = new Date(Date.now() - 24 * 3_600_000)
  const out = await Promise.all(
    broadcasts.map(async (b) => {
      const [reports, violations, teacher] = await Promise.all([
        db.report.count({ where: { targetType: "LIVE_ROOM", targetId: b.id, status: { in: OPEN_STATUSES } } }),
        db.policyViolation.count({ where: { userId: b.teacher.id, createdAt: { gte: since } } }),
        db.teacher.findUnique({ where: { userId: b.teacher.id }, select: { id: true, trialNote: true } }),
      ])
      return { ...b, teacherProfileId: teacher?.id ?? null, openReports: reports, violations24h: violations }
    }),
  )
  out.sort((a, b) => Number(b.supervised) - Number(a.supervised) || b.openReports - a.openReports || b.viewerCount - a.viewerCount)
  return NextResponse.json({ broadcasts: out, supervisedCount: out.filter((b) => b.supervised).length })
}
