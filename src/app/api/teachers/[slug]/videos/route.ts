import { auth } from "@/auth"
import { db } from "@/lib/db"
import { NextResponse } from "next/server"

export async function GET(req: Request, { params }: { params: { slug: string } }) {
  try {
    const { slug } = params
    const session = await auth()
    const userId = session?.user?.id

    let isStudentOfTeacher = false

    if (userId) {
      // Check if user has any bookings with this teacher
      const booking = await db.booking.findFirst({
        where: {
          studentId: userId,
          teacherId: slug,
        }
      })
      if (booking) isStudentOfTeacher = true
    }

    const videos = await db.teacherVideo.findMany({
      where: {
        teacherId: slug,
        // If they are a student, they see all (public + private). If not, only public.
        isPublic: isStudentOfTeacher ? undefined : true,
      },
      orderBy: { createdAt: "desc" }
    })

    return NextResponse.json(videos)
  } catch (error) {
    return NextResponse.json({ error: "Internal Error" }, { status: 500 })
  }
}
