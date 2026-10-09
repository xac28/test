import { NextResponse } from "next/server"
import { getDbTeacherProfile } from "@/lib/teacher-profile"

export const dynamic = "force-dynamic"

// GET /api/teachers/:id — public profile of an approved teacher (unapproved teachers are 404)
export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  try {
    const teacher = await getDbTeacherProfile(params.slug)
    if (!teacher) return NextResponse.json({ error: "Eğitmen bulunamadı" }, { status: 404 })
    return NextResponse.json(teacher)
  } catch (error) {
    console.error("[TEACHER_PROFILE_ERROR]", error)
    return NextResponse.json({ error: "Internal Error" }, { status: 500 })
  }
}
