import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { requireAdmin, pageOf } from "@/lib/admin-api"

export const dynamic = "force-dynamic"

// GET /api/admin/community/comments?status=VISIBLE|REMOVED|all&q=&page=
export async function GET(req: Request) {
  const g = await requireAdmin(req)
  if ("response" in g) return g.response
  const url = new URL(req.url)
  const status = url.searchParams.get("status") || "VISIBLE"
  const q = (url.searchParams.get("q") || "").trim().slice(0, 100)
  const { page, size, skip } = pageOf(url, 20)
  const where: any = {}
  if (["VISIBLE", "REMOVED"].includes(status)) where.status = status
  if (q) where.OR = [{ content: { contains: q } }, { author: { name: { contains: q } } }, { author: { email: { contains: q } } }]
  const [rows, total] = await Promise.all([
    db.comment.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: size, include: { author: { select: { id: true, name: true, email: true } }, post: { select: { id: true, content: true } } } }),
    db.comment.count({ where }),
  ])
  return NextResponse.json({
    comments: rows.map((c) => ({ id: c.id, content: c.content, status: c.status, removedReason: c.removedReason, createdAt: c.createdAt, author: c.author, post: { id: c.post.id, excerpt: c.post.content.slice(0, 80) } })),
    total, page, pageSize: size,
  })
}
