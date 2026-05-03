import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { resolveUser } from "@/lib/auth-utils"

// PUT /api/teachers/availability — Update teacher's weekly schedule
export async function PUT(req: Request) {
  try {
    const user = await resolveUser(req)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { teacherId, slots } = await req.json()

    // Verify ownership
    const teacher = await db.teacher.findUnique({ where: { id: teacherId } })
    if (!teacher || teacher.userId !== user.id) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 })
    }

    // Delete all existing slots and recreate
    await db.availability.deleteMany({ where: { teacherId } })

    if (slots?.length > 0) {
      await db.availability.createMany({
        data: slots.map((s: any) => ({
          teacherId,
          dayOfWeek: s.dayOfWeek,
          startTime: s.startTime,
          endTime: s.endTime,
        })),
      })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[AVAILABILITY_ERROR]", error)
    return NextResponse.json({ error: "Internal Error" }, { status: 500 })
  }
}
