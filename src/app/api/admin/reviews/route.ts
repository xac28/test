import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { requireAdmin, pageOf } from "@/lib/admin-api"

export const dynamic = "force-dynamic"

// GET /api/admin/reviews?status=VISIBLE|REMOVED|all&reported=1&q=&page= — teacher reviews for moderation
export async function GET(req: Request) {
  const g = await requireAdmin(req)
  if ("response" in g) return g.response
  const url = new URL(req.url)
  const status = url.searchParams.get("status") || "VISIBLE"
  const q = (url.searchParams.get("q") || "").trim().slice(0, 100)
  const reportedOnly = url.searchParams.get("reported") === "1"
  const { page, size, skip } = pageOf(url, 15)
  const where: any = {}
  if (["VISIBLE", "REMOVED"].includes(status)) where.status = status
  if (q) where.OR = [{ comment: { contains: q } }, { booking: { student: { name: { contains: q } } } }, { booking: { teacher: { user: { name: { contains: q } } } } }]
  if (reportedOnly) {
    const open = await db.report.findMany({ where: { targetType: "REVIEW", status: { in: ["PENDING", "REVIEWED"] } }, select: { targetId: true } })
    where.id = { in: open.map((r) => r.targetId).filter((x): x is string => !!x) }
  }
  const [rows, total, counts] = await Promise.all([
    db.review.findMany({
      where, orderBy: { createdAt: "desc" }, skip, take: size,
      include: { booking: { select: { student: { select: { id: true, name: true, email: true } }, teacher: { select: { id: true, user: { select: { name: true } } } } } } },
    }),
    db.review.count({ where }),
    db.review.groupBy({ by: ["status"], _count: { _all: true } }),
  ])
  const ids = rows.map((r) => r.id)
  const reports = ids.length ? await db.report.groupBy({ by: ["targetId"], where: { targetType: "REVIEW", targetId: { in: ids }, status: { in: ["PENDING", "REVIEWED"] } }, _count: { _all: true } }) : []
  const rep = new Map(reports.map((r) => [r.targetId, r._count._all]))
  const statusCounts: Record<string, number> = { VISIBLE: 0, REMOVED: 0 }
  for (const c of counts) statusCounts[c.status] = c._count._all
  return NextResponse.json({
    reviews: rows.map((r) => ({
      id: r.id, rating: r.rating, comment: r.comment, status: r.status, removedReason: r.removedReason, createdAt: r.createdAt, openReports: rep.get(r.id) ?? 0,
      student: r.booking.student, teacher: { id: r.booking.teacher.id, name: r.booking.teacher.user.name },
    })),
    total, page, pageSize: size, statusCounts,
  })
}
