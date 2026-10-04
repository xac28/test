import { db } from "@/lib/db"
import { notSuspended } from "@/lib/policy"
import { NextResponse } from "next/server"
import { applyRateLimit } from "@/lib/api-protection"
import { RATE_LIMIT_API } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

// GET /api/teachers/:id/reviews — the written reviews of an approved teacher (public; hidden ones never show)
export async function GET(req: Request, { params }: { params: { slug: string } }) {
  const blocked = applyRateLimit(req, RATE_LIMIT_API)
  if (blocked) return blocked
  const teacher = await db.teacher.findFirst({ where: { isTrialMode: false, user: notSuspended(), OR: [{ id: params.slug }, { userId: params.slug }] }, select: { id: true } })
  if (!teacher) return NextResponse.json({ reviews: [] })
  const rows = await db.review.findMany({
    where: { status: "VISIBLE", booking: { teacherId: teacher.id } },
    orderBy: { createdAt: "desc" }, take: 30,
    include: { booking: { select: { student: { select: { name: true, firstName: true, lastName: true } } } } },
  })
  return NextResponse.json({
    reviews: rows.map((r) => {
      const s = r.booking.student
      const first = (s.firstName || s.name || "Öğrenci").split(" ")[0]
      const last = (s.lastName || (s.name ?? "").split(" ").slice(1).join(" ")).trim()
      return { id: r.id, rating: r.rating, comment: r.comment, createdAt: r.createdAt, author: last ? `${first} ${last[0].toUpperCase()}.` : first }
    }),
  })
}
