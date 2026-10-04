import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-api"
import { executeReportAction } from "@/lib/report-server"

// POST /api/admin/reports/:id/action { action: warn | ban | revoke_teacher | close_room | unpublish_workshop, note }
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const g = await requireAdmin(req)
    if ("response" in g) return g.response
    const admin = g.admin
    const { action, note } = await req.json().catch(() => ({}))
    const r = await executeReportAction(admin.id, params.id, action, String(note ?? ""))
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status })
    return NextResponse.json({ success: true, resolution: r.resolution })
  } catch (error) {
    console.error("[ADMIN_REPORT_ACTION_ERROR]", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
