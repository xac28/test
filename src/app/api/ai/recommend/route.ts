import { db } from "@/lib/db"
import { notSuspended } from "@/lib/policy"
import { NextResponse } from "next/server"
import { applyRateLimit } from "@/lib/api-protection"
import { RATE_LIMIT_AI } from "@/lib/rate-limit"
import { resolveUser } from "@/lib/auth-utils"
import { composeReply, GuideData, GuideReply, GuideTeacher, normalize, wantsHuman } from "@/lib/ai-guide"
import { isCrisis, matchTaught } from "@/lib/ai-knowledge"
import { redactForLog, taughtToEntries } from "@/lib/ai-learning"
import { logEvent } from "@/lib/event-log"
import { TEACHERS } from "@/lib/teachers"
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

    const [user, dbTeachers, workshops, articles, live] = await Promise.all([
      resolveUser(req).catch(() => null),
      // only approved teachers are ever recommended
      db.teacher.findMany({
        where: { isTrialMode: false, user: { banned: false, ...notSuspended() } },
        include: { user: { select: { name: true, country: true } }, bookings: { where: { status: "COMPLETED" }, include: { review: true } } },
        take: 1000,
      }),
      db.workshop.findMany({
        where: { status: "PUBLISHED", OR: [{ startsAt: null }, { startsAt: { gte: new Date() } }] },
        orderBy: { startsAt: "asc" },
        take: 12,
        select: { title: true, slug: true, category: true, startsAt: true, priceUsd: true, mode: true },
      }),
      db.article.findMany({ where: { status: "PUBLISHED" }, orderBy: { publishedAt: "desc" }, take: 6, select: { title: true, slug: true, category: true } }),
      listActiveBroadcasts().catch(() => []),
    ])

    const real: GuideTeacher[] = dbTeachers.map((t) => {
      const reviews = t.bookings.filter((b) => b.review && b.review.status === "VISIBLE").map((b) => b.review!)
      let specs: string[] = []
      try {
        specs = t.specialties ? JSON.parse(t.specialties) : []
      } catch {}
      return {
        id: t.id,
        name: t.user.name || "Eğitmen",
        country: t.user.country || "",
        specialties: specs.join(", "),
        rating: reviews.length ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10 : 5,
        reviewCount: reviews.length,
        hourlyRate: t.hourlyRate,
        studentsCount: t.bookings.length,
        href: `/teachers/${t.id}`,
      }
    })
    const demo: GuideTeacher[] = TEACHERS.map((t) => ({
      id: t.slug,
      name: t.name,
      country: t.country,
      specialties: t.styles.join(", "),
      rating: t.rating,
      reviewCount: t.reviewCount,
      hourlyRate: t.pricePerClassUSD,
      studentsCount: t.studentsCount,
      href: `/teachers/${t.slug}`,
    }))

    const data: GuideData = {
      teachers: [...real, ...demo],
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
