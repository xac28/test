import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-api"
import { notifyReporterOnce } from "@/lib/report-server"

// POST /api/admin/reports/bulk { ids: string[], status: "REVIEWED" | "RESOLVED" | "DISMISSED" }
export async function POST(req: Request) {
  try {
    const g = await requireAdmin(req)
    if ("response" in g) return g.response
    const admin = g.admin
    const { ids, status } = await req.json().catch(() => ({}))
    if (!Array.isArray(ids) || ids.length === 0 || ids.length > 100) return NextResponse.json({ error: "1–100 rapor seçin." }, { status: 400 })
    if (!["REVIEWED", "RESOLVED", "DISMISSED"].includes(status)) return NextResponse.json({ error: "Geçersiz durum." }, { status: 400 })

    const closing = status !== "REVIEWED"
    const res = await db.report.updateMany({
      where: { id: { in: ids.map(String) }, status: { in: ["PENDING", "REVIEWED"] } },
      data: { status, ...(closing ? { handledById: admin.id, handledAt: new Date() } : {}) },
    })
    await db.auditLog.create({ data: { actorId: admin.id, action: "REPORT_BULK", targetId: null, reason: `${res.count} rapor → ${status}` } })
    if (closing) for (const id of ids) notifyReporterOnce(String(id)).catch(() => {})
    return NextResponse.json({ success: true, updated: res.count })
  } catch (error) {
    console.error("[ADMIN_REPORT_BULK_ERROR]", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
