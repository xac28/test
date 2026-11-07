import { db } from "@/lib/db"
import { suspensionGate } from "@/lib/policy"
import { NextResponse } from "next/server"
import { resolveUser } from "@/lib/auth-utils"
import { validateVideoUrl } from "@/lib/teacher-video"
import { moderateText } from "@/lib/moderation"
import { termsGate } from "@/lib/terms"

export const dynamic = "force-dynamic"

// GET /api/teacher/videos — the signed-in teacher's own videos (web + mobile)
export async function GET(req: Request) {
  try {
    const user = await resolveUser(req)
    if (!user || user.role !== "TEACHER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const teacher = await db.teacher.findUnique({ where: { userId: user.id } })
    if (!teacher) return NextResponse.json({ error: "Teacher profile not found" }, { status: 404 })
    const videos = await db.teacherVideo.findMany({
      where: { teacherId: teacher.id },
      orderBy: { createdAt: "desc" },
    })
    return NextResponse.json({ videos })
  } catch (error) {
    console.error("[TEACHER_VIDEO_LIST_ERROR]", error)
    return NextResponse.json({ error: "Internal Error" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const user = await resolveUser(req)
    if (!user || user.role !== "TEACHER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const teacher = await db.teacher.findUnique({
      where: { userId: user.id }
    })

    if (!teacher) {
      return NextResponse.json({ error: "Teacher profile not found" }, { status: 404 })
    }

    const gate = termsGate(user)
    if (gate) return gate
    const susp = await suspensionGate(user.id)
    if (susp) return susp
    const body = await req.json().catch(() => ({}))
    const checkedTitle = await moderateText(user, body.title, "VIDEO", { max: 120, min: 3 })
    if (!checkedTitle.ok) return NextResponse.json({ error: checkedTitle.error, code: checkedTitle.code, policy: checkedTitle.policy ? { strike: checkedTitle.policy.strike, action: checkedTitle.policy.action } : undefined }, { status: checkedTitle.status })
    let description: string | null = null
    if (typeof body.description === "string" && body.description.trim()) {
      const d = await moderateText(user, body.description, "VIDEO", { max: 500, min: 1 })
      if (!d.ok) return NextResponse.json({ error: d.error, code: d.code, policy: d.policy ? { strike: d.policy.strike, action: d.policy.action } : undefined }, { status: d.status })
      description = d.text
    }
    const link = await validateVideoUrl(body.videoUrl, user.id)
    if (!link.ok) return NextResponse.json({ error: link.error }, { status: 400 })

    const video = await db.teacherVideo.create({
      data: {
        teacherId: teacher.id,
        title: checkedTitle.text,
        description,
        videoUrl: link.url,
        isPublic: body.isPublic !== false, // default true
      }
    })

    return NextResponse.json({ success: true, video })
  } catch (error: any) {
    console.error("[TEACHER_VIDEO_ERROR]", error)
    return NextResponse.json({ error: "Internal Error" }, { status: 500 })
  }
}
