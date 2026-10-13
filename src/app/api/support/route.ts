import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { resolveUser } from "@/lib/auth-utils"
import { applyRateLimit } from "@/lib/api-protection"
import { RATE_LIMIT_API, RATE_LIMIT_WRITE } from "@/lib/rate-limit"
import { notifyAdminsInApp } from "@/lib/notifications"
import { logEvent } from "@/lib/event-log"
import { cleanSupportText, serializeMessage, subjectFrom } from "@/lib/support"

export const dynamic = "force-dynamic"

// GET /api/support — my tickets; the open one comes with its messages and the unread flag
export async function GET(req: Request) {
  const blocked = applyRateLimit(req, RATE_LIMIT_API)
  if (blocked) return blocked
  const user = await resolveUser(req)
  if (!user) return NextResponse.json({ error: "Giriş yapın." }, { status: 401 })
  const tickets = await db.supportTicket.findMany({ where: { userId: user.id }, orderBy: { lastMessageAt: "desc" }, take: 20 })
  const open = tickets.find((t) => t.status === "OPEN") ?? null
  const messages = open ? await db.supportMessage.findMany({ where: { ticketId: open.id, role: { not: "NOTE" } }, orderBy: { createdAt: "asc" }, take: 200 }) : []
  return NextResponse.json({
    open: open && { id: open.id, subject: open.subject, createdAt: open.createdAt, awaitingStaff: open.awaitingStaff },
    messages: messages.map(serializeMessage),
    tickets: tickets.map((t) => ({ id: t.id, subject: t.subject, status: t.status, createdAt: t.createdAt, lastMessageAt: t.lastMessageAt, rating: t.rating })),
  })
}

// POST /api/support { message, source?, context? } — start a conversation (or add to the one that is already open)
export async function POST(req: Request) {
  const blocked = applyRateLimit(req, RATE_LIMIT_WRITE)
  if (blocked) return blocked
  try {
    const user = await resolveUser(req)
    if (!user) return NextResponse.json({ error: "Canlı destek için giriş yapın." }, { status: 401 })
    const body = await req.json().catch(() => ({}))
    const text = cleanSupportText(body.message)
    if (!text.ok) return NextResponse.json({ error: text.error }, { status: 400 })
    const source = ["AI_UNHELPFUL", "AI_REQUEST"].includes(body.source) ? body.source : "USER"
    const context = typeof body.context === "string" ? body.context.replace(/\s+/g, " ").trim().slice(0, 300) : ""

    let ticket = await db.supportTicket.findFirst({ where: { userId: user.id, status: "OPEN" } })
    const created = !ticket
    if (!ticket) {
      ticket = await db.supportTicket.create({ data: { userId: user.id, subject: subjectFrom(text.text) || "Destek talebi", source } })
      await db.supportMessage.create({
        data: {
          ticketId: ticket.id, role: "SYSTEM",
          content: source === "AI_UNHELPFUL" ? `AYA Rehber yardımcı olamadı${context ? `. Son soru: “${context}”` : "."}` : source === "AI_REQUEST" ? `Rehber üzerinden canlı destek istendi${context ? `. Son soru: “${context}”` : "."}` : "Destek talebi açıldı.",
        },
      })
    }
    const msg = await db.supportMessage.create({ data: { ticketId: ticket.id, senderId: user.id, role: "USER", content: text.text } })
    await db.supportTicket.update({ where: { id: ticket.id }, data: { lastMessageAt: msg.createdAt, awaitingStaff: true } })
    if (created) {
      await notifyAdminsInApp("Yeni canlı destek talebi", `${user.name ?? "Bir üye"}: ${text.text.slice(0, 100)}`, "/admin?tab=support")
      logEvent({ type: "SUPPORT", message: `Destek talebi açıldı (${source})`, userId: user.id, meta: { ticketId: ticket.id } })
    }
    return NextResponse.json({ success: true, ticketId: ticket.id, created, message: serializeMessage(msg) })
  } catch (error) {
    console.error("[SUPPORT_CREATE_ERROR]", error)
    return NextResponse.json({ error: "Internal Error" }, { status: 500 })
  }
}
