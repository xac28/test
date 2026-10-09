import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { requireAdmin, pageOf, wantsCsv, CSV_LIMIT } from "@/lib/admin-api"
import { csvResponse, toCsv } from "@/lib/csv"

export const dynamic = "force-dynamic"
const STATUSES = ["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED"]

// GET /api/admin/bookings?status=&q=&when=upcoming|past&page=&format=csv
export async function GET(req: Request) {
  const g = await requireAdmin(req)
  if ("response" in g) return g.response
  const url = new URL(req.url)
  const status = url.searchParams.get("status") || "all"
  const when = url.searchParams.get("when")
  const q = (url.searchParams.get("q") || "").trim().slice(0, 100)
  const csv = wantsCsv(url)
  const { page, size, skip } = pageOf(url)

  const where: any = {}
  if (STATUSES.includes(status)) where.status = status
  if (when === "upcoming") where.startTime = { gte: new Date() }
  if (when === "past") where.startTime = { lt: new Date() }
  if (q) where.OR = [{ id: q }, { student: { name: { contains: q } } }, { student: { email: { contains: q } } }, { teacher: { user: { name: { contains: q } } } }]

  const [rows, total, counts] = await Promise.all([
    db.booking.findMany({
      where,
      orderBy: { startTime: "desc" },
      skip: csv ? 0 : skip,
      take: csv ? CSV_LIMIT : size,
      include: { student: { select: { id: true, name: true, email: true } }, teacher: { select: { id: true, user: { select: { id: true, name: true } } } } },
    }),
    db.booking.count({ where }),
    db.booking.groupBy({ by: ["status"], _count: { _all: true } }),
  ])

  if (csv) {
    return csvResponse(
      "rezervasyonlar",
      toCsv(
        ["ID", "Öğrenci", "Öğrenci e-posta", "Eğitmen", "Başlangıç", "Bitiş", "Durum", "Ücret"],
        rows.map((b) => [b.id, b.student.name, b.student.email, b.teacher.user.name, b.startTime, b.endTime, b.status, b.price])
      )
    )
  }
  const statusCounts: Record<string, number> = {}
  for (const c of counts) statusCounts[c.status] = c._count._all
  return NextResponse.json({
    bookings: rows.map((b) => ({
      id: b.id, status: b.status, price: b.price, startTime: b.startTime, endTime: b.endTime, createdAt: b.createdAt,
      student: b.student, teacher: { id: b.teacher.id, userId: b.teacher.user.id, name: b.teacher.user.name },
    })),
    total, page, pageSize: size, statusCounts,
  })
}
