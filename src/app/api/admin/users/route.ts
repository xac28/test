import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { requireAdmin, pageOf, wantsCsv, CSV_LIMIT } from "@/lib/admin-api"
import { csvResponse, toCsv } from "@/lib/csv"
import { OPEN_STATUSES } from "@/lib/reports"

export const dynamic = "force-dynamic"

// GET /api/admin/users?q=&role=&status=active|banned|all&page=&format=csv
export async function GET(req: Request) {
  const g = await requireAdmin(req)
  if ("response" in g) return g.response
  const url = new URL(req.url)
  const q = (url.searchParams.get("q") || "").trim().slice(0, 100)
  const role = url.searchParams.get("role")
  const status = url.searchParams.get("status") || "all"
  const csv = wantsCsv(url)
  const { page, size, skip } = pageOf(url)

  const where: any = {}
  if (["STUDENT", "TEACHER", "ADMIN"].includes(role || "")) where.role = role
  if (status === "banned") where.banned = true
  if (status === "active") where.banned = false
  if (q) where.OR = [{ name: { contains: q } }, { email: { contains: q } }, { id: q }]

  const [rows, total, roleCounts, banned] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: csv ? 0 : skip,
      take: csv ? CSV_LIMIT : size,
      select: {
        id: true, name: true, email: true, image: true, role: true, banned: true, banReason: true, bannedAt: true,
        createdAt: true, termsAcceptedAt: true, country: true,
        teacher: { select: { id: true, isTrialMode: true } },
      },
    }),
    db.user.count({ where }),
    db.user.groupBy({ by: ["role"], _count: { _all: true } }),
    db.user.count({ where: { banned: true } }),
  ])

  if (csv) {
    return csvResponse(
      "kullanicilar",
      toCsv(
        ["ID", "Ad", "E-posta", "Rol", "Durum", "Yasak nedeni", "Ülke", "Sözleşme kabulü", "Kayıt tarihi"],
        rows.map((u) => [u.id, u.name, u.email, u.role, u.banned ? "Yasaklı" : "Aktif", u.banReason, u.country, u.termsAcceptedAt, u.createdAt])
      )
    )
  }

  const ids = rows.map((r) => r.id)
  const open = ids.length
    ? await db.report.groupBy({ by: ["reportedId"], where: { reportedId: { in: ids }, status: { in: OPEN_STATUSES } }, _count: { _all: true } })
    : []
  const openMap = new Map(open.map((o) => [o.reportedId, o._count._all]))

  return NextResponse.json({
    users: rows.map((u) => ({ ...u, openReports: openMap.get(u.id) ?? 0 })),
    total,
    page,
    pageSize: size,
    counts: { STUDENT: roleCounts.find((r) => r.role === "STUDENT")?._count._all ?? 0, TEACHER: roleCounts.find((r) => r.role === "TEACHER")?._count._all ?? 0, ADMIN: roleCounts.find((r) => r.role === "ADMIN")?._count._all ?? 0, banned },
  })
}
