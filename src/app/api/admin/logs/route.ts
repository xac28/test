import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { requireAdmin, pageOf, wantsCsv, CSV_LIMIT } from "@/lib/admin-api"
import { csvResponse, toCsv } from "@/lib/csv"

export const dynamic = "force-dynamic"

const RANGES: Record<string, number> = { "1h": 3_600_000, "24h": 86_400_000, "7d": 7 * 86_400_000, "30d": 30 * 86_400_000 }

// GET /api/admin/logs?type=&level=&q=&range=1h|24h|7d|30d|all&page=&format=csv — structured system events
export async function GET(req: Request) {
  const g = await requireAdmin(req)
  if ("response" in g) return g.response
  const url = new URL(req.url)
  const type = (url.searchParams.get("type") || "").slice(0, 40)
  const level = (url.searchParams.get("level") || "").slice(0, 8)
  const q = (url.searchParams.get("q") || "").trim().slice(0, 100)
  const range = url.searchParams.get("range") || "24h"
  const csv = wantsCsv(url)
  const { page, size, skip } = pageOf(url, 30)

  const where: any = {}
  if (type) where.type = type
  if (["info", "warn", "error"].includes(level)) where.level = level
  if (RANGES[range]) where.createdAt = { gte: new Date(Date.now() - RANGES[range]) }
  if (q) {
    const users = await db.user.findMany({ where: { OR: [{ name: { contains: q } }, { email: { contains: q } }] }, select: { id: true }, take: 50 })
    where.OR = [{ message: { contains: q } }, { ip: { contains: q } }, { userId: q }, ...(users.length ? [{ userId: { in: users.map((u) => u.id) } }] : [])]
  }

  const dayAgo = new Date(Date.now() - 86_400_000)
  const [rows, total, byLevel, byType, recent] = await Promise.all([
    db.eventLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: csv ? 0 : skip, take: csv ? CSV_LIMIT : size }),
    db.eventLog.count({ where }),
    db.eventLog.groupBy({ by: ["level"], where: { createdAt: { gte: dayAgo } }, _count: { _all: true } }),
    db.eventLog.groupBy({ by: ["type"], _count: { _all: true }, orderBy: { type: "asc" } }),
    db.eventLog.findMany({ where: { createdAt: { gte: dayAgo } }, select: { createdAt: true, level: true }, take: 20000 }),
  ])
  const ids = Array.from(new Set(rows.map((r) => r.userId).filter((x): x is string => !!x)))
  const users = ids.length ? await db.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, email: true } }) : []
  const who = new Map(users.map((u) => [u.id, u]))

  if (csv) {
    return csvResponse("sistem-gunlugu", toCsv(["Zaman", "Seviye", "Tür", "Olay", "Kullanıcı", "E-posta", "IP", "Ayrıntı"], rows.map((r) => [r.createdAt, r.level, r.type, r.message, who.get(r.userId ?? "")?.name, who.get(r.userId ?? "")?.email, r.ip, r.meta])))
  }

  // last 24 hours, one bucket per hour (oldest first)
  const now = Date.now()
  const hours = Array.from({ length: 24 }, (_, i) => ({ t: new Date(now - (23 - i) * 3_600_000).toISOString(), total: 0, problems: 0 }))
  for (const e of recent) {
    const idx = 23 - Math.floor((now - e.createdAt.getTime()) / 3_600_000)
    if (idx >= 0 && idx < 24) {
      hours[idx].total++
      if (e.level !== "info") hours[idx].problems++
    }
  }
  return NextResponse.json({
    events: rows.map((r) => {
      let meta: unknown = null
      try { meta = r.meta ? JSON.parse(r.meta) : null } catch { meta = r.meta }
      const u = r.userId ? who.get(r.userId) : null
      return { id: r.id, type: r.type, level: r.level, message: r.message, ip: r.ip, meta, createdAt: r.createdAt, user: u ? { id: u.id, name: u.name, email: u.email } : r.userId ? { id: r.userId, name: null, email: null } : null }
    }),
    total, page, pageSize: size,
    stats: { byLevel: Object.fromEntries(byLevel.map((l) => [l.level, l._count._all])), hours },
    types: byType.map((t) => ({ type: t.type, count: t._count._all })),
  })
}
