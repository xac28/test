import { db } from "@/lib/db"
import { enforceTeacherText, suspensionGate, notSuspended } from "@/lib/policy"
import { NextResponse } from "next/server"
import { resolveUser } from "@/lib/auth-utils"
import { termsGate } from "@/lib/terms"
import { applyRateLimit } from "@/lib/api-protection"
import { RATE_LIMIT_WRITE } from "@/lib/rate-limit"
import { validateWorkshopInput, seatsLeft, workshopState } from "@/lib/workshops"
import { uniqueSlug } from "@/lib/slug"

export const dynamic = "force-dynamic"

// GET /api/workshops?mode=LIVE|RECORDED&category=Yin&past=1 — public list of published workshops
export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const mode = url.searchParams.get("mode")
    const category = url.searchParams.get("category")
    const past = url.searchParams.get("past") === "1"
    const now = new Date()

    const rows = await db.workshop.findMany({
      where: {
        status: "PUBLISHED",
        teacher: { user: notSuspended() },
        ...(mode === "LIVE" || mode === "RECORDED" ? { mode } : {}),
        ...(category ? { category } : {}),
      },
      include: {
        teacher: { include: { user: { select: { name: true, image: true } } } },
        enrollments: { select: { status: true } },
      },
      orderBy: [{ startsAt: "asc" }, { createdAt: "desc" }],
      take: 100,
    })

    const items = rows
      .map((w) => ({
        id: w.id,
        slug: w.slug,
        title: w.title,
        subtitle: w.subtitle,
        category: w.category,
        level: w.level,
        mode: w.mode,
        state: workshopState(w, now),
        startsAt: w.startsAt,
        durationMin: w.durationMin,
        priceUsd: w.priceUsd,
        capacity: w.capacity,
        seatsLeft: seatsLeft(w.capacity, w.enrollments),
        coverUrl: w.coverUrl,
        teacher: { id: w.teacherId, name: w.teacher.user.name, image: w.teacher.user.image },
      }))
      .filter((w) => (past ? w.state === "ended" : w.state !== "ended"))

    return NextResponse.json({ workshops: items })
  } catch (error) {
    console.error("[WORKSHOPS_LIST_ERROR]", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

// POST /api/workshops — a teacher (or admin) creates a workshop
export async function POST(req: Request) {
  const blocked = applyRateLimit(req, RATE_LIMIT_WRITE)
  if (blocked) return blocked
  try {
    const user = await resolveUser(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const termsBlock = termsGate(user)
    if (termsBlock) return termsBlock
    if (user.role !== "TEACHER" && user.role !== "ADMIN") {
      return NextResponse.json({ error: "Yalnızca eğitmenler atölye oluşturabilir." }, { status: 403 })
    }

    const teacher = await db.teacher.findUnique({ where: { userId: user.id } })
    if (!teacher) return NextResponse.json({ error: "Eğitmen profili bulunamadı" }, { status: 404 })
    if (teacher.isTrialMode && user.role !== "ADMIN") {
      return NextResponse.json({ error: "Deneme aşamasındaki eğitmenler atölye açamaz." }, { status: 403 })
    }

    const susp = await suspensionGate(user.id)
    if (susp) return susp
    const body = await req.json().catch(() => ({}))
    const v = validateWorkshopInput(body)
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 })
    const policy = await enforceTeacherText(user, [v.data.title, v.data.subtitle, v.data.description], "WORKSHOP")
    if (policy) return NextResponse.json({ error: policy.error, code: policy.code, policy: { strike: policy.policy.strike, action: policy.policy.action } }, { status: policy.status })

    const workshop = await db.workshop.create({
      data: {
        ...v.data,
        slug: uniqueSlug(v.data.title),
        teacherId: teacher.id,
        status: body.status === "DRAFT" ? "DRAFT" : "PUBLISHED",
      },
    })
    return NextResponse.json({ success: true, workshop })
  } catch (error) {
    console.error("[WORKSHOP_CREATE_ERROR]", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
