import { db } from "@/lib/db"
import { emailGate } from "@/lib/email-verification"
import { NextResponse } from "next/server"
import { resolveUser } from "@/lib/auth-utils"
import { termsGate } from "@/lib/terms"
import { applyRateLimit } from "@/lib/api-protection"
import { RATE_LIMIT_WRITE } from "@/lib/rate-limit"
import { findWorkshop } from "@/lib/workshop-server"
import { canEnroll, initialEnrollmentStatus, seatsLeft } from "@/lib/workshops"

// POST /api/workshops/:id/enroll — take a seat (free → confirmed, paid → reserved until payment is confirmed)
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const blocked = applyRateLimit(req, RATE_LIMIT_WRITE)
  if (blocked) return blocked
  try {
    const user = await resolveUser(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const termsBlock = termsGate(user)
    if (termsBlock) return termsBlock
    const verifyBlock = await emailGate(user.id)
    if (verifyBlock) return verifyBlock

    const w = await findWorkshop(params.id)
    if (!w) return NextResponse.json({ error: "Atölye bulunamadı" }, { status: 404 })

    // Serialise per workshop so the last seat cannot be taken twice
    const result = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM Workshop WHERE id = ${w.id} FOR UPDATE`
      const enrollments = await tx.workshopEnrollment.findMany({ where: { workshopId: w.id } })
      const existing = enrollments.find((e) => e.userId === user.id) ?? null
      const check = canEnroll(w, {
        seatsLeft: seatsLeft(w.capacity, enrollments),
        existing,
        isOwner: w.teacher.userId === user.id,
      })
      if (!check.ok) return { check }
      const status = initialEnrollmentStatus(w.priceUsd)
      const enrollment = existing
        ? await tx.workshopEnrollment.update({ where: { id: existing.id }, data: { status } })
        : await tx.workshopEnrollment.create({ data: { workshopId: w.id, userId: user.id, status } })
      return { enrollment }
    })

    if ("check" in result && result.check && !result.check.ok) {
      const status = result.check.code === "FULL" || result.check.code === "ALREADY" ? 409 : 400
      return NextResponse.json({ error: result.check.error, code: result.check.code }, { status })
    }
    return NextResponse.json({ success: true, status: result.enrollment!.status })
  } catch (error) {
    console.error("[WORKSHOP_ENROLL_ERROR]", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

// DELETE /api/workshops/:id/enroll — give the seat back
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await resolveUser(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const w = await findWorkshop(params.id)
    if (!w) return NextResponse.json({ error: "Atölye bulunamadı" }, { status: 404 })
    const mine = w.enrollments.find((e) => e.userId === user.id)
    if (!mine || mine.status === "CANCELLED") return NextResponse.json({ error: "Kaydınız yok" }, { status: 404 })
    await db.workshopEnrollment.updateMany({ where: { workshopId: w.id, userId: user.id }, data: { status: "CANCELLED" } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[WORKSHOP_UNENROLL_ERROR]", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
