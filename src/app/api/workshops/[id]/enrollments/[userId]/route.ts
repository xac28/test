import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { resolveUser } from "@/lib/auth-utils"
import { findWorkshop } from "@/lib/workshop-server"

// PATCH /api/workshops/:id/enrollments/:userId { status: "CONFIRMED" | "CANCELLED" } — mark a payment received / remove a participant
export async function PATCH(req: Request, { params }: { params: { id: string; userId: string } }) {
  try {
    const user = await resolveUser(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const w = await findWorkshop(params.id)
    if (!w) return NextResponse.json({ error: "Atölye bulunamadı" }, { status: 404 })
    if (w.teacher.userId !== user.id && user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    const { status } = await req.json().catch(() => ({}))
    if (status !== "CONFIRMED" && status !== "CANCELLED") {
      return NextResponse.json({ error: "Geçersiz durum" }, { status: 400 })
    }
    const res = await db.workshopEnrollment.updateMany({
      where: { workshopId: w.id, userId: params.userId },
      data: { status },
    })
    if (res.count === 0) return NextResponse.json({ error: "Kayıt bulunamadı" }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[WORKSHOP_ENROLLMENT_PATCH_ERROR]", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
