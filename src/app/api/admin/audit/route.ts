import { resolveUser } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { requireAdmin, pageOf, wantsCsv, CSV_LIMIT, cleanReason } from "@/lib/admin-api"
import { csvResponse, toCsv } from "@/lib/csv"

export const dynamic = "force-dynamic"

// GET /api/admin/audit?q=&action=&page=&format=csv — who did what, newest first
export async function GET(req: Request) {
  const g = await requireAdmin(req)
  if ("response" in g) return g.response
  const url = new URL(req.url)
  const q = (url.searchParams.get("q") || "").trim().slice(0, 100)
  const action = (url.searchParams.get("action") || "").trim().slice(0, 60)
  const csv = wantsCsv(url)
  const { page, size, skip } = pageOf(url, 30)
  const where: any = {}
  if (action) where.action = action
  // "prefix" groups related actions ("SUPPORT" → SUPPORT_REPLY, SUPPORT_CLOSE …); "range" limits the period; "actor" is a user id
  const prefix = (url.searchParams.get("prefix") || "").replace(/[^A-Z_]/g, "").slice(0, 30)
  if (prefix && !action) where.action = { startsWith: prefix }
  const spans: Record<string, number> = { "24h": 86_400_000, "7d": 7 * 86_400_000, "30d": 30 * 86_400_000 }
  const range = url.searchParams.get("range") || ""
  if (spans[range]) where.createdAt = { gte: new Date(Date.now() - spans[range]) }
  const actorId = url.searchParams.get("actor")
  if (actorId) where.actorId = actorId
  if (q) where.OR = [{ reason: { contains: q } }, { targetId: q }, { actor: { name: { contains: q } } }]
  const [rows, total, actions] = await Promise.all([
    db.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: csv ? 0 : skip, take: csv ? CSV_LIMIT : size, include: { actor: { select: { name: true, email: true } } } }),
    db.auditLog.count({ where }),
    db.auditLog.groupBy({ by: ["action"], _count: { _all: true }, orderBy: { action: "asc" } }),
  ])
  if (csv) {
    return csvResponse("denetim-kayitlari", toCsv(["Zaman", "Yönetici", "İşlem", "Hedef", "Ayrıntı"], rows.map((r) => [r.createdAt, r.actor?.name ?? "Sistem", r.action, r.targetId, r.reason])))
  }
  return NextResponse.json({
    logs: rows.map((r) => ({ id: r.id, action: r.action, targetId: r.targetId, reason: r.reason, createdAt: r.createdAt, actor: r.actor?.name ?? "Sistem", actorId: r.actorId, actorEmail: r.actor?.email ?? null })),
    total, page, pageSize: size,
    actions: actions.map((a) => ({ action: a.action, count: a._count._all })),
  })
}

// ── FIX #4: Audit log oluşturma sadece ADMIN role'üne açık ──
export async function POST(req: Request) {
  try {
    const actor = await resolveUser(req)
    if (!actor) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { action, reason, roomName } = await req.json()

    // Admins may log any known action; teachers may only log the room timeout they trigger themselves
    const isAdmin = actor.role === "ADMIN"
    if (!isAdmin && !(actor.role === "TEACHER" && action === "TIMEOUT_ROOM")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Input validasyonu
    if (!action || typeof action !== "string") {
      return NextResponse.json({ error: "Action is required" }, { status: 400 })
    }

    // Action whitelist — sadece bilinen action'lar kabul edilir
    const ALLOWED_ACTIONS = [
      "TIMEOUT", "TIMEOUT_ROOM", "BAN_USER", "UNBAN_USER", "CLOSE_ROOM", 
      "APPROVE_APPLICATION", "REJECT_APPLICATION", "WARN_USER",
      "DELETE_POST", "DELETE_COMMENT", "RESOLVE_REPORT"
    ]

    if (!ALLOWED_ACTIONS.includes(action)) {
      return NextResponse.json({ error: `Invalid action. Allowed: ${ALLOWED_ACTIONS.join(", ")}` }, { status: 400 })
    }

    await db.auditLog.create({
      data: {
        actorId: actor.id,
        action,
        reason: cleanReason(reason) || null,
        targetId: typeof roomName === "string" ? roomName.slice(0, 120) : null
      }
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[AUDIT_LOG_ERROR]", error)
    return NextResponse.json({ error: "Internal Error" }, { status: 500 })
  }
}
