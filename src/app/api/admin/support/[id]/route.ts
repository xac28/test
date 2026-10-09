import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { requireAdmin, cleanReason } from "@/lib/admin-api"
import { notify } from "@/lib/notifications"
import { SOURCE_LABEL_TR, SUPPORT_MAX, serializeMessage } from "@/lib/support"
import { sanitizeReportText } from "@/lib/reports"

export const dynamic = "force-dynamic"

// GET /api/admin/support/:id?after= — the whole conversation incl. internal notes, plus who the user is
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const g = await requireAdmin(req)
  if ("response" in g) return g.response
  const t = await db.supportTicket.findUnique({ where: { id: params.id }, include: { user: { select: { id: true, name: true, email: true, role: true, banned: true, createdAt: true } } } })
  if (!t) return NextResponse.json({ error: "Talep bulunamadı" }, { status: 404 })
  const after = new URL(req.url).searchParams.get("after")
  const afterDate = after ? new Date(after) : null
  const [messages, interactions, otherTickets, reports] = await Promise.all([
    db.supportMessage.findMany({ where: { ticketId: t.id, ...(afterDate && !isNaN(afterDate.getTime()) ? { createdAt: { gt: afterDate } } : {}) }, orderBy: { createdAt: "asc" }, take: 300 }),
    afterDate ? [] : db.aiInteraction.findMany({ where: { userId: t.userId }, orderBy: { createdAt: "desc" }, take: 8, select: { id: true, message: true, kind: true, helpful: true, createdAt: true } }),
    afterDate ? 0 : db.supportTicket.count({ where: { userId: t.userId, id: { not: t.id } } }),
    afterDate ? 0 : db.report.count({ where: { reportedId: t.userId, status: { in: ["PENDING", "REVIEWED"] } } }),
  ])
  await db.supportTicket.update({ where: { id: t.id }, data: { staffReadAt: new Date() } })
  const names = new Map<string, string>()
  const ids = Array.from(new Set(messages.map((m) => m.senderId).filter((x): x is string => !!x && x !== t.userId)))
  if (ids.length) for (const u of await db.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })) names.set(u.id, u.name ?? "Yetkili")
  const assignee = t.assignedToId ? await db.user.findUnique({ where: { id: t.assignedToId }, select: { name: true } }) : null
  return NextResponse.json({
    ticket: {
      id: t.id, subject: t.subject, source: t.source, sourceLabel: SOURCE_LABEL_TR[t.source] ?? t.source, status: t.status, priority: t.priority, awaitingStaff: t.awaitingStaff,
      assignedToId: t.assignedToId, assignedToName: assignee?.name ?? null, createdAt: t.createdAt, closedAt: t.closedAt, rating: t.rating, ratingComment: t.ratingComment,
    },
    user: t.user, otherTickets, openReportsAgainstUser: reports,
    interactions,
    messages: messages.map((m) => ({ ...serializeMessage(m), senderName: m.role === "STAFF" ? names.get(m.senderId ?? "") ?? "Yetkili" : null })),
  })
}

// POST /api/admin/support/:id { action: reply | note | close | reopen | assign | unassign | priority, content?, priority? }
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const g = await requireAdmin(req)
  if ("response" in g) return g.response
  const t = await db.supportTicket.findUnique({ where: { id: params.id } })
  if (!t) return NextResponse.json({ error: "Talep bulunamadı" }, { status: 404 })
  const body = await req.json().catch(() => ({}))
  const action = String(body.action || "")
  const now = new Date()

  if (action === "reply" || action === "note") {
    const content = sanitizeReportText(body.content, SUPPORT_MAX + 1)
    if (!content) return NextResponse.json({ error: "Mesaj boş olamaz." }, { status: 400 })
    if (content.length > SUPPORT_MAX) return NextResponse.json({ error: `En fazla ${SUPPORT_MAX} karakter.` }, { status: 400 })
    if (action === "reply" && t.status !== "OPEN") return NextResponse.json({ error: "Görüşme kapalı; önce yeniden açın." }, { status: 409 })
    const msg = await db.supportMessage.create({ data: { ticketId: t.id, senderId: g.admin.id, role: action === "reply" ? "STAFF" : "NOTE", content } })
    if (action === "reply") {
      await db.supportTicket.update({
        where: { id: t.id },
        data: { lastMessageAt: msg.createdAt, lastStaffReplyAt: msg.createdAt, awaitingStaff: false, firstReplyAt: t.firstReplyAt ?? msg.createdAt, assignedToId: t.assignedToId ?? g.admin.id },
      })
      await notify({ userId: t.userId, type: "SUPPORT_REPLY", title: "Destek ekibi yanıtladı", body: content.slice(0, 140), href: "/dashboard/support", groupKey: `support:${t.id}` })
    }
    await db.auditLog.create({ data: { actorId: g.admin.id, action: action === "reply" ? "SUPPORT_REPLY" : "SUPPORT_NOTE", targetId: t.id, reason: content.slice(0, 200) } })
    return NextResponse.json({ success: true, message: serializeMessage(msg) })
  }

  if (action === "close") {
    if (t.status === "CLOSED") return NextResponse.json({ error: "Zaten kapalı." }, { status: 409 })
    await db.supportTicket.update({ where: { id: t.id }, data: { status: "CLOSED", closedAt: now, closedById: g.admin.id, awaitingStaff: false } })
    await db.supportMessage.create({ data: { ticketId: t.id, role: "SYSTEM", content: "Görüşme destek ekibi tarafından kapatıldı. Yardımcı olabildiysek ne mutlu! Bir sorunun olursa yeniden yazabilirsin." } })
    await notify({ userId: t.userId, type: "SUPPORT_REPLY", title: "Destek görüşmen kapatıldı", body: "Memnuniyetini puanlayabilirsin.", href: "/dashboard/support" })
  } else if (action === "reopen") {
    if (t.status === "OPEN") return NextResponse.json({ error: "Zaten açık." }, { status: 409 })
    if (await db.supportTicket.findFirst({ where: { userId: t.userId, status: "OPEN" } })) return NextResponse.json({ error: "Kullanıcının zaten açık bir talebi var." }, { status: 409 })
    await db.supportTicket.update({ where: { id: t.id }, data: { status: "OPEN", closedAt: null, closedById: null, awaitingStaff: true } })
    await db.supportMessage.create({ data: { ticketId: t.id, role: "SYSTEM", content: "Görüşme yeniden açıldı." } })
  } else if (action === "assign") {
    await db.supportTicket.update({ where: { id: t.id }, data: { assignedToId: g.admin.id } })
  } else if (action === "unassign") {
    await db.supportTicket.update({ where: { id: t.id }, data: { assignedToId: null } })
  } else if (action === "priority") {
    if (!["LOW", "NORMAL", "HIGH"].includes(body.priority)) return NextResponse.json({ error: "Geçersiz öncelik" }, { status: 400 })
    await db.supportTicket.update({ where: { id: t.id }, data: { priority: body.priority } })
  } else return NextResponse.json({ error: "Geçersiz işlem" }, { status: 400 })

  await db.auditLog.create({ data: { actorId: g.admin.id, action: `SUPPORT_${action.toUpperCase()}`, targetId: t.id, reason: cleanReason(body.priority) || null } })
  return NextResponse.json({ success: true })
}
