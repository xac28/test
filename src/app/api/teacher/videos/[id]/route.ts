import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { resolveUser } from "@/lib/auth-utils"

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
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

    // Verify ownership
    const video = await db.teacherVideo.findUnique({
      where: { id: params.id }
    })

    if (!video || video.teacherId !== teacher.id) {
      return NextResponse.json({ error: "Video not found or unauthorized" }, { status: 404 })
    }

    await db.teacherVideo.delete({
      where: { id: params.id }
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[TEACHER_VIDEO_DELETE_ERROR]", error)
    return NextResponse.json({ error: "Internal Error" }, { status: 500 })
  }
}
