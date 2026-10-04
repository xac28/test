import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { resolveUser } from "@/lib/auth-utils"

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

    const { title, description, videoUrl, isPublic } = await req.json()

    if (!title || !videoUrl) {
      return NextResponse.json({ error: "Title and Video URL are required" }, { status: 400 })
    }

    const video = await db.teacherVideo.create({
      data: {
        teacherId: teacher.id,
        title,
        description,
        videoUrl,
        isPublic: isPublic !== false, // default true
      }
    })

    return NextResponse.json({ success: true, video })
  } catch (error: any) {
    console.error("[TEACHER_VIDEO_ERROR]", error)
    return NextResponse.json({ error: "Internal Error" }, { status: 500 })
  }
}
