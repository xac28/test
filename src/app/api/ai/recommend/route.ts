import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { applyRateLimit } from "@/lib/api-protection"
import { RATE_LIMIT_AI } from "@/lib/rate-limit"
import { resolveUser } from "@/lib/auth-utils"
import { composeReply, GuideData, GuideReply, normalize, wantsHuman } from "@/lib/ai-guide"
import { getGuideTeachers } from "@/lib/ai-data"
import { isCrisis, matchTaught } from "@/lib/ai-knowledge"
import { redactForLog, taughtToEntries } from "@/lib/ai-learning"
import { logEvent } from "@/lib/event-log"
import { listActiveBroadcasts } from "@/lib/live-rooms"

export const dynamic = "force-dynamic"

const MAX_MESSAGE = 500

// POST /api/ai/recommend { message } → { reply, links, teachers? }
// AYA Rehber: understands what the visitor wants and answers with real pages (see src/lib/ai-guide.ts)
export async function POST(req: Request) {
  const blocked = applyRateLimit(req, RATE_LIMIT_AI)
  if (blocked) return blocked

  try {
    const body = await req.json().catch(() => ({}))
    const message = typeof body.message === "string" ? body.message.trim().slice(0, MAX_MESSAGE) : ""
    if (!message) return NextResponse.json({ error: "Message is required" }, { status: 400 })

    const [user, teachers, workshops, articles, live] = await Promise.all([
      resolveUser(req).catch(() => null),
      // only approved teachers are ever recommended
      getGuideTeachers(),
      db.workshop.findMany({
        where: { status: "PUBLISHED", OR: [{ startsAt: null }, { startsAt: { gte: new Date() } }] },
        orderBy: { startsAt: "asc" },
        take: 12,
        select: { title: true, slug: true, category: true, startsAt: true, priceUsd: true, mode: true },
      }),
      db.article.findMany({ where: { status: "PUBLISHED" }, orderBy: { publishedAt: "desc" }, take: 6, select: { title: true, slug: true, category: true } }),
      listActiveBroadcasts().catch(() => []),
    ])

    const data: GuideData = {
      teachers,
      workshops: workshops.map((w) => ({ ...w, startsAt: w.startsAt ? w.startsAt.toISOString() : null })),
      live: live.map((l) => ({ id: l.id, title: l.title, teacher: l.teacher.name || "Eğitmen" })),
      articles,
      signedIn: !!user,
      role: user?.role ?? null,
    }

    // answers the admins taught the guide beat the built-in ones (except crisis and "talk to a person")
    let out: GuideReply | null = null
    let matchedId: string | null = null
    if (!isCrisis(message) && !wantsHuman(message)) {
      const taught = await db.aiTaughtAnswer.findMany({ where: { active: true }, select: { id: true, keys: true, answer: true, linkLabel: true, linkHref: true }, take: 500 })
      const hit = matchTaught(message, taughtToEntries(taught))
      if (hit) {
        matchedId = hit.entry.id
        out = { intent: "taught", reply: hit.entry.answer, links: hit.entry.links ?? [] }
        db.aiTaughtAnswer.update({ where: { id: hit.entry.id }, data: { hits: { increment: 1 } } }).catch(() => {})
      }
    }
    if (!out) out = composeReply(message, data)

    const kind = out.intent === "taught" ? "taught" : out.intent === "unknown" ? "unknown" : out.intent === "crisis" ? "crisis" : out.intent === "support" ? "support" : out.intent === "knowledge" ? "knowledge" : "navigation"
    const social = out.intent === "greeting" || out.intent === "thanks"
    let interactionId: string | null = null
    try {
      const row = await db.aiInteraction.create({
        data: { userId: user?.id ?? null, message: redactForLog(message), norm: normalize(redactForLog(message)).slice(0, 500), intent: String(out.intent), kind, matchedId },
        select: { id: true },
      })
      interactionId = row.id
      if (kind === "unknown") logEvent({ type: "AI_UNKNOWN", level: "info", message: `Rehber bilmediği soru: ${redactForLog(message).slice(0, 200)}`, userId: user?.id })
    } catch {
      /* logging the question must never break the answer */
    }
    return NextResponse.json({
      intent: out.intent, reply: out.reply, links: out.links, teachers: out.teachers ?? [], suggestions: out.suggestions ?? [],
      action: out.action ?? null, learning: !!out.learning, interactionId,
      // feedback buttons only where an answer was given (not for hellos, crisis text or the support hand-off itself)
      askFeedback: !!interactionId && !social && kind !== "crisis" && kind !== "support",
    })
  } catch (error) {
    console.error("[AI_ERROR]", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
