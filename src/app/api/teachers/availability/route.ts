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

    const body = await req.json().catch(() => null)
    const teacherId = typeof body?.teacherId === "string" ? body.teacherId : ""
    const slots: unknown = body?.slots
    const timeOk = (v: unknown) => typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v)
    if (!teacherId || (slots !== undefined && !Array.isArray(slots))) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 })
    }
    if (Array.isArray(slots) && (slots.length > 100 || slots.some((s: any) => !Number.isInteger(s?.dayOfWeek) || s.dayOfWeek < 0 || s.dayOfWeek > 6 || !timeOk(s?.startTime) || !timeOk(s?.endTime) || s.startTime >= s.endTime))) {
      return NextResponse.json({ error: "Invalid time slot" }, { status: 400 })
    }

    // Verify ownership
    const teacher = await db.teacher.findUnique({ where: { id: teacherId } })
    if (!teacher || teacher.userId !== user.id) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 })
    }

    // Delete all existing slots and recreate
    await db.availability.deleteMany({ where: { teacherId } })

    if (Array.isArray(slots) && slots.length > 0) {
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
