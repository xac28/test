import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-api"
import { listActiveBroadcasts } from "@/lib/live-rooms"

export const dynamic = "force-dynamic"

// GET /api/admin/live-rooms — what is on air right now and which scheduled lessons are in session
export async function GET(req: Request) {
  const g = await requireAdmin(req)
  if ("response" in g) return g.response
  const now = new Date()
  const [broadcasts, lessons] = await Promise.all([
    listActiveBroadcasts(),
    db.booking.findMany({
      where: { status: "CONFIRMED", startTime: { lte: now }, endTime: { gte: now } },
      orderBy: { startTime: "asc" },
      include: { student: { select: { name: true } }, teacher: { select: { user: { select: { name: true } } } } },
    }),
  ])
  return NextResponse.json({
    broadcasts,
    lessons: lessons.map((b) => ({ id: b.id, startTime: b.startTime, endTime: b.endTime, student: b.student.name, teacher: b.teacher.user.name })),
  })
}
