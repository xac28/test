import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { applyRateLimit } from "@/lib/api-protection"
import { RATE_LIMIT_AI } from "@/lib/rate-limit"
import { logEvent } from "@/lib/event-log"

// POST /api/ai/feedback { id, helpful } — "Yardımcı oldu mu?" for one answer of the guide
export async function POST(req: Request) {
  const blocked = applyRateLimit(req, RATE_LIMIT_AI)
  if (blocked) return blocked
  const body = await req.json().catch(() => ({}))
  if (typeof body.id !== "string" || typeof body.helpful !== "boolean") return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 })
  const row = await db.aiInteraction.findUnique({ where: { id: body.id } })
  if (!row) return NextResponse.json({ error: "Kayıt bulunamadı" }, { status: 404 })
  // changing your mind is fine, but the taught answer's counters must stay consistent
  if (row.matchedId && row.kind === "taught" && row.helpful !== body.helpful) {
    await db.aiTaughtAnswer.update({
      where: { id: row.matchedId },
      data: {
        ...(body.helpful ? { helpful: { increment: 1 } } : { unhelpful: { increment: 1 } }),
        ...(row.helpful === true ? { helpful: { decrement: 1 } } : row.helpful === false ? { unhelpful: { decrement: 1 } } : {}),
      },
    }).catch(() => {})
  }
  await db.aiInteraction.update({ where: { id: row.id }, data: { helpful: body.helpful, feedbackAt: new Date() } })
  if (!body.helpful) logEvent({ type: "AI_FEEDBACK", level: "warn", message: `Rehber yardımcı olmadı: ${row.message.slice(0, 200)}`, userId: row.userId })
  return NextResponse.json({ success: true })
}
