import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { resolveUser } from "@/lib/auth-utils"
import { applyRateLimit } from "@/lib/api-protection"
import { RATE_LIMIT_API, RATE_LIMIT_WRITE } from "@/lib/rate-limit"
import { notifyAdminsInApp } from "@/lib/notifications"
import { cleanSupportText, serializeMessage } from "@/lib/support"

export const dynamic = "force-dynamic"

async function mine(req: Request, id: string) {
  const user = await resolveUser(req)
  if (!user) return { error: NextResponse.json({ error: "Giriş yapın." }, { status: 401 }) }
  const ticket = await db.supportTicket.findUnique({ where: { id } })
  if (!ticket || ticket.userId !== user.id) return { error: NextResponse.json({ error: "Talep bulunamadı." }, { status: 404 }) }
  return { user, ticket }
}

// GET /api/support/:id?after=<iso> — messages (for polling) and the ticket state
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const blocked = applyRateLimit(req, { maxRequests: 120, windowMs: 60_000 })
  if (blocked) return blocked
  const g = await mine(req, params.id)
  if ("error" in g) return g.error
  const after = new URL(req.url).searchParams.get("after")
  const afterDate = after ? new Date(after) : null
  const messages = await db.supportMessage.findMany({
    where: { ticketId: g.ticket.id, role: { not: "NOTE" }, ...(afterDate && !isNaN(afterDate.getTime()) ? { createdAt: { gt: afterDate } } : {}) },
    orderBy: { createdAt: "asc" }, take: 200,
  })
  await db.supportTicket.update({ where: { id: g.ticket.id }, data: { userReadAt: new Date() } })
  // opening the conversation clears its notification
  await db.notification.updateMany({ where: { userId: g.user.id, type: "SUPPORT_REPLY", readAt: null }, data: { readAt: new Date() } })
  return NextResponse.json({
    ticket: { id: g.ticket.id, subject: g.ticket.subject, status: g.ticket.status, awaitingStaff: g.ticket.awaitingStaff, rating: g.ticket.rating, closedAt: g.ticket.closedAt },
    messages: messages.map(serializeMessage),
  })
}

// POST /api/support/:id { content } — write in an open conversation
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const blocked = applyRateLimit(req, RATE_LIMIT_WRITE)
  if (blocked) return blocked
  const g = await mine(req, params.id)
  if ("error" in g) return g.error
  if (g.ticket.status !== "OPEN") return NextResponse.json({ error: "Bu görüşme kapatıldı. Yeni bir talep açabilirsin." }, { status: 409 })
  const body = await req.json().catch(() => ({}))
  const text = cleanSupportText(body.content)
  if (!text.ok) return NextResponse.json({ error: text.error }, { status: 400 })
  const wasAwaiting = g.ticket.awaitingStaff
  const msg = await db.supportMessage.create({ data: { ticketId: g.ticket.id, senderId: g.user.id, role: "USER", content: text.text } })
  await db.supportTicket.update({ where: { id: g.ticket.id }, data: { lastMessageAt: msg.createdAt, awaitingStaff: true } })
  // the team is told once per waiting stretch, not for every line of a long message series
  if (!wasAwaiting) await notifyAdminsInApp("Destek: yeni yanıt", `${g.user.name ?? "Bir üye"}: ${text.text.slice(0, 100)}`, "/admin?tab=support")
  return NextResponse.json({ success: true, message: serializeMessage(msg) })
}

// PATCH /api/support/:id { action: "close", rating?, comment? } — the member ends the conversation and may rate it
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const blocked = applyRateLimit(req, RATE_LIMIT_WRITE)
  if (blocked) return blocked
  const g = await mine(req, params.id)
  if ("error" in g) return g.error
  const body = await req.json().catch(() => ({}))
  if (body.action === "rate") {
    if (g.ticket.status !== "CLOSED") return NextResponse.json({ error: "Önce görüşmeyi kapat." }, { status: 409 })
    const rating = Number(body.rating)
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return NextResponse.json({ error: "1-5 arası bir puan seçin." }, { status: 400 })
    const comment = typeof body.comment === "string" ? body.comment.replace(/\s+/g, " ").trim().slice(0, 300) : null
    await db.supportTicket.update({ where: { id: g.ticket.id }, data: { rating, ratingComment: comment || null } })
    return NextResponse.json({ success: true })
  }
  if (body.action !== "close") return NextResponse.json({ error: "Geçersiz işlem" }, { status: 400 })
  if (g.ticket.status === "CLOSED") return NextResponse.json({ success: true })
  await db.supportTicket.update({ where: { id: g.ticket.id }, data: { status: "CLOSED", closedAt: new Date(), closedById: g.user.id, awaitingStaff: false } })
  await db.supportMessage.create({ data: { ticketId: g.ticket.id, role: "SYSTEM", content: "Görüşme kullanıcı tarafından kapatıldı." } })
  return NextResponse.json({ success: true })
}
