import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-api"
import { OPEN_STATUSES, REPORT_CATEGORIES, CATEGORY_LABEL_TR, PRIORITY_LABEL_TR, STATUS_LABEL_TR, TARGET_LABEL_TR } from "@/lib/reports"
import { csvResponse, toCsv } from "@/lib/csv"

export const dynamic = "force-dynamic"
const PAGE_SIZE = 20

// GET /api/admin/reports?status=open|PENDING|REVIEWED|RESOLVED|DISMISSED|all&category=&priority=&q=&page=
export async function GET(req: Request) {
  try {
    const g = await requireAdmin(req)
    if ("response" in g) return g.response

    const url = new URL(req.url)
    const status = url.searchParams.get("status") || "open"
    const category = url.searchParams.get("category")
    const priority = url.searchParams.get("priority")
    const q = (url.searchParams.get("q") || "").trim()
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1") || 1)

    const where: any = {}
    if (status === "open") where.status = { in: OPEN_STATUSES }
    else if (["PENDING", "REVIEWED", "RESOLVED", "DISMISSED"].includes(status)) where.status = status
    if (category && REPORT_CATEGORIES[category]) where.category = category
    if (priority && ["LOW", "NORMAL", "HIGH", "URGENT"].includes(priority)) where.priority = priority
    if (q) {
      where.OR = [
        { reporter: { name: { contains: q } } },
        { reporter: { email: { contains: q } } },
        { reported: { name: { contains: q } } },
        { reported: { email: { contains: q } } },
        { reason: { contains: q } },
        { id: q },
      ]
    }

    const [rows, total, counts] = await Promise.all([
      db.report.findMany({
        where,
        include: {
          reporter: { select: { id: true, name: true, email: true } },
          reported: { select: { id: true, name: true, email: true, role: true, banned: true } },
        },
        // urgent first, then oldest first within a priority so nothing waits forever
        orderBy: [{ createdAt: "asc" }],
        take: 500,
      }),
      db.report.count({ where }),
      db.report.groupBy({ by: ["status"], _count: { _all: true } }),
    ])

    const rank: Record<string, number> = { URGENT: 0, HIGH: 1, NORMAL: 2, LOW: 3 }
    const open = status === "open" || status === "PENDING" || status === "REVIEWED"
    const sorted = [...rows].sort((a, b) =>
      open ? rank[a.priority] - rank[b.priority] || a.createdAt.getTime() - b.createdAt.getTime() : b.createdAt.getTime() - a.createdAt.getTime()
    )
    if (url.searchParams.get("format") === "csv") {
      return csvResponse(
        "raporlar",
        toCsv(
          ["ID", "Tarih", "Durum", "Öncelik", "Tür", "Kategori", "Raporlayan", "Raporlanan", "Açıklama"],
          sorted.map((r) => [r.id, r.createdAt, STATUS_LABEL_TR[r.status], PRIORITY_LABEL_TR[r.priority], TARGET_LABEL_TR[r.targetType] ?? r.targetType, CATEGORY_LABEL_TR(r.category), r.reporter?.email, r.reported?.email, r.reason])
        )
      )
    }
    const pageRows = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

    // how many open reports each reported user has in total
    const ids = Array.from(new Set(pageRows.map((r) => r.reportedId).filter(Boolean) as string[]))
    const perUser = ids.length
      ? await db.report.groupBy({ by: ["reportedId"], where: { reportedId: { in: ids }, status: { in: OPEN_STATUSES } }, _count: { _all: true } })
      : []
    const openByUser = new Map(perUser.map((g) => [g.reportedId, g._count._all]))

    const statusCounts: Record<string, number> = { PENDING: 0, REVIEWED: 0, RESOLVED: 0, DISMISSED: 0 }
    for (const c of counts) statusCounts[c.status] = c._count._all

    return NextResponse.json({
      reports: pageRows.map((r) => ({
        id: r.id,
        category: r.category,
        targetType: r.targetType,
        priority: r.priority,
        status: r.status,
        reason: r.reason,
        createdAt: r.createdAt,
        handledAt: r.handledAt,
        reporter: r.reporter,
        reported: r.reported,
        reportedOpenCount: r.reportedId ? openByUser.get(r.reportedId) ?? 0 : 0,
      })),
      total,
      page,
      pageSize: PAGE_SIZE,
      statusCounts,
    })
  } catch (error) {
    console.error("[ADMIN_REPORTS_LIST_ERROR]", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
