import { db } from "@/lib/db"
import { enforceTeacherText, suspensionGate } from "@/lib/policy"
import { NextResponse } from "next/server"
import { resolveUser } from "@/lib/auth-utils"
import { findWorkshop, presentWorkshop } from "@/lib/workshop-server"
import { validateWorkshopInput } from "@/lib/workshops"

export const dynamic = "force-dynamic"

// GET /api/workshops/:idOrSlug
export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const viewer = await resolveUser(req).catch(() => null)
    const w = await findWorkshop(params.id)
    if (!w) return NextResponse.json({ error: "Atölye bulunamadı" }, { status: 404 })
    const view = presentWorkshop(w, viewer)
    // drafts are only visible to the owner / admin
    if (w.status === "DRAFT" && !view.isOwner && viewer?.role !== "ADMIN") {
      return NextResponse.json({ error: "Atölye bulunamadı" }, { status: 404 })
    }
    return NextResponse.json({ workshop: view })
  } catch (error) {
    console.error("[WORKSHOP_GET_ERROR]", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

// PATCH /api/workshops/:id — owner/admin: edit, publish/unpublish or cancel
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await resolveUser(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const w = await findWorkshop(params.id)
    if (!w) return NextResponse.json({ error: "Atölye bulunamadı" }, { status: 404 })
    if (w.teacher.userId !== user.id && user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const susp = w.teacher.userId === user.id ? await suspensionGate(user.id) : null
    if (susp) return susp
    const body = await req.json().catch(() => ({}))
    const data: Record<string, unknown> = {}

    if (["DRAFT", "PUBLISHED", "CANCELLED"].includes(body.status)) data.status = body.status

    const editsContent = ["title", "description", "category", "level", "mode", "startsAt", "durationMin", "priceUsd", "capacity", "coverUrl", "videoUrl", "subtitle"].some((k) => k in body)
    if (editsContent) {
      const v = validateWorkshopInput({
        title: w.title, subtitle: w.subtitle, description: w.description, category: w.category, level: w.level, mode: w.mode,
        startsAt: w.startsAt, durationMin: w.durationMin, priceUsd: w.priceUsd, capacity: w.capacity, coverUrl: w.coverUrl, videoUrl: w.videoUrl,
        ...body,
      }, new Date(0)) // the original start may already be past when only e.g. the description changes
      if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 })
      const active = w.enrollments.filter((e) => e.status !== "CANCELLED").length
      if (v.data.capacity < active) {
        return NextResponse.json({ error: `Kontenjan, kayıtlı ${active} kişinin altına düşürülemez.` }, { status: 400 })
      }
      if (w.teacher.userId === user.id) {
        const policy = await enforceTeacherText(user, [v.data.title, v.data.subtitle, v.data.description], "WORKSHOP")
        if (policy) return NextResponse.json({ error: policy.error, code: policy.code, policy: { strike: policy.policy.strike, action: policy.policy.action } }, { status: policy.status })
      }
      Object.assign(data, v.data)
    }

    if (Object.keys(data).length === 0) return NextResponse.json({ error: "Değişiklik yok" }, { status: 400 })
    const updated = await db.workshop.update({ where: { id: w.id }, data })
    return NextResponse.json({ success: true, workshop: updated })
  } catch (error) {
    console.error("[WORKSHOP_PATCH_ERROR]", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
