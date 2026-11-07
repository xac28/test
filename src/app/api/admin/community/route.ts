import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { requireAdmin, pageOf } from "@/lib/admin-api"

export const dynamic = "force-dynamic"

// GET /api/admin/community?status=PENDING|VISIBLE|REMOVED|all&q=&page= — photos for review
export async function GET(req: Request) {
  const g = await requireAdmin(req)
  if ("response" in g) return g.response
  const url = new URL(req.url)
  const status = url.searchParams.get("status") || "PENDING"
  const q = (url.searchParams.get("q") || "").trim().slice(0, 100)
  const { page, size, skip } = pageOf(url, 12)
  const where: any = {}
  if (["PENDING", "VISIBLE", "REMOVED"].includes(status)) where.status = status
  if (q) where.OR = [{ content: { contains: q } }, { author: { name: { contains: q } } }, { author: { email: { contains: q } } }, { id: q }]
  const [rows, total, counts] = await Promise.all([
    db.post.findMany({ where, orderBy: status === "PENDING" ? { createdAt: "asc" } : { createdAt: "desc" }, skip, take: size, include: { author: { select: { id: true, name: true, email: true, image: true, banned: true } } } }),
    db.post.count({ where }),
    db.post.groupBy({ by: ["status"], _count: { _all: true } }),
  ])
  const ids = rows.map((r) => r.id)
  const reports = ids.length ? await db.report.groupBy({ by: ["targetId"], where: { targetType: "POST", targetId: { in: ids }, status: { in: ["PENDING", "REVIEWED"] } }, _count: { _all: true } }) : []
  const rep = new Map(reports.map((r) => [r.targetId, r._count._all]))
  const statusCounts: Record<string, number> = { PENDING: 0, VISIBLE: 0, REMOVED: 0 }
  for (const c of counts) statusCounts[c.status] = c._count._all
  return NextResponse.json({
    posts: rows.map((p) => ({
      id: p.id, content: p.content, title: p.title, image: p.image, status: p.status, removedReason: p.removedReason, likeCount: p.likeCount, commentCount: p.commentCount,
      createdAt: p.createdAt, openReports: rep.get(p.id) ?? 0, author: p.author,
    })),
    total, page, pageSize: size, statusCounts,
  })
}
