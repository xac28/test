import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { requireAdmin, pageOf } from "@/lib/admin-api"

export const dynamic = "force-dynamic"

// GET /api/admin/workshops?status=&q=&page=
export async function GET(req: Request) {
  const g = await requireAdmin(req)
  if ("response" in g) return g.response
  const url = new URL(req.url)
  const status = url.searchParams.get("status") || "all"
  const q = (url.searchParams.get("q") || "").trim().slice(0, 100)
  const { page, size, skip } = pageOf(url)
  const where: any = {}
  if (["DRAFT", "PUBLISHED", "CANCELLED"].includes(status)) where.status = status
  if (q) where.OR = [{ title: { contains: q } }, { id: q }, { teacher: { user: { name: { contains: q } } } }]

  const [rows, total] = await Promise.all([
    db.workshop.findMany({
      where, orderBy: { createdAt: "desc" }, skip, take: size,
      include: { teacher: { select: { user: { select: { id: true, name: true } } } }, _count: { select: { enrollments: true } } },
    }),
    db.workshop.count({ where }),
  ])
  const ids = rows.map((r) => r.id)
  const reports = ids.length
    ? await db.report.groupBy({ by: ["targetId"], where: { targetType: "WORKSHOP", targetId: { in: ids }, status: { in: ["PENDING", "REVIEWED"] } }, _count: { _all: true } })
    : []
  const rep = new Map(reports.map((r) => [r.targetId, r._count._all]))
  return NextResponse.json({
    workshops: rows.map((w) => ({
      id: w.id, slug: w.slug, title: w.title, status: w.status, mode: w.mode, startsAt: w.startsAt, priceUsd: w.priceUsd, capacity: w.capacity,
      enrollments: w._count.enrollments, openReports: rep.get(w.id) ?? 0, teacher: { id: w.teacher.user.id, name: w.teacher.user.name },
    })),
    total, page, pageSize: size,
  })
}
