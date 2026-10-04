import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { resolveUser } from "@/lib/auth-utils"
import { termsGate } from "@/lib/terms"
import { applyRateLimit } from "@/lib/api-protection"
import { RATE_LIMIT_WRITE } from "@/lib/rate-limit"
import { computeAvailable, computeClaimed, computeEarned, validatePayoutRequest } from "@/lib/payouts"

async function loadBalance(teacherId: string, commissionRate: number) {
  const [bookings, requests] = await Promise.all([
    db.booking.findMany({ where: { teacherId, status: "COMPLETED" }, select: { price: true, status: true } }),
    db.payoutRequest.findMany({ where: { teacherId }, orderBy: { createdAt: "desc" }, take: 50 }),
  ])
  const earned = computeEarned(bookings, commissionRate)
  const claimed = computeClaimed(requests)
  return { earned, claimed, available: computeAvailable(earned, claimed), requests }
}

// GET /api/teacher/payouts — balance + request history for the signed-in teacher
export async function GET(req: Request) {
  try {
    const user = await resolveUser(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (user.role !== "TEACHER" && user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    const teacher = await db.teacher.findUnique({ where: { userId: user.id } })
    if (!teacher) return NextResponse.json({ error: "Öğretmen profili bulunamadı" }, { status: 404 })

    const b = await loadBalance(teacher.id, teacher.commissionRate)
    return NextResponse.json({ ...b, hasStripeConnect: !!teacher.stripeConnectId })
  } catch (error) {
    console.error("[PAYOUTS_GET_ERROR]", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

// POST /api/teacher/payouts — request a payout
export async function POST(req: Request) {
  const blocked = applyRateLimit(req, RATE_LIMIT_WRITE)
  if (blocked) return blocked
  try {
    const user = await resolveUser(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const termsBlock = termsGate(user)
    if (termsBlock) return termsBlock
    if (user.role !== "TEACHER" && user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    const teacher = await db.teacher.findUnique({ where: { userId: user.id } })
    if (!teacher) return NextResponse.json({ error: "Öğretmen profili bulunamadı" }, { status: 404 })

    const body = await req.json().catch(() => ({}))

    // Serialise per teacher so two parallel requests cannot both claim the same balance
    const result = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM Teacher WHERE id = ${teacher.id} FOR UPDATE`
      const [bookings, requests] = await Promise.all([
        tx.booking.findMany({ where: { teacherId: teacher.id, status: "COMPLETED" }, select: { price: true, status: true } }),
        tx.payoutRequest.findMany({ where: { teacherId: teacher.id } }),
      ])
      const available = computeAvailable(
        computeEarned(bookings, teacher.commissionRate),
        computeClaimed(requests)
      )
      const v = validatePayoutRequest(body, available, { hasStripeConnect: !!teacher.stripeConnectId })
      if (!v.ok) return { error: v.error as string }
      const created = await tx.payoutRequest.create({
        data: {
          teacherId: teacher.id,
          amount: v.amount,
          method: v.method,
          iban: v.iban,
          accountName: v.accountName,
          note: typeof body.note === "string" ? body.note.slice(0, 500) : null,
        },
      })
      return { created }
    })

    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 })
    return NextResponse.json({ success: true, request: result.created })
  } catch (error) {
    console.error("[PAYOUTS_POST_ERROR]", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
