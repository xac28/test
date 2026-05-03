import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { resolveUser } from "@/lib/auth-utils"

// GET /api/mobile/teachers/availability — Get current teacher's availability
export async function GET(req: Request) {
  try {
    const user = await resolveUser(req)
    if (!user || user.role !== "TEACHER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const teacher = await db.teacher.findUnique({
      where: { userId: user.id },
      include: { availability: true }
    })

    if (!teacher) {
      return NextResponse.json({ error: "Teacher profile not found" }, { status: 404 })
    }

    return NextResponse.json({
      teacherId: teacher.id,
      availability: teacher.availability
    })
  } catch (error: any) {
    console.error("[MOBILE_AVAILABILITY_GET_ERROR]", error)
    return NextResponse.json({ error: "Internal Error" }, { status: 500 })
  }
}

// PUT /api/mobile/teachers/availability — Update teacher's weekly schedule
export async function PUT(req: Request) {
  try {
    const user = await resolveUser(req)
    if (!user || user.role !== "TEACHER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { slots } = await req.json()

    const teacher = await db.teacher.findUnique({ where: { userId: user.id } })
    if (!teacher) {
      return NextResponse.json({ error: "Teacher profile not found" }, { status: 404 })
    }

    // Delete all existing slots and recreate
    await db.availability.deleteMany({ where: { teacherId: teacher.id } })

    if (slots?.length > 0) {
      await db.availability.createMany({
        data: slots.map((s: any) => ({
          teacherId: teacher.id,
          dayOfWeek: s.dayOfWeek,
          startTime: s.startTime,
          endTime: s.endTime,
        })),
      })
    }

    return NextResponse.json({ success: true, message: "Availability updated successfully" })
  } catch (error: any) {
    console.error("[MOBILE_AVAILABILITY_PUT_ERROR]", error)
    return NextResponse.json({ error: "Internal Error" }, { status: 500 })
  }
}
