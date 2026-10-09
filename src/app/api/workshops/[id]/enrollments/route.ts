import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { resolveUser } from "@/lib/auth-utils"
import { findWorkshop } from "@/lib/workshop-server"

// GET /api/workshops/:id/enrollments — the teacher's participant list
export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await resolveUser(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const w = await findWorkshop(params.id)
    if (!w) return NextResponse.json({ error: "Atölye bulunamadı" }, { status: 404 })
    if (w.teacher.userId !== user.id && user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    const rows = await db.workshopEnrollment.findMany({
      where: { workshopId: w.id },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    })
    return NextResponse.json({ enrollments: rows })
  } catch (error) {
    console.error("[WORKSHOP_ENROLLMENTS_ERROR]", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
