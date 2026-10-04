import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { applyRateLimit } from "@/lib/api-protection"
import { RATE_LIMIT_AI } from "@/lib/rate-limit"
import { resolveUser } from "@/lib/auth-utils"
import { composeReply, GuideData, GuideTeacher } from "@/lib/ai-guide"
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
        where: { isTrialMode: false, user: { banned: false } },
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
      const reviews = t.bookings.filter((b) => b.review).map((b) => b.review!)
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

    const out = composeReply(message, data)
    return NextResponse.json({ intent: out.intent, reply: out.reply, links: out.links, teachers: out.teachers ?? [], suggestions: out.suggestions ?? [] })
  } catch (error) {
    console.error("[AI_ERROR]", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
