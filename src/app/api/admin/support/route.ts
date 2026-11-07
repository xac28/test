import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { requireAdmin, pageOf, wantsCsv, CSV_LIMIT } from "@/lib/admin-api"
import { csvResponse, toCsv } from "@/lib/csv"
import { SOURCE_LABEL_TR } from "@/lib/support"

export const dynamic = "force-dynamic"

// GET /api/admin/support?status=waiting|open|mine|closed|all&q=&page=&format=csv — the live-support queue
export async function GET(req: Request) {
  const g = await requireAdmin(req)
  if ("response" in g) return g.response
  const url = new URL(req.url)
  const status = url.searchParams.get("status") || "waiting"
  const q = (url.searchParams.get("q") || "").trim().slice(0, 100)
  const csv = wantsCsv(url)
  const { page, size, skip } = pageOf(url, 20)
  const where: any = {}
  if (status === "waiting") Object.assign(where, { status: "OPEN", awaitingStaff: true })
  else if (status === "open") where.status = "OPEN"
  else if (status === "mine") Object.assign(where, { status: "OPEN", assignedToId: g.admin.id })
  else if (status === "closed") where.status = "CLOSED"
  if (q) where.OR = [{ subject: { contains: q } }, { user: { name: { contains: q } } }, { user: { email: { contains: q } } }, { id: q }]
  const [rows, total, waiting, open, closed, rated, firstReplies] = await Promise.all([
    db.supportTicket.findMany({
      where, orderBy: status === "closed" || status === "all" ? { lastMessageAt: "desc" } : { lastMessageAt: "asc" }, skip: csv ? 0 : skip, take: csv ? CSV_LIMIT : size,
      include: { user: { select: { id: true, name: true, email: true } }, _count: { select: { messages: true } } },
    }),
    db.supportTicket.count({ where }),
    db.supportTicket.count({ where: { status: "OPEN", awaitingStaff: true } }),
    db.supportTicket.count({ where: { status: "OPEN" } }),
    db.supportTicket.count({ where: { status: "CLOSED" } }),
    db.supportTicket.aggregate({ where: { rating: { not: null } }, _avg: { rating: true }, _count: { rating: true } }),
    db.supportTicket.findMany({ where: { firstReplyAt: { not: null } }, orderBy: { createdAt: "desc" }, take: 200, select: { createdAt: true, firstReplyAt: true } }),
  ])
  if (csv) {
    return csvResponse("destek-talepleri", toCsv(["Açılış", "Üye", "E-posta", "Konu", "Kaynak", "Durum", "Mesaj", "İlk yanıt (dk)", "Puan"], rows.map((r) => [
      r.createdAt, r.user.name, r.user.email, r.subject, SOURCE_LABEL_TR[r.source] ?? r.source, r.status, r._count.messages,
      r.firstReplyAt ? Math.round((r.firstReplyAt.getTime() - r.createdAt.getTime()) / 60000) : "", r.rating ?? "",
    ])))
  }
  const avgFirstReplyMin = firstReplies.length ? Math.round(firstReplies.reduce((s, t) => s + (t.firstReplyAt!.getTime() - t.createdAt.getTime()), 0) / firstReplies.length / 60000) : null
  return NextResponse.json({
    tickets: rows.map((t) => ({
      id: t.id, subject: t.subject, source: t.source, status: t.status, priority: t.priority, awaitingStaff: t.awaitingStaff, assignedToId: t.assignedToId,
      createdAt: t.createdAt, lastMessageAt: t.lastMessageAt, messageCount: t._count.messages, rating: t.rating, user: t.user,
    })),
    total, page, pageSize: size,
    stats: { waiting, open, closed, avgRating: rated._avg.rating ? Math.round(rated._avg.rating * 10) / 10 : null, ratedCount: rated._count.rating, avgFirstReplyMin },
  })
}
